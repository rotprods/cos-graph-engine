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

export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

/**
 * Legacy-compatible deterministic serializer.
 *
 * Kept because existing projection hashes may depend on its historical support
 * for `undefined` and bigint. New authority identities/integrity manifests must
 * use `canonicalSerialize` / `canonicalHash128` instead.
 */
export function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new Error('Non-finite numbers are not valid deterministic input');
      return Object.is(value, -0) ? '0' : String(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'bigint':
      return `${value.toString()}n`;
    case 'object': {
      if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
      const object = value as Record<string, unknown>;
      const keys = Object.keys(object).sort();
      return `{${keys.map(key => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(',')}}`;
    }
    default:
      throw new Error(`Unsupported deterministic input type: ${typeof value}`);
  }
}

/**
 * Strict authority serializer for canonical JSON-like data.
 *
 * Guarantees:
 * - plain objects/arrays only;
 * - finite numbers only (`-0` canonicalizes to `0`);
 * - NFC-normalized Unicode strings and object keys;
 * - deterministic key ordering;
 * - no sparse arrays, accessors, symbol/non-enumerable object fields, cycles,
 *   undefined, bigint, function, symbol, Date, Map, Set or class instances;
 * - canonically equivalent Unicode keys may not collapse silently.
 */
export function canonicalSerialize(value: unknown): string {
  return serializeCanonical(value, '$', new Set<object>());
}

/** 64-bit FNV-1a lane used for compact deterministic keys, not integrity. */
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

function hash128Serialized(input: string): string {
  const laneA = fnv1a64(input, 0xcbf29ce484222325n);
  const laneB = fnv1a64(input, 0x84222325cbf29ce4n);
  return `${laneA.toString(16).padStart(16, '0')}${laneB.toString(16).padStart(16, '0')}`;
}

/** Legacy-compatible compact deterministic hash. */
export function stableHash128(value: unknown): string {
  return hash128Serialized(stableSerialize(value));
}

/** Strict authority compact deterministic hash over `canonicalSerialize`. */
export function canonicalHash128(value: unknown): string {
  return hash128Serialized(canonicalSerialize(value));
}

const GITHUB_CASE_INSENSITIVE_RESOURCE_TYPES = new Set([
  'repository',
  'organization',
  'user',
  'commit',
]);

export function normalizeCanonicalIdentityInput(input: CanonicalIdentityInput): CanonicalIdentityInput {
  const scheme = input.scheme;
  const authority = normalizeAuthority(input.authority);
  const resourceType = normalizeResourceType(input.resourceType);
  const resourceId = normalizeResourceId(scheme, resourceType, input.resourceId);
  return { scheme, authority, resourceType, resourceId };
}

function normalizeAuthority(authority: string): string {
  const value = normalizeIdentityText(authority, 'authority').toLowerCase();
  if (!value) throw new Error('Canonical identity authority must not be empty');
  return value;
}

function normalizeResourceType(resourceType: string): string {
  const value = normalizeIdentityText(resourceType, 'resourceType').toLowerCase();
  if (!value) throw new Error('Canonical identity resourceType must not be empty');
  return value;
}

function normalizeResourceId(scheme: CanonicalScheme, resourceType: string, resourceId: string): string {
  let value = normalizeIdentityText(resourceId, 'resourceId');
  if (!value) throw new Error('Canonical identity resourceId must not be empty');
  if (scheme === 'github' && GITHUB_CASE_INSENSITIVE_RESOURCE_TYPES.has(resourceType)) {
    value = value.toLowerCase();
  }
  return value;
}

export function canonicalUri(input: CanonicalIdentityInput): string {
  const normalized = normalizeCanonicalIdentityInput(input);
  return `${normalized.scheme}://${encodeURIComponent(normalized.authority)}/${encodeURIComponent(normalized.resourceType)}/${encodeURIComponent(normalized.resourceId)}`;
}

export function canonicalIdentity(input: CanonicalIdentityInput, prefix = 'cid'): CanonicalIdentity {
  const normalized = normalizeCanonicalIdentityInput(input);
  const uri = canonicalUri(normalized);
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix || !/^[A-Za-z0-9_-]+$/.test(normalizedPrefix)) {
    throw new Error(`Invalid canonical identity prefix: ${prefix}`);
  }
  return {
    ...normalized,
    uri,
    id: `${normalizedPrefix}_${canonicalHash128(uri)}`,
  };
}

/**
 * In-memory registry enforcing one canonical target per alias and one compact ID
 * per canonical URI. All returned identity objects are detached from registry
 * state; caller mutation can never rewrite canonical lookup tables.
 */
export class IdentityRegistry {
  private readonly byUri = new Map<string, CanonicalIdentity>();
  private readonly byId = new Map<string, string>();
  private readonly aliases = new Map<string, string>();

  register(input: CanonicalIdentityInput, prefix = 'cid'): CanonicalIdentity {
    const identity = canonicalIdentity(input, prefix);
    const existing = this.byUri.get(identity.uri);
    if (existing) return cloneIdentity(existing);

    const existingUriForId = this.byId.get(identity.id);
    if (existingUriForId && existingUriForId !== identity.uri) {
      throw new Error(`Deterministic identity collision: ${identity.id} maps to both ${existingUriForId} and ${identity.uri}`);
    }

    const stored = Object.freeze({ ...identity }) as CanonicalIdentity;
    this.byUri.set(stored.uri, stored);
    this.byId.set(stored.id, stored.uri);
    return cloneIdentity(stored);
  }

