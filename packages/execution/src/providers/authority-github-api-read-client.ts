import { canonicalSerialize, sha256Hex } from '@cos/core';
import type {
  AuthorityGitHubReadRequest,
  AuthorityGitHubReconciliationReadClient,
} from './authority-github-reconciliation-inspector';
import type {
  AuthorityProviderReadCandidate,
  AuthorityProviderReadObservation,
} from './authority-provider-inspection-shared';
import type {
  AuthorityProviderReadHttpResponse,
  AuthorityProviderReadHttpTransport,
} from './authority-provider-read-http-transport';

export interface AuthorityGitHubAccessTokenSource {
  getAccessToken(): Promise<string | null>;
}

export interface AuthorityGitHubTrustedCandidateExtractor {
  extract(input: {
    request: AuthorityGitHubReadRequest;
    resource: unknown;
    response: {
      statusCode: number;
      headers: Record<string, string | string[]>;
      bodyHash: string;
    };
  }): Promise<AuthorityProviderReadCandidate[]>;
}

export interface AuthorityGitHubApiReadClientOptions {
  transport: AuthorityProviderReadHttpTransport;
  tokenSource?: AuthorityGitHubAccessTokenSource;
  trustedCandidateExtractor?: AuthorityGitHubTrustedCandidateExtractor;
  apiVersion?: string;
  timeoutMs?: number;
}

/**
 * Real GitHub REST read client for reconciliation.
 *
 * It has no mutation method. An exact provider candidate is emitted only by an
 * explicitly injected trusted extractor; without one a successful GitHub read
 * proves only that a resource exists, never that this COS operation applied it.
 * GitHub 404 is deliberately non-authoritative because permissions/private
 * resources can be surfaced as not-found.
 */
export class AuthorityGitHubApiReadClient implements AuthorityGitHubReconciliationReadClient {
  private readonly apiVersion: string;
  private readonly timeoutMs: number;

  constructor(private readonly options: AuthorityGitHubApiReadClientOptions) {
    this.apiVersion = nonEmpty(options.apiVersion ?? '2022-11-28', 'GitHub API version');
    this.timeoutMs = normalizeTimeout(options.timeoutMs ?? 30_000);
  }

  async read(request: AuthorityGitHubReadRequest): Promise<AuthorityProviderReadObservation> {
    const input = canonicalClone(request, 'GitHub API read request');
    const url = githubReadUrl(input);
    const token = await optionalToken(this.options.tokenSource);
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': this.apiVersion,
    };
    if (token !== null) headers.authorization = `Bearer ${token}`;

    const response = await this.options.transport.get({
      url,
      at: input.operation.inspectedAt,
      headers,
      timeoutMs: this.timeoutMs,
    });
    const bodyHash = await sha256Hex(response.body);
    const evidence = githubReadEvidence(input, response, bodyHash, this.options.trustedCandidateExtractor !== undefined);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      const candidates = this.options.trustedCandidateExtractor
        ? await this.options.trustedCandidateExtractor.extract({
            request: canonicalClone(input, 'GitHub candidate extraction request'),
            resource: canonicalClone(response.body, 'GitHub response body'),
            response: {
              statusCode: response.statusCode,
              headers: cloneHeaders(response.headers),
              bodyHash,
            },
          })
        : [];
      return {
        authoritativeAbsence: false,
        providerRevision: githubRevision(response),
        candidates: normalizeCandidates(candidates),
        evidence,
      };
    }

    if (response.statusCode >= 500) {
      return {
        authoritativeAbsence: false,
        providerRevision: githubRevision(response),
        candidates: [],
        evidence: { ...evidence, ambiguity: 'PROVIDER_TRANSIENT_ERROR' },
      };
    }

    const ambiguity = response.statusCode === 404
      ? 'NOT_FOUND_NON_AUTHORITATIVE'
      : response.statusCode === 401 || response.statusCode === 403
        ? 'ACCESS_DENIED_NON_AUTHORITATIVE'
        : response.statusCode === 429
          ? 'RATE_LIMITED_NON_AUTHORITATIVE'
          : 'UNCLASSIFIED_PROVIDER_STATUS';
    return {
      authoritativeAbsence: false,
      providerRevision: githubRevision(response),
      candidates: [],
      evidence: { ...evidence, ambiguity },
    };
  }
}

