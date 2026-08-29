import * as https from 'node:https';
import * as net from 'node:net';
import * as tls from 'node:tls';
import type { IncomingHttpHeaders } from 'node:http';
import type {
  AuthorityPinnedHttpTransport,
  AuthorityPinnedHttpTransportRequest,
} from './authority-provider-tools';

export interface NodePinnedHttpsTransportOptions {
  maxResponseBytes?: number;
  idempotencyHeaderName?: string;
  userAgent?: string;
  acceptedStatusCodes?: number[];
}

export interface NodePinnedHttpsResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  bodyBase64: string;
  contentType: string | null;
  location: string | null;
  connectedAddress: string;
  originalHostname: string;
  method: string;
  targetDecisionHash: string;
}

/**
 * Node HTTPS transport that never asks DNS to resolve the authority target.
 *
 * It connects to the first already-authorized pinned address, preserves the
 * original hostname in TLS SNI and HTTP Host, verifies the certificate against
 * the original hostname, disables connection pooling, never follows redirects,
 * and has zero internal retries. A provider/transport exception after request
 * dispatch is intentionally handled as an uncertain outcome by the surrounding
 * AuthorityCapabilityRuntime.
 */
export class NodePinnedHttpsTransport implements AuthorityPinnedHttpTransport {
  private readonly maxResponseBytes: number;
  private readonly idempotencyHeaderName: string;
  private readonly userAgent: string;
  private readonly acceptedStatusCodes: Set<number>;

  constructor(options: NodePinnedHttpsTransportOptions = {}) {
    this.maxResponseBytes = options.maxResponseBytes ?? 10_000_000;
    if (!Number.isSafeInteger(this.maxResponseBytes)
      || this.maxResponseBytes < 1
      || this.maxResponseBytes > 100_000_000) {
      throw new Error('maxResponseBytes must be a safe integer in [1,100000000]');
    }
    this.idempotencyHeaderName = headerName(
      options.idempotencyHeaderName ?? 'idempotency-key',
    );
    this.userAgent = nonEmpty(
      options.userAgent ?? 'cos-authority-pinned-transport/1.0',
      'userAgent',
    );
    const codes = options.acceptedStatusCodes
      ?? Array.from({ length: 100 }, (_, index) => 200 + index);
    this.acceptedStatusCodes = new Set(codes.map(statusCode));
    if (this.acceptedStatusCodes.size === 0) {
      throw new Error('acceptedStatusCodes must not be empty');
    }
  }

  async execute(request: AuthorityPinnedHttpTransportRequest): Promise<NodePinnedHttpsResponse> {
    const target = structuredClone(request.target);
    if (target.protocol !== 'https:') {
      throw new Error(`AUTHORITY_PINNED_TRANSPORT_PROTOCOL_DENIED protocol=${target.protocol}`);
    }
    const canonical = new URL(target.canonicalUrl);
    const hostname = canonical.hostname.normalize('NFC').toLowerCase();
    if (hostname !== target.hostname.normalize('NFC').toLowerCase()) {
      throw new Error('AUTHORITY_PINNED_TRANSPORT_HOSTNAME_MISMATCH');
    }
    const canonicalPort = canonical.port ? Number(canonical.port) : 443;
    if (canonicalPort !== target.port) {
      throw new Error('AUTHORITY_PINNED_TRANSPORT_PORT_MISMATCH');
    }
    if (request.providerIdempotencyKey !== undefined
      && !request.providerIdempotencyKey.trim()) {
      throw new Error('AUTHORITY_PINNED_TRANSPORT_IDEMPOTENCY_EMPTY');
    }

    const pinned = target.resolvedAddresses[0];
    if (!pinned) throw new Error('AUTHORITY_PINNED_TRANSPORT_ADDRESS_REQUIRED');
    const family = net.isIP(pinned.address);
    if (family === 0 || family !== pinned.family) {
      throw new Error(`AUTHORITY_PINNED_TRANSPORT_ADDRESS_INVALID address=${pinned.address}`);
    }

    const headers = normalizedHeaders(request.headers ?? {});
    const hostValue = hostHeader(target.hostname, target.port);
    if (headers.host !== undefined && headers.host !== hostValue) {
      throw new Error('AUTHORITY_PINNED_TRANSPORT_HOST_HEADER_CONFLICT');
    }
    headers.host = hostValue;
    headers['user-agent'] ??= this.userAgent;

    if (request.providerIdempotencyKey !== undefined) {
      const existing = headers[this.idempotencyHeaderName];
      if (existing !== undefined && existing !== request.providerIdempotencyKey) {
        throw new Error('AUTHORITY_PINNED_TRANSPORT_IDEMPOTENCY_HEADER_CONFLICT');
      }
      headers[this.idempotencyHeaderName] = request.providerIdempotencyKey;
    }

    const body = request.body === undefined
      ? null
      : Buffer.from(request.body, 'utf8');
    if (body) {
      if (body.byteLength > 10_000_000) {
        throw new Error('AUTHORITY_PINNED_TRANSPORT_BODY_TOO_LARGE');
      }
      headers['content-length'] = String(body.byteLength);
    }

    const timeoutMs = request.timeoutMs ?? 30_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) {
      throw new Error('AUTHORITY_PINNED_TRANSPORT_TIMEOUT_INVALID');
    }

