import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type {
  AuthorityProviderInspectionOutcome,
  AuthorityProviderInspectionPort,
  AuthorityProviderInspectionRequest,
} from '../authority-provider-reconciliation';
import {
  AuthorityRepeatedAbsenceGate,
  classifyAuthorityProviderRead,
  type AuthorityAbsenceObservationStore,
  type AuthorityProviderReadObservation,
} from './authority-provider-inspection-shared';

export interface AuthorityDriveReadRequest {
  host: string;
  providerResourceId: string | null;
  targetKey: string;
  operation: AuthorityProviderInspectionRequest;
}

/** Read-only by construction. No create/update/delete method exists on this port. */
export interface AuthorityDriveReconciliationReadClient {
  read(request: AuthorityDriveReadRequest): Promise<AuthorityProviderReadObservation>;
}

export interface AuthorityDriveReconciliationInspectorOptions {
  client: AuthorityDriveReconciliationReadClient;
  absenceStore: AuthorityAbsenceObservationStore;
  minimumConsistencyWindowMs?: number;
  allowedHosts?: string[];
}

export class AuthorityDriveReconciliationInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://google-drive/read-only-reconciliation';
  readonly inspectorVersion = '2.0.0';
  private readonly absenceGate: AuthorityRepeatedAbsenceGate;
  private readonly windowMs: number;
  private readonly allowedHosts: Set<string>;

  constructor(private readonly options: AuthorityDriveReconciliationInspectorOptions) {
    this.absenceGate = new AuthorityRepeatedAbsenceGate(options.absenceStore);
    this.windowMs = options.minimumConsistencyWindowMs ?? 10_000;
    this.allowedHosts = new Set(
      (options.allowedHosts ?? [
        'www.googleapis.com',
        'drive.googleapis.com',
        'docs.googleapis.com',
      ]).map(host => normalizeHost(host)),
    );
    if (this.allowedHosts.size === 0) throw new Error('Drive inspector requires at least one allowed host');
  }

  async inspect(request: AuthorityProviderInspectionRequest): Promise<AuthorityProviderInspectionOutcome> {
    const operation = canonicalClone(request, 'Drive provider inspection request');
    const target = requireHttpTarget(operation);
    const host = normalizeHost(target.hostname);
    if (!this.allowedHosts.has(host)) {
      throw new Error(`DRIVE_RECONCILIATION_HOST_NOT_ALLOWED host=${host}`);
    }
    const parsed = parseDriveTarget(target.canonicalUrl, host);
    const targetKey = `drive://reconciliation/${canonicalHash128({
      resourceUri: operation.resourceUri,
      targetDecisionHash: target.targetDecisionHash,
      canonicalUrl: target.canonicalUrl,
    })}`;
    const observation = await this.options.client.read({
      host,
      providerResourceId: parsed.providerResourceId,
      targetKey,
      operation: canonicalClone(operation, 'Drive read operation'),
    });
    return classifyAuthorityProviderRead({
      request: operation,
      target: {
        provider: 'google_drive',
        targetKey,
        minimumConsistencyWindowMs: this.windowMs,
        descriptor: {
          canonicalUrl: target.canonicalUrl,
          hostname: host,
          method: target.method,
          targetDecisionHash: target.targetDecisionHash,
          providerResourceId: parsed.providerResourceId,
          resourceUri: operation.resourceUri,
        },
      },
      observation,
      absenceGate: this.absenceGate,
    });
  }
}

function requireHttpTarget(request: AuthorityProviderInspectionRequest) {
  if (request.target.kind !== 'http') {
    throw new Error(`DRIVE_RECONCILIATION_TARGET_KIND_INVALID kind=${request.target.kind}`);
  }
  return request.target;
}

function parseDriveTarget(canonicalUrl: string, expectedHost: string): { providerResourceId: string | null } {
  let url: URL;
  try {
    url = new URL(canonicalUrl);
  } catch {
    throw new Error(`DRIVE_RECONCILIATION_URL_INVALID url=${canonicalUrl}`);
  }
  if (url.protocol !== 'https:') throw new Error('DRIVE_RECONCILIATION_HTTPS_REQUIRED');
  if (normalizeHost(url.hostname) !== expectedHost) {
    throw new Error(`DRIVE_RECONCILIATION_HOST_MISMATCH urlHost=${url.hostname} targetHost=${expectedHost}`);
  }
  const drive = /\/drive\/v\d+\/files\/([^/?]+)/.exec(url.pathname);
  const docs = /\/v\d+\/documents\/([^/?]+)/.exec(url.pathname);
  const raw = drive?.[1] ?? docs?.[1] ?? null;
  return { providerResourceId: raw === null ? null : decodeComponent(raw, 'Drive resource ID') };
}

function decodeComponent(value: string, label: string): string {
  try {
    return nonEmpty(decodeURIComponent(value), label);
  } catch (error) {
    throw new Error(`${label} is invalid: ${message(error)}`);
  }
}

function normalizeHost(host: string): string {
  const normalized = nonEmpty(host, 'Drive host').toLowerCase();
  if (normalized.includes('/') || normalized.includes(':')) throw new Error(`Invalid Drive host: ${host}`);
  return normalized;
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
