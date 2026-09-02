import { canonicalSerialize, type CellContext } from '@cos/core';
import {
  AuthorityHttpEgressGuard,
  type AuthorityPinnedHttpTarget,
} from '../authority-isolation';
import type { AuthorityPinnedHttpTransport } from '../authority-provider-tools';

export interface AuthorityProviderReadHttpRequest {
  url: string;
  at: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface AuthorityProviderReadHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: unknown | null;
  bodyBytes: number;
  connectedAddress: string;
  originalHostname: string;
  targetDecisionHash: string;
}

export interface AuthorityProviderReadHttpTransport {
  get(request: AuthorityProviderReadHttpRequest): Promise<AuthorityProviderReadHttpResponse>;
}

/**
 * Converts the existing authority egress guard + pinned transport into a
 * provider-read-only GET boundary.
 *
 * The URL is authorized and DNS-resolved exactly once by AuthorityHttpEgressGuard.
 * The resulting pinned target is then consumed by AuthorityPinnedHttpTransport;
 * this class never calls ordinary fetch() after preflight and exposes no mutation
 * method. Redirect behavior remains fail-closed in the pinned transport.
 */
export class AuthorityGuardedPinnedProviderReadTransport
implements AuthorityProviderReadHttpTransport {
  constructor(
    private readonly guard: AuthorityHttpEgressGuard,
    private readonly transport: AuthorityPinnedHttpTransport,
    private readonly contextFactory: () => CellContext,
  ) {}

  async get(request: AuthorityProviderReadHttpRequest): Promise<AuthorityProviderReadHttpResponse> {
    const at = canonicalTime(request.at, 'provider read time');
    const url = canonicalHttpsUrl(request.url);
    const headers = normalizeHeaders(request.headers ?? {});
    const timeoutMs = normalizeTimeout(request.timeoutMs ?? 30_000);

    const target = await this.guard.authorize({
      url,
      method: 'GET',
      at,
    });
    this.guard.assertPinned(target, at);

    const raw = await this.transport.execute({
      target,
      evaluatedAt: at,
      headers,
      timeoutMs,
      context: cloneContext(this.contextFactory()),
    });
    return normalizePinnedResponse(raw, target);
  }
}

function normalizePinnedResponse(
  raw: unknown,
  target: AuthorityPinnedHttpTarget,
): AuthorityProviderReadHttpResponse {
  const record = requireRecord(raw, 'pinned provider read response');
  const statusCode = Number(record.statusCode);
  if (!Number.isSafeInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    throw new Error(`PROVIDER_READ_STATUS_INVALID status=${String(record.statusCode)}`);
  }
  const method = nonEmpty(String(record.method ?? ''), 'provider response method').toUpperCase();
  if (method !== 'GET') throw new Error(`PROVIDER_READ_METHOD_INVALID method=${method}`);
  const targetDecisionHash = nonEmpty(
    String(record.targetDecisionHash ?? ''),
    'provider response targetDecisionHash',
  );
  if (targetDecisionHash !== target.decisionHash) {
    throw new Error('PROVIDER_READ_TARGET_DECISION_MISMATCH');
  }
  const originalHostname = nonEmpty(
    String(record.originalHostname ?? ''),
    'provider response originalHostname',
  ).toLowerCase();
  if (originalHostname !== target.hostname.toLowerCase()) {
    throw new Error('PROVIDER_READ_HOSTNAME_MISMATCH');
  }
  const connectedAddress = nonEmpty(
    String(record.connectedAddress ?? ''),
    'provider response connectedAddress',
  );
  if (!target.resolvedAddresses.some(address => address.address === connectedAddress)) {
    throw new Error(`PROVIDER_READ_UNPINNED_ADDRESS address=${connectedAddress}`);
  }

  const headers = normalizeResponseHeaders(record.headers);
  const bodyBase64 = String(record.bodyBase64 ?? '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bodyBase64)) {
    throw new Error('PROVIDER_READ_BODY_BASE64_INVALID');
  }
  const bytes = Buffer.from(bodyBase64, 'base64');
  const body = bytes.byteLength === 0 ? null : parseJson(bytes.toString('utf8'));
  return {
    statusCode,
    headers,
    body,
    bodyBytes: bytes.byteLength,
    connectedAddress,
    originalHostname,
    targetDecisionHash,
  };
}

function normalizeHeaders(input: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [nameValue, value] of Object.entries(input)) {
    const name = nameValue.normalize('NFC').trim().toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name)) {
      throw new Error(`PROVIDER_READ_HEADER_NAME_INVALID name=${nameValue}`);
    }
    if (typeof value !== 'string' || /[\r\n]/.test(value)) {
      throw new Error(`PROVIDER_READ_HEADER_VALUE_INVALID name=${name}`);
    }
    if (name === 'host' || name === 'content-length' || name === 'transfer-encoding') {
      throw new Error(`PROVIDER_READ_HEADER_RESERVED name=${name}`);
    }
    output[name] = value;
  }
  return output;
}

function normalizeResponseHeaders(input: unknown): Record<string, string | string[]> {
  const record = requireRecord(input ?? {}, 'provider response headers');
  const output: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(record)) {
    const name = key.toLowerCase();
    if (typeof value === 'string') output[name] = value;
    else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      output[name] = [...value];
    } else {
      throw new Error(`PROVIDER_READ_RESPONSE_HEADER_INVALID name=${name}`);
    }
  }
  return output;
}

function parseJson(text: string): unknown {
  try {
    const parsed = JSON.parse(text) as unknown;
    canonicalSerialize(parsed);
    return parsed;
  } catch (error) {
    throw new Error(`PROVIDER_READ_JSON_INVALID: ${message(error)}`);
  }
}

function canonicalHttpsUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(nonEmpty(value, 'provider read URL'));
  } catch (error) {
    throw new Error(`PROVIDER_READ_URL_INVALID: ${message(error)}`);
  }
  if (url.protocol !== 'https:') throw new Error('PROVIDER_READ_HTTPS_REQUIRED');
  if (url.username || url.password) throw new Error('PROVIDER_READ_URL_CREDENTIALS_DENIED');
  url.hash = '';
  return url.toString();
}

function normalizeTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 120_000) {
    throw new Error('PROVIDER_READ_TIMEOUT_INVALID');
  }
  return value;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function cloneContext(value: CellContext): CellContext {
  try {
    return structuredClone(value);
  } catch (error) {
    throw new Error(`provider read context must be cloneable: ${message(error)}`);
  }
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
