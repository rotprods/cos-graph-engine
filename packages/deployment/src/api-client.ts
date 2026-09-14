import * as http from 'node:http';
import * as https from 'node:https';
import { readOperatorToken } from './operator-auth';

const DEFAULT_API_URL = 'http://localhost:8080';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class ApiRequestError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function safeServerError(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const error = (value as Record<string, unknown>).error;
  return typeof error === 'string' && error.length <= 240 ? error : undefined;
}

function statusMessage(statusCode: number, payload: unknown): string {
  if (statusCode === 401) {
    return 'Authentication required or expired. Set COS_API_TOKEN or COS_API_TOKEN_FILE to a valid bearer credential.';
  }
  if (statusCode === 403) {
    return 'Forbidden: the current credential does not have permission for this operation.';
  }
  const detail = statusCode < 500 ? safeServerError(payload) : undefined;
  return `COS API request failed with HTTP ${statusCode}${detail ? `: ${detail}` : ''}`;
}

export interface ApiRequestOptions {
  baseUrl?: string;
  token?: string;
}

/** HTTP client for the deployment CLI. Credentials are carried only in the Authorization header. */
export function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<any> {
  return new Promise((resolve, reject) => {
    const baseUrl = options.baseUrl || process.env.COS_API_URL || DEFAULT_API_URL;
    const url = new URL(path, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      reject(new Error(`Unsupported COS API protocol: ${url.protocol}`));
      return;
    }

    let token: string | undefined;
    try {
      token = options.token === undefined ? readOperatorToken() : options.token.trim();
    } catch (error) {
      reject(error);
      return;
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method,
      headers,
    }, (response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      let settled = false;

      const finishWithError = (error: Error) => {
        if (settled) return;
        settled = true;
        response.destroy();
        reject(error);
      };

      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          finishWithError(new Error('COS API response exceeded the 2 MiB client safety limit'));
          return;
        }
        chunks.push(buffer);
      });
      response.once('error', finishWithError);
      response.once('end', () => {
        if (settled) return;
        settled = true;
        const raw = Buffer.concat(chunks).toString('utf8');
        let payload: unknown = raw;
        if (raw) {
          try { payload = JSON.parse(raw); } catch { /* retain text for successful non-JSON responses */ }
        } else {
          payload = {};
        }
        const statusCode = response.statusCode || 500;
        if (statusCode < 200 || statusCode >= 300) {
          reject(new ApiRequestError(statusCode, statusMessage(statusCode, payload)));
          return;
        }
        resolve(payload);
      });
    });

    request.once('error', reject);
    if (body !== undefined) request.write(JSON.stringify(body));
    request.end();
  });
}