  addAlias(alias: string, canonical: string): void {
    const canonicalRef = normalizeCanonicalReference(canonical);
    if (!this.byUri.has(canonicalRef)) throw new Error(`Canonical identity ${canonicalRef} is not registered`);
    const normalizedAlias = normalizeAlias(alias);
    if (!normalizedAlias) throw new Error('Identity alias must not be empty');
    if (normalizedAlias === canonicalRef) return;

    const existing = this.aliases.get(normalizedAlias);
    if (existing && existing !== canonicalRef) {
      throw new Error(`Alias collision: ${normalizedAlias} already resolves to ${existing}`);
    }
    this.aliases.set(normalizedAlias, canonicalRef);
  }

  resolve(value: string): CanonicalIdentity | null {
    const raw = normalizeIdentityText(value, 'identity lookup');
    if (!raw) return null;

    const canonicalRef = tryNormalizeCanonicalReference(raw);
    if (canonicalRef && this.byUri.has(canonicalRef)) return cloneIdentity(this.byUri.get(canonicalRef)!);
    if (this.byId.has(raw)) return cloneIdentity(this.byUri.get(this.byId.get(raw)!)!);

    const canonical = this.aliases.get(normalizeAlias(raw));
    return canonical ? cloneIdentity(this.byUri.get(canonical)!) : null;
  }

  listAliases(canonical: string): IdentityAlias[] {
    const canonicalRef = normalizeCanonicalReference(canonical);
    const result: IdentityAlias[] = [];
    for (const [alias, canonicalUriValue] of this.aliases) {
      if (canonicalUriValue === canonicalRef) result.push({ alias, canonicalUri: canonicalRef });
    }
    return result.sort((a, b) => a.alias.localeCompare(b.alias));
  }
}

function serializeCanonical(value: unknown, path: string, seen: Set<object>): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(normalizeUnicode(value, path));
    case 'number':
      if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
      return Object.is(value, -0) ? '0' : String(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'undefined':
    case 'bigint':
    case 'function':
    case 'symbol':
      throw new Error(`${path} contains unsupported canonical type: ${typeof value}`);
    case 'object':
      break;
    default:
      throw new Error(`${path} contains unsupported canonical value`);
  }

  const object = value as object;
  if (seen.has(object)) throw new Error(`${path} contains a cycle`);
  seen.add(object);
  try {
    if (Array.isArray(value)) {
      const names = Object.getOwnPropertyNames(value);
      const extras = names.filter(name => name !== 'length' && !isArrayIndex(name, value.length));
      if (extras.length) throw new Error(`${path} array contains non-index properties: ${extras.join(',')}`);
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) throw new Error(`${path} contains a sparse array hole at ${index}`);
      }
      return `[${value.map((item, index) => serializeCanonical(item, `${path}[${index}]`, seen)).join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains a non-plain object`);
    }
    if (Object.getOwnPropertySymbols(value).length) throw new Error(`${path} contains symbol keys`);

    const originalNames = Object.getOwnPropertyNames(value);
    const normalized = new Map<string, string>();
    for (const original of originalNames) {
      const descriptor = Object.getOwnPropertyDescriptor(value, original);
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        throw new Error(`${path}.${original} is not a plain enumerable data property`);
      }
      const key = normalizeUnicode(original, `${path} key`);
      if (normalized.has(key) && normalized.get(key) !== original) {
        throw new Error(`${path} has Unicode-normalized key collision: ${original}`);
      }
      normalized.set(key, original);
    }

    return `{${Array.from(normalized.keys()).sort().map(key => {
      const original = normalized.get(key)!;
      const child = (value as Record<string, unknown>)[original];
      return `${JSON.stringify(key)}:${serializeCanonical(child, `${path}.${key}`, seen)}`;
    }).join(',')}}`;
  } finally {
    seen.delete(object);
  }
}

function isArrayIndex(value: string, length: number): boolean {
  if (!/^(0|[1-9]\d*)$/.test(value)) return false;
  const index = Number(value);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
}

function normalizeIdentityText(value: string, label: string): string {
  return normalizeUnicode(value, label).trim();
}

function normalizeUnicode(value: string, label: string): string {
  assertWellFormedUnicode(value, label);
  return value.normalize('NFC');
}

function assertWellFormedUnicode(value: string, label: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error(`${label} contains an unpaired high surrogate`);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${label} contains an unpaired low surrogate`);
    }
  }
}

function normalizeAlias(alias: string): string {
  const normalized = normalizeIdentityText(alias, 'identity alias');
  return tryNormalizeCanonicalReference(normalized) ?? normalized;
}

function normalizeCanonicalReference(value: string): string {
  const normalized = tryNormalizeCanonicalReference(value);
  if (!normalized) throw new Error(`Invalid canonical identity URI: ${value}`);
  return normalized;
}

function tryNormalizeCanonicalReference(value: string): string | null {
  const match = /^([a-zA-Z]+):\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(value.trim());
  if (!match) return null;
  const scheme = match[1].toLowerCase() as CanonicalScheme;
  if (!['agentic', 'github', 'chatgpt', 'claude', 'gemini', 'drive', 'custom'].includes(scheme)) return null;
  try {
    return canonicalUri({
      scheme,
      authority: decodeURIComponent(match[2]),
      resourceType: decodeURIComponent(match[3]),
      resourceId: decodeURIComponent(match[4]),
    });
  } catch {
    return null;
  }
}

function cloneIdentity(identity: CanonicalIdentity): CanonicalIdentity {
  return { ...identity };
}
