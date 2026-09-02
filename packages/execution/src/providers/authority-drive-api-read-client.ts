import { canonicalSerialize, sha256Hex } from '@cos/core';
import type {
  AuthorityDriveReadRequest,
  AuthorityDriveReconciliationReadClient,
} from './authority-drive-reconciliation-inspector';
import type {
  AuthorityProviderReadCandidate,
  AuthorityProviderReadObservation,
} from './authority-provider-inspection-shared';
import type {
  AuthorityProviderReadHttpResponse,
  AuthorityProviderReadHttpTransport,
} from './authority-provider-read-http-transport';

export interface AuthorityDriveAccessTokenSource {
  getAccessToken(): Promise<string>;
}

export interface AuthorityDriveMarkerKeys {
  operationId: string;
  providerIdempotencyKey: string;
  operationContentHash: string;
}

export interface AuthorityDriveApiReadClientOptions {
  transport: AuthorityProviderReadHttpTransport;
  tokenSource: AuthorityDriveAccessTokenSource;
  markerKeys?: Partial<AuthorityDriveMarkerKeys>;
  timeoutMs?: number;
}

const DEFAULT_MARKER_KEYS: AuthorityDriveMarkerKeys = {
  operationId: 'cos_operation_id',
  providerIdempotencyKey: 'cos_provider_idempotency_key',
  operationContentHash: 'cos_operation_content_hash',
};

/**
 * Real Google Drive metadata reader for reconciliation.
 *
 * Drive `appProperties` are app-private metadata and are the only default source
 * of COS operation markers. A file that exists without complete markers is
 * returned as a mismatched candidate so the shared classifier resolves it to
 * `unknown`. 404/permission failures are never treated as authoritative absence
 * by default because caller authorization and resource visibility may differ.
 */
export class AuthorityDriveApiReadClient implements AuthorityDriveReconciliationReadClient {
  private readonly markerKeys: AuthorityDriveMarkerKeys;
  private readonly timeoutMs: number;

  constructor(private readonly options: AuthorityDriveApiReadClientOptions) {
    this.markerKeys = normalizeMarkerKeys(options.markerKeys ?? {});
    this.timeoutMs = normalizeTimeout(options.timeoutMs ?? 30_000);
  }

  async read(request: AuthorityDriveReadRequest): Promise<AuthorityProviderReadObservation> {
    const input = canonicalClone(request, 'Drive API read request');
    if (input.providerResourceId === null) {
      return {
        authoritativeAbsence: false,
        providerRevision: null,
        candidates: [],
        evidence: {
          provider: 'google_drive',
          readOnly: true,
          targetKey: input.targetKey,
          ambiguity: 'RESOURCE_ID_UNAVAILABLE_NO_READ',
        },
      };
    }

    const token = nonEmpty(await this.options.tokenSource.getAccessToken(), 'Drive access token');
    if (/[\r\n]/.test(token)) throw new Error('DRIVE_READ_TOKEN_INVALID');
    const url = driveMetadataUrl(input.providerResourceId);
    const response = await this.options.transport.get({
      url,
      at: input.operation.inspectedAt,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
      timeoutMs: this.timeoutMs,
    });
    const bodyHash = await sha256Hex(response.body);
    const commonEvidence = driveReadEvidence(input, response, bodyHash);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      const resource = requireRecord(response.body, 'Drive file metadata');
      const providerResourceId = nonEmpty(String(resource.id ?? ''), 'Drive response file ID');
      if (providerResourceId !== input.providerResourceId) {
        throw new Error(
          `DRIVE_READ_RESOURCE_ID_MISMATCH expected=${input.providerResourceId} actual=${providerResourceId}`,
        );
      }
      const appProperties = optionalRecord(resource.appProperties);
      const candidate = driveCandidate(resource, appProperties, providerResourceId, this.markerKeys);
      return {
        authoritativeAbsence: false,
        providerRevision: driveRevision(resource, response),
        candidates: [candidate],
        evidence: {
          ...commonEvidence,
          markerSource: 'drive.appProperties',
          markerPresence: {
            operationId: candidate.operationId !== undefined,
            providerIdempotencyKey: candidate.providerIdempotencyKey !== undefined,
            operationContentHash: candidate.operationContentHash !== undefined,
          },
        },
      };
    }

    const ambiguity = response.statusCode === 404
      ? 'NOT_FOUND_NON_AUTHORITATIVE'
      : response.statusCode === 401 || response.statusCode === 403
        ? 'ACCESS_DENIED_NON_AUTHORITATIVE'
        : response.statusCode === 429
          ? 'RATE_LIMITED_NON_AUTHORITATIVE'
          : response.statusCode >= 500
            ? 'PROVIDER_TRANSIENT_ERROR'
            : 'UNCLASSIFIED_PROVIDER_STATUS';
    return {
      authoritativeAbsence: false,
      providerRevision: driveRevision({}, response),
      candidates: [],
      evidence: { ...commonEvidence, ambiguity },
    };
  }
}