function githubReadUrl(request: AuthorityGitHubReadRequest): string {
  if (request.operation.target.kind !== 'http') {
    throw new Error(`GITHUB_READ_TARGET_KIND_INVALID kind=${request.operation.target.kind}`);
  }
  let url: URL;
  try {
    url = new URL(request.operation.target.canonicalUrl);
  } catch (error) {
    throw new Error(`GITHUB_READ_URL_INVALID: ${message(error)}`);
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'api.github.com') {
    throw new Error(`GITHUB_READ_ORIGIN_DENIED origin=${url.origin}`);
  }
  const segments = url.pathname.split('/').filter(Boolean).map(segment => decode(segment));
  const owner = segments[1];
  const repository = segments[2];
  if (segments[0] !== 'repos' || owner === undefined || repository === undefined) {
    throw new Error(`GITHUB_READ_REPOSITORY_PATH_REQUIRED path=${url.pathname}`);
  }
  if (owner.toLowerCase() !== request.owner.toLowerCase()
    || repository.toLowerCase() !== request.repository.toLowerCase()) {
    throw new Error('GITHUB_READ_REPOSITORY_MISMATCH');
  }
  url.hash = '';
  return url.toString();
}

function githubReadEvidence(
  request: AuthorityGitHubReadRequest,
  response: AuthorityProviderReadHttpResponse,
  bodyHash: string,
  extractorConfigured: boolean,
): Record<string, unknown> {
  return {
    provider: 'github',
    readOnly: true,
    targetKey: request.targetKey,
    statusCode: response.statusCode,
    bodyHashAlgorithm: 'sha256',
    bodyHash,
    requestId: firstHeader(response.headers, 'x-github-request-id'),
    etag: firstHeader(response.headers, 'etag'),
    lastModified: firstHeader(response.headers, 'last-modified'),
    connectedAddress: response.connectedAddress,
    targetDecisionHash: response.targetDecisionHash,
    trustedCandidateExtractorConfigured: extractorConfigured,
  };
}

function githubRevision(response: AuthorityProviderReadHttpResponse): string | null {
  return firstHeader(response.headers, 'etag')
    ?? firstHeader(response.headers, 'last-modified')
    ?? firstHeader(response.headers, 'x-github-request-id');
}

function normalizeCandidates(input: AuthorityProviderReadCandidate[]): AuthorityProviderReadCandidate[] {
  const value = canonicalClone(input, 'GitHub extracted candidates');
  return value.map(candidate => {
    const operationId = optional(candidate.operationId);
    const providerIdempotencyKey = optional(candidate.providerIdempotencyKey);
    const operationContentHash = optional(candidate.operationContentHash);
    return {
      providerResourceId: nonEmpty(candidate.providerResourceId, 'GitHub providerResourceId'),
      ...(operationId === undefined ? {} : { operationId }),
      ...(providerIdempotencyKey === undefined ? {} : { providerIdempotencyKey }),
      ...(operationContentHash === undefined ? {} : { operationContentHash }),
      result: canonicalClone(candidate.result, 'GitHub candidate result'),
      evidence: canonicalClone(candidate.evidence, 'GitHub candidate evidence'),
    };
  });
}

async function optionalToken(source: AuthorityGitHubAccessTokenSource | undefined): Promise<string | null> {
  if (!source) return null;
  const token = await source.getAccessToken();
  if (token === null) return null;
  const normalized = token.trim();
  if (!normalized || /[\r\n]/.test(normalized)) throw new Error('GITHUB_READ_TOKEN_INVALID');
  return normalized;
}

function firstHeader(headers: Record<string, string | string[]>, name: string): string | null {
  const value = headers[name.toLowerCase()];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

function cloneHeaders(input: Record<string, string | string[]>): Record<string, string | string[]> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]));
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
    throw new Error('GITHUB_READ_TIMEOUT_INVALID');
  }
  return value;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value).normalize('NFC');
  } catch (error) {
    throw new Error(`GITHUB_READ_PATH_INVALID: ${message(error)}`);
  }
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
