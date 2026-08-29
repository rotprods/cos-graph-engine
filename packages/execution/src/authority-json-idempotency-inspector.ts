import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type { AuthorityPinnedHttpTarget } from './authority-isolation';
import type {
  AuthorityPinnedHttpTransport,
  AuthorityPinnedHttpTransportRequest,
} from './authority-provider-tools';
import type {
  AuthorityProviderInspectionOutcome,
  AuthorityProviderInspectionPort,
  AuthorityProviderInspectionRequest,
} from './authority-provider-reconciliation';

export interface AuthorityJsonInspectionTargetFactory {
  createTarget(
    request: AuthorityProviderInspectionRequest,
  ): Promise<AuthorityPinnedHttpTarget> | AuthorityPinnedHttpTarget;
}

export interface AuthorityJsonIdempotencyInspectorOptions {
  inspectorId: string;
  inspectorVersion: string;
  targetFactory: AuthorityJsonInspectionTargetFactory;
  transport: AuthorityPinnedHttpTransport;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

interface ProviderStatusEnvelope {
  schemaVersion: 1;
  providerIdempotencyKey: string;
  status: 'applied' | 'not_applied' | 'partial' | 'unknown';
  providerRevision?: string | number | null;
  result?: unknown;
  evidence?: Record<string, unknown>;
  authoritativeAbsence?: boolean;
  reason?: string;
  compensation?: {
    capability: string;
    resourceUri?: string;
    input: unknown;
    error: {
      code: string;
      message: string;
      retryable: boolean;
      details?: Record<string, unknown>;
    };
  };
}

/**
 * Provider adapter for services exposing a read-only JSON idempotency/status
 * endpoint. The target factory must return a pre-authorized GET/HEAD target.
 * This adapter never calls the original mutation endpoint.
 */
export class AuthorityJsonIdempotencyInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId: string;
  readonly inspectorVersion: string;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;

  constructor(private readonly options: AuthorityJsonIdempotencyInspectorOptions) {
    this.inspectorId = nonEmpty(options.inspectorId, 'inspectorId');
    this.inspectorVersion = nonEmpty(options.inspectorVersion, 'inspectorVersion');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 120_000) {
      throw new Error('inspection timeoutMs must be a safe integer in [1,120000]');
    }
    this.headers = normalizedHeaders(options.headers ?? {});
  }

  async inspect(request: AuthorityProviderInspectionRequest): Promise<AuthorityProviderInspectionOutcome> {
    const target = structuredClone(await this.options.targetFactory.createTarget(request));
    if (target.method !== 'GET' && target.method !== 'HEAD') {
      throw new Error(`PROVIDER_INSPECTION_TARGET_MUST_BE_READ_ONLY method=${target.method}`);
    }
    const transportRequest: AuthorityPinnedHttpTransportRequest = {
      target,
      evaluatedAt: canonicalTime(request.inspectedAt, 'inspection evaluatedAt'),
      headers: {
        ...this.headers,
        'accept': 'application/json',
        'x-cos-provider-idempotency-key': request.providerIdempotencyKey,
      },
      timeoutMs: this.timeoutMs,
      providerIdempotencyKey: request.providerIdempotencyKey,
      context: {
        traceId: `provider-inspection:${request.operationId}`,
        metadata: {
          projectId: request.projectId,
          capability: request.capability,
        },
      },
    };
    const response = await this.options.transport.execute(transportRequest);
    const parsed = parseTransportResponse(response);
    const envelope = parseEnvelope(parsed.bodyBase64);
    if (envelope.providerIdempotencyKey !== request.providerIdempotencyKey) {
      throw new Error('PROVIDER_INSPECTION_IDEMPOTENCY_MISMATCH');
    }

    const commonEvidence = canonicalEvidence({
      statusEndpoint: target.canonicalUrl,
      targetDecisionHash: target.decisionHash,
      statusCode: parsed.statusCode,
      responseHash: canonicalHash128(envelope),
      providerRevision: envelope.providerRevision ?? null,
      providerEvidence: envelope.evidence ?? {},
    });

    if (envelope.status === 'applied') {
      if (!Object.prototype.hasOwnProperty.call(envelope, 'result')) {
        throw new Error('PROVIDER_INSPECTION_APPLIED_RESULT_REQUIRED');
      }
      return {
        status: 'applied',
        result: canonicalClone(envelope.result, 'provider applied result'),
        evidence: commonEvidence,
      };
    }

    if (envelope.status === 'not_applied') {
      if (envelope.authoritativeAbsence !== true) {
        throw new Error('PROVIDER_INSPECTION_AUTHORITATIVE_ABSENCE_REQUIRED');
      }
      return {
        status: 'not_applied',
        authoritativeAbsence: true,
        evidence: commonEvidence,
      };
    }

    if (envelope.status === 'partial') {
      const compensation = envelope.compensation;
      if (!compensation) throw new Error('PROVIDER_INSPECTION_COMPENSATION_REQUIRED');
      return {
        status: 'partial',
        error: {
          code: nonEmpty(compensation.error.code, 'compensation error code'),
          message: nonEmpty(compensation.error.message, 'compensation error message'),
          retryable: Boolean(compensation.error.retryable),
          details: canonicalClone(compensation.error.details ?? {}, 'compensation error details'),
        },
        compensationCapability: nonEmpty(compensation.capability, 'compensation capability'),
        ...(optional(compensation.resourceUri) === undefined
          ? {}
          : { compensationResourceUri: optional(compensation.resourceUri) }),
        compensationInput: canonicalClone(compensation.input, 'compensation input'),
        evidence: commonEvidence,
      };
    }

    return {
      status: 'unknown',
      reason: nonEmpty(envelope.reason ?? 'provider returned unknown status', 'unknown reason'),
      evidence: commonEvidence,
    };
  }
}

