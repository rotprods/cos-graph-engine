export type CanonicalScheme =
  | 'agentic'
  | 'github'
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'drive'
  | 'custom';

export interface CanonicalIdentityInput {
  scheme: CanonicalScheme;
  authority: string;
  resourceType: string;
  resourceId: string;
}

export interface CanonicalIdentity extends CanonicalIdentityInput {
  /** Stable URI used as the authoritative external identity. */
  uri: string;
  /** Compact deterministic identifier derived from the canonical URI. */
  id: string;
}

export interface IdentityAlias {
  alias: string;
  canonicalUri: string;
}

/**
 * Stable serialization for deterministic identity inputs.
 *
 * This deliberately supports JSON-like data only. Canonical identity must not
 * depend on object insertion order, wall-clock time, random numbers or locale.
 */
export function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new Error('Non-finite numbers are not valid canonical identity input');
      return Object.is(value, -0) ? '0' : String(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'bigint':
      return `${value.toString()}n`;
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map(stableSerialize).join(',')}]`;
      }

      const object = value as Record<string, unknown>;
      const keys = Object.keys(object).sort();
      return `{${keys.map(key => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(',')}}`;
    }
    default:
      throw new Error(`Unsupported canonical identity input type: ${typeof value}`);
  }
}

/**
 * 64-bit FNV-1a implemented with BigInt.
 *
 * We compute two independently-seeded lanes below to obtain a compact 128-bit
 * deterministic identifier. Native provider IDs and canonical URIs remain the
 * primary identity whenever available; this hash is a reproducible compact key,
 * not a replacement for cryptographic signatures.
 */
function fnv1a64(input: string, offset: bigint): bigint {
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  let hash = offset & mask;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    hash ^= BigInt(code & 0xff);
    hash = (hash * prime) & mask;
    hash ^= BigInt((code >>> 8) & 0xff);
    hash = (hash * prime) & mask;
  }

  return hash;
}

export function stableHash128(value: unknown): string {
  const input = stableSerialize(value);
  const laneA = fnv1a64(input, 0xcbf29ce484222325n);
  const laneB = fnv1a64(input, 0x84222325cbf29ce4n);
  return `${laneA.toString(16).padStart(16, '0')}${laneB.toString(16).padStart(16, '0')}`;
}

function normalizeAuthority(authority: string): string {
  const value = authority.trim().toLowerCase();
  if (!value) throw new Error('Canonical identity authority must not be empty');
  return value;
}

function normalizeResourceType(resourceType: string): string {
  const value = resourceType.trim().toLowerCase();
  if (!value) throw new Error('Canonical identity resourceType must not be empty');
  return encodeURIComponent(value);
}

function normalizeResourceId(resourceId: string): string {
  const value = resourceId.trim();
  if (!value) throw new Error('Canonical identity resourceId must not be empty');
  return encodeURIComponent(value);
}

export function canonicalUri(input: CanonicalIdentityInput): string {
  return `${input.scheme}://${normalizeAuthority(input.authority)}/${normalizeResourceType(input.resourceType)}/${normalizeResourceId(input.resourceId)}`;
}

export function canonicalIdentity(input: CanonicalIdentityInput, prefix = 'cid'): CanonicalIdentity {
  const uri = canonicalUri(input);
  return {
    ...input,
    authority: normalizeAuthority(input.authority),
    resourceType: decodeURIComponent(normalizeResourceType(input.resourceType)),
    resourceId: input.resourceId.trim(),
    uri,
    id: `${prefix}_${stableHash128(uri)}`,
  };
}

/**
 * In-memory registry enforcing one canonical target per alias and one compact ID
 * per canonical URI. Persistent adapters can implement the same semantics.
 */
export class IdentityRegistry {
  private readonly byUri = new Map<string, CanonicalIdentity>();
  private readonly byId = new Map<string, string>();
  private readonly aliases = new Map<string, string>();

  register(input: CanonicalIdentityInput, prefix = 'cid'): CanonicalIdentity {
    const identity = canonicalIdentity(input, prefix);
    const existing = this.byUri.get(identity.uri);
    if (existing) return existing;

    const existingUriForId = this.byId.get(identity.id);
    if (existingUriForId && existingUriForId !== identity.uri) {
      throw new Error(`Deterministic identity collision: ${identity.id} maps to both ${existingUriForId} and ${identity.uri}`);
    }

    this.byUri.set(identity.uri, identity);
    this.byId.set(identity.id, identity.uri);
    return identity;
  }

  addAlias(alias: string, canonical: string): void {
    const normalizedAlias = alias.trim();
    if (!normalizedAlias) throw new Error('Identity alias must not be empty');
    if (!this.byUri.has(canonical)) throw new Error(`Canonical identity ${canonical} is not registered`);

    const existing = this.aliases.get(normalizedAlias);
    if (existing && existing !== canonical) {
      throw new Error(`Alias collision: ${normalizedAlias} already resolves to ${existing}`);
    }

    this.aliases.set(normalizedAlias, canonical);
  }

  resolve(value: string): CanonicalIdentity | null {
    if (this.byUri.has(value)) return this.byUri.get(value)!;
    if (this.byId.has(value)) return this.byUri.get(this.byId.get(value)!) || null;

    const canonical = this.aliases.get(value);
    return canonical ? this.byUri.get(canonical) || null : null;
  }

  listAliases(canonical: string): IdentityAlias[] {
    const result: IdentityAlias[] = [];
    for (const [alias, canonicalUriValue] of this.aliases) {
      if (canonicalUriValue === canonical) result.push({ alias, canonicalUri: canonical });
    }
    return result.sort((a, b) => a.alias.localeCompare(b.alias));
  }
}
