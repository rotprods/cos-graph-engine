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

export interface AuthorityGitHubReadRequest {
  owner: string;
  repository: string;
  targetKey: string;
  operation: AuthorityProviderInspectionRequest;
}

/** Read-only by construction. Network/API mutation methods are intentionally absent. */
export interface AuthorityGitHubReconciliationReadClient {
  read(request: AuthorityGitHubReadRequest): Promise<AuthorityProviderReadObservation>;
}

export interface AuthorityGitHubReconciliationInspectorOptions {
  client: AuthorityGitHubReconciliationReadClient;
  absenceStore: AuthorityAbsenceObservationStore;
  minimumConsistencyWindowMs?: number;
  allowedHosts?: string[];
}

export class AuthorityGitHubReconciliationInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://github/read-only-reconciliation';
  readonly inspectorVersion = '2.0.0';
  private readonly absenceGate: AuthorityRepeatedAbsenceGate;
  private readonly windowMs: number;
  private readonly allowedHosts: Set<string>;

  constructor(private readonly options: AuthorityGitHubReconciliationInspectorOptions) {
    this.absenceGate = new AuthorityRepeatedAbsenceGate(options.absenceStore);
    this.windowMs = options.minimumConsistencyWindowMs ?? 5_000;
    this.allowedHosts = new Set(
      (options.allowedHosts ?? ['api.github.com']).map(host => normalizeHost(host)),
    );
    if (this.allowedHosts.size === 0) throw new Error('GitHub inspector requires at least one allowed host');
  }

  async inspect(request: AuthorityProviderInspectionRequest): Promise<AuthorityProviderInspectionOutcome> {
    const operation = canonicalClone(request, 'GitHub provider inspection request');
    const target = requireHttpTarget(operation);
    const host = normalizeHost(target.hostname);
    if (!this.allowedHosts.has(host)) {
      throw new Error(`GITHUB_RECONCILIATION_HOST_NOT_ALLOWED host=${host}`);
    }
    const parsed = parseGitHubRepository(target.canonicalUrl, host);
    const targetKey = `github://${parsed.owner}/${parsed.repository}/reconciliation/${canonicalHash128({
      resourceUri: operation.resourceUri,
      targetDecisionHash: target.targetDecisionHash,
    })}`;
    const observation = await this.options.client.read({
      owner: parsed.owner,
      repository: parsed.repository,
      targetKey,
      operation: canonicalClone(operation, 'GitHub read operation'),
    });
    return classifyAuthorityProviderRead({
      request: operation,
      target: {
        provider: 'github',
        targetKey,
        minimumConsistencyWindowMs: this.windowMs,
        descriptor: {
          owner: parsed.owner,
          repository: parsed.repository,
          canonicalUrl: target.canonicalUrl,
          hostname: host,
          method: target.method,
          targetDecisionHash: target.targetDecisionHash,
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
    throw new Error(`GITHUB_RECONCILIATION_TARGET_KIND_INVALID kind=${request.target.kind}`);
  }
  return request.target;
}

function parseGitHubRepository(canonicalUrl: string, expectedHost: string): { owner: string; repository: string } {
  let url: URL;
  try {
    url = new URL(canonicalUrl);
  } catch {
    throw new Error(`GITHUB_RECONCILIATION_URL_INVALID url=${canonicalUrl}`);
  }
  if (url.protocol !== 'https:') throw new Error('GITHUB_RECONCILIATION_HTTPS_REQUIRED');
  if (normalizeHost(url.hostname) !== expectedHost) {
    throw new Error(`GITHUB_RECONCILIATION_HOST_MISMATCH urlHost=${url.hostname} targetHost=${expectedHost}`);
  }
  const match = /^\/repos\/([^/]+)\/([^/]+)(?:\/|$)/.exec(url.pathname);
  if (!match) throw new Error(`GITHUB_RECONCILIATION_REPOSITORY_PATH_REQUIRED path=${url.pathname}`);
  return {
    owner: decodeComponent(match[1], 'GitHub owner').toLowerCase(),
    repository: decodeComponent(match[2], 'GitHub repository').toLowerCase(),
  };
}

function decodeComponent(value: string, label: string): string {
  try {
    return nonEmpty(decodeURIComponent(value), label);
  } catch (error) {
    throw new Error(`${label} is invalid: ${message(error)}`);
  }
}

function normalizeHost(host: string): string {
  const normalized = nonEmpty(host, 'GitHub host').toLowerCase();
  if (normalized.includes('/') || normalized.includes(':')) throw new Error(`Invalid GitHub host: ${host}`);
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