function parseTransportResponse(value: unknown): {
  statusCode: number;
  bodyBase64: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('PROVIDER_INSPECTION_TRANSPORT_RESPONSE_INVALID');
  }
  const response = value as Record<string, unknown>;
  const statusCode = Number(response.statusCode);
  if (!Number.isSafeInteger(statusCode) || statusCode < 200 || statusCode > 299) {
    throw new Error(`PROVIDER_INSPECTION_HTTP_STATUS_INVALID status=${String(response.statusCode)}`);
  }
  const bodyBase64 = nonEmpty(String(response.bodyBase64 ?? ''), 'inspection bodyBase64');
  return { statusCode, bodyBase64 };
}

function parseEnvelope(bodyBase64: string): ProviderStatusEnvelope {
  let parsed: unknown;
  try {
    const text = Buffer.from(bodyBase64, 'base64').toString('utf8');
    if (Buffer.byteLength(text, 'utf8') > 1_000_000) {
      throw new Error('inspection JSON exceeds 1 MB');
    }
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`PROVIDER_INSPECTION_JSON_INVALID: ${message(error)}`);
  }
  canonicalSerialize(parsed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('PROVIDER_INSPECTION_ENVELOPE_INVALID');
  }
  const envelope = parsed as Partial<ProviderStatusEnvelope>;
  if (envelope.schemaVersion !== 1) {
    throw new Error(`PROVIDER_INSPECTION_SCHEMA_UNSUPPORTED version=${String(envelope.schemaVersion)}`);
  }
  if (!['applied', 'not_applied', 'partial', 'unknown'].includes(String(envelope.status))) {
    throw new Error(`PROVIDER_INSPECTION_STATUS_INVALID status=${String(envelope.status)}`);
  }
  return structuredClone(envelope) as ProviderStatusEnvelope;
}

function canonicalEvidence(value: Record<string, unknown>): Record<string, unknown> {
  const evidence = canonicalClone(value, 'provider inspection evidence');
  return {
    ...evidence,
    evidenceHash: canonicalHash128(evidence),
  };
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function normalizedHeaders(input: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(input)) {
    const name = rawName.normalize('NFC').trim().toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name)) {
      throw new Error(`Invalid provider inspection header name: ${rawName}`);
    }
    if (['host', ':authority', 'connection', 'content-length'].includes(name)) {
      throw new Error(`PROVIDER_INSPECTION_RESERVED_HEADER name=${name}`);
    }
    if (typeof rawValue !== 'string' || /[\r\n]/.test(rawValue)) {
      throw new Error(`PROVIDER_INSPECTION_HEADER_VALUE_INVALID name=${name}`);
    }
    output[name] = rawValue;
  }
  return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.normalize('NFC').trim();
  return normalized || undefined;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