    const response = await this.requestOnce({
      request,
      canonical,
      pinnedAddress: pinned.address,
      family,
      headers,
      body,
      timeoutMs,
    });

    if (response.statusCode >= 300 && response.statusCode < 400) {
      throw new Error(
        `AUTHORITY_HTTP_REDIRECT_REQUIRES_REAUTHORIZATION status=${response.statusCode} location=${response.location ?? 'missing'}`,
      );
    }
    if (!this.acceptedStatusCodes.has(response.statusCode)) {
      throw new Error(`AUTHORITY_HTTP_STATUS_NOT_ACCEPTED status=${response.statusCode}`);
    }
    return response;
  }

  private requestOnce(input: {
    request: AuthorityPinnedHttpTransportRequest;
    canonical: URL;
    pinnedAddress: string;
    family: 4 | 6;
    headers: Record<string, string>;
    body: Buffer | null;
    timeoutMs: number;
  }): Promise<NodePinnedHttpsResponse> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const originalHostname = input.request.target.hostname;
      const originalIsIp = net.isIP(originalHostname) !== 0;
      const finishReject = (error: unknown): void => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const client = https.request({
        protocol: 'https:',
        hostname: input.pinnedAddress,
        family: input.family,
        port: input.request.target.port,
        method: input.request.target.method,
        path: `${input.canonical.pathname}${input.canonical.search}`,
        headers: input.headers,
        agent: false,
        servername: originalIsIp ? undefined : originalHostname,
        rejectUnauthorized: true,
        checkServerIdentity: (_host, certificate) =>
          tls.checkServerIdentity(originalHostname, certificate),
        // Even if Node elects to call lookup for an IP literal, the callback can
        // only return the already-authorized address. No resolver is invoked.
        lookup: (_hostname, _options, callback) => {
          callback(null, input.pinnedAddress, input.family);
        },
      }, response => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer | string) => {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += bytes.byteLength;
          if (size > this.maxResponseBytes) {
            response.destroy(new Error('AUTHORITY_PINNED_TRANSPORT_RESPONSE_TOO_LARGE'));
            return;
          }
          chunks.push(bytes);
        });
        response.once('error', finishReject);
        response.once('end', () => {
          if (settled) return;
          const statusCodeValue = response.statusCode ?? 0;
          if (!Number.isSafeInteger(statusCodeValue) || statusCodeValue < 100 || statusCodeValue > 599) {
            finishReject(new Error(`AUTHORITY_PINNED_TRANSPORT_STATUS_INVALID status=${statusCodeValue}`));
            return;
          }
          settled = true;
          resolve({
            statusCode: statusCodeValue,
            headers: responseHeaders(response.headers),
            bodyBase64: Buffer.concat(chunks).toString('base64'),
            contentType: headerFirst(response.headers['content-type']),
            location: headerFirst(response.headers.location),
            connectedAddress: input.pinnedAddress,
            originalHostname,
            method: input.request.target.method,
            targetDecisionHash: input.request.target.decisionHash,
          });
        });
      });

      client.once('error', finishReject);
      client.setTimeout(input.timeoutMs, () => {
        client.destroy(new Error(`AUTHORITY_PINNED_TRANSPORT_TIMEOUT timeoutMs=${input.timeoutMs}`));
      });
      if (input.body) client.write(input.body);
      client.end();
    });
  }
}

function normalizedHeaders(input: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [nameValue, value] of Object.entries(input)) {
    const name = headerName(nameValue);
    if (name === 'connection' || name === 'transfer-encoding' || name === ':authority') {
      throw new Error(`AUTHORITY_PINNED_TRANSPORT_HEADER_DENIED name=${name}`);
    }
    if (typeof value !== 'string' || /[\r\n]/.test(value)) {
      throw new Error(`AUTHORITY_PINNED_TRANSPORT_HEADER_INVALID name=${name}`);
    }
    output[name] = value;
  }
  return output;
}

function responseHeaders(headers: IncomingHttpHeaders): Record<string, string | string[]> {
  const entries = Object.entries(headers)
    .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
    .map(([name, value]) => [name.toLowerCase(), Array.isArray(value) ? [...value] : String(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function headerFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function hostHeader(hostname: string, port: number): string {
  const bracketed = net.isIP(hostname) === 6 ? `[${hostname}]` : hostname;
  return port === 443 ? bracketed : `${bracketed}:${port}`;
}

function statusCode(value: number): number {
  if (!Number.isSafeInteger(value) || value < 100 || value > 599) {
    throw new Error(`Invalid accepted HTTP status code: ${value}`);
  }
  return value;
}

function headerName(value: string): string {
  const normalized = value.normalize('NFC').trim().toLowerCase();
  if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(normalized)) {
    throw new Error(`Invalid HTTP header name: ${value}`);
  }
  return normalized;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}