function driveCandidate(
  resource: Record<string, unknown>,
  appProperties: Record<string, unknown>,
  providerResourceId: string,
  keys: AuthorityDriveMarkerKeys,
): AuthorityProviderReadCandidate {
  const operationId = optionalString(appProperties[keys.operationId]);
  const providerIdempotencyKey = optionalString(appProperties[keys.providerIdempotencyKey]);
  const operationContentHash = optionalString(appProperties[keys.operationContentHash]);
  return {
    providerResourceId,
    ...(operationId === undefined ? {} : { operationId }),
    ...(providerIdempotencyKey === undefined ? {} : { providerIdempotencyKey }),
    ...(operationContentHash === undefined ? {} : { operationContentHash }),
    result: safeDriveResult(resource),
    evidence: {
      source: 'drive-app-properties',
      markerKeys: {
        operationId: keys.operationId,
        providerIdempotencyKey: keys.providerIdempotencyKey,
        operationContentHash: keys.operationContentHash,
      },
    },
  };
}

function safeDriveResult(resource: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: nonEmpty(String(resource.id ?? ''), 'Drive file ID'),
  };
  for (const key of [
    'name',
    'mimeType',
    'modifiedTime',
    'version',
    'headRevisionId',
    'md5Checksum',
    'trashed',
  ]) {
    const value = resource[key];
    if (typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return canonicalClone(result, 'Drive safe result');
}

function driveMetadataUrl(providerResourceId: string): string {
  const id = nonEmpty(providerResourceId, 'Drive providerResourceId');
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`);
  url.searchParams.set(
    'fields',
    'id,name,mimeType,modifiedTime,version,headRevisionId,md5Checksum,appProperties,properties,trashed',
  );
  url.searchParams.set('supportsAllDrives', 'true');
  return url.toString();
}

function driveReadEvidence(
  request: AuthorityDriveReadRequest,
  response: AuthorityProviderReadHttpResponse,
  bodyHash: string,
): Record<string, unknown> {
  return {
    provider: 'google_drive',
    readOnly: true,
    targetKey: request.targetKey,
    providerResourceId: request.providerResourceId,
    statusCode: response.statusCode,
    bodyHashAlgorithm: 'sha256',
    bodyHash,
    requestId: firstHeader(response.headers, 'x-guploader-uploadid')
      ?? firstHeader(response.headers, 'x-goog-request-id'),
    etag: firstHeader(response.headers, 'etag'),
    connectedAddress: response.connectedAddress,
    targetDecisionHash: response.targetDecisionHash,
  };
}

function driveRevision(
  resource: Record<string, unknown>,
  response: AuthorityProviderReadHttpResponse,
): string | number | null {
  const version = resource.version;
  if (typeof version === 'string' || typeof version === 'number') return version;
  const headRevisionId = resource.headRevisionId;
  if (typeof headRevisionId === 'string' && headRevisionId.trim()) return headRevisionId;
  const modifiedTime = resource.modifiedTime;
  if (typeof modifiedTime === 'string' && modifiedTime.trim()) return modifiedTime;
  return firstHeader(response.headers, 'etag');
}

function normalizeMarkerKeys(input: Partial<AuthorityDriveMarkerKeys>): AuthorityDriveMarkerKeys {
  return {
    operationId: markerKey(input.operationId ?? DEFAULT_MARKER_KEYS.operationId),
    providerIdempotencyKey: markerKey(
      input.providerIdempotencyKey ?? DEFAULT_MARKER_KEYS.providerIdempotencyKey,
    ),
    operationContentHash: markerKey(
      input.operationContentHash ?? DEFAULT_MARKER_KEYS.operationContentHash,
    ),
  };
}

function markerKey(value: string): string {
  const normalized = nonEmpty(value, 'Drive appProperties marker key');
  if (!/^[A-Za-z0-9_.-]{1,124}$/.test(normalized)) {
    throw new Error(`DRIVE_READ_MARKER_KEY_INVALID key=${normalized}`);
  }
  return normalized;
}

function optionalRecord(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  return requireRecord(value, 'Drive appProperties');
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.normalize('NFC').trim();
  return normalized || undefined;
}

async function _typeOnly(): Promise<void> {
  // Prevent accidental widening of this client into a write surface.
  const client: AuthorityDriveReconciliationReadClient | null = null;
  void client;
}
void _typeOnly;

function firstHeader(headers: Record<string, string | string[]>, name: string): string | null {
  const value = headers[name.toLowerCase()];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function normalizeTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 120_000) {
    throw new Error('DRIVE_READ_TIMEOUT_INVALID');
  }
  return value;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
