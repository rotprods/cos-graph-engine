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

/**
 * Maximum object/array nesting accepted by the authority serializer.
 *
 * This is a denial-of-service boundary, not a data-model recommendation.
 * Primitive leaves at or below this depth remain valid.
 */
export const MAX_CANONICAL_DEPTH = 128;

/**
 * Strict deterministic serializer for authority identity/dedup input.
 *
 * This function intentionally performs no optional-field coercion. Callers
 * must construct explicit JSON-like values before entering this boundary.
 * Accessors are rejected from descriptors and are never evaluated.
 */
export function canonicalSerialize(value: unknown): string {
  return serializeCanonical(value, '$', new Set<object>(), 0);
}

/**
 * Compact deterministic 128-bit identity hash over canonical serialization.
 *
 * SECURITY: this is two FNV-1a 64-bit lanes. It is suitable for stable IDs,
 * deduplication and non-adversarial content identity only. It is NOT a
 * cryptographic integrity/authenticity primitive. Use a cryptographic digest
 * at evidence/signing boundaries.
 */
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
  const authority = normalizeIdentityText(input.authority, 'authority').toLowerCase();
  const resourceType = normalizeIdentityText(input.resourceType, 'resourceType').toLowerCase();
  let resourceId = normalizeIdentityText(input.resourceId, 'resourceId');

  if (!authority) throw new Error('Canonical identity authority must not be empty');
  if (!resourceType) throw new Error('Canonical identity resourceType must not be empty');
  if (!resourceId) throw new Error('Canonical identity resourceId must not be empty');

  if (scheme === 'github' && GITHUB_CASE_INSENSITIVE_RESOURCE_TYPES.has(resourceType)) {
    resourceId = resourceId.toLowerCase();
  }

  return { scheme, authority, resourceType, resourceId };
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

function serializeCanonical(
  value: unknown,
  path: string,
  seen: Set<object>,
  depth: number,
): string {
  if (depth > MAX_CANONICAL_DEPTH) {
    throw new Error(`${path} exceeds maximum canonical nesting depth ${MAX_CANONICAL_DEPTH}`);
  }

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
      return serializeArray(value, path, seen, depth);
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains a non-plain object`);
    }

    return serializePlainObject(value as Record<string, unknown>, path, seen, depth);
  } finally {
    seen.delete(object);
  }
}

function serializeArray(
  value: unknown[],
  path: string,
  seen: Set<object>,
  depth: number,
): string {
  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key === 'symbol') {
      throw new Error(`${path} contains a symbol-keyed array property`);
    }
    if (!isArrayIndex(key, value.length)) {
      throw new Error(`${path} contains non-index array property '${key}'`);
    }
  }

  const serialized: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor) throw new Error(`${path} contains a sparse array hole at ${index}`);
    if (!descriptor.enumerable) throw new Error(`${path}[${index}] is non-enumerable`);
    if (!('value' in descriptor)) throw new Error(`${path}[${index}] uses an accessor`);
    serialized.push(serializeCanonical(descriptor.value, `${path}[${index}]`, seen, depth + 1));
  }

  return `[${serialized.join(',')}]`;
}

function serializePlainObject(
  value: Record<string, unknown>,
  path: string,
  seen: Set<object>,
  depth: number,
): string {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const normalizedToOriginal = new Map<string, string>();

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') throw new Error(`${path} contains a symbol key`);

    const descriptor = descriptors[key];
    if (!descriptor) throw new Error(`${path}.${key} has no property descriptor`);
    if (!descriptor.enumerable) throw new Error(`${path}.${key} is non-enumerable`);
    if (!('value' in descriptor)) throw new Error(`${path}.${key} uses an accessor`);

    const normalized = normalizeUnicode(key, `${path} key`);
    const previous = normalizedToOriginal.get(normalized);
    if (previous !== undefined && previous !== key) {
      throw new Error(`${path} has Unicode-normalized key collision: ${previous}/${key}`);
    }
    normalizedToOriginal.set(normalized, key);
  }

  const parts = Array.from(normalizedToOriginal.keys())
    .sort()
    .map(normalizedKey => {
      const originalKey = normalizedToOriginal.get(normalizedKey);
      if (originalKey === undefined) throw new Error(`${path} lost canonical key mapping`);
      const descriptor = descriptors[originalKey];
      if (!descriptor || !('value' in descriptor)) {
        throw new Error(`${path}.${originalKey} changed during canonical serialization`);
      }
      return `${JSON.stringify(normalizedKey)}:${serializeCanonical(
        descriptor.value,
        `${path}.${normalizedKey}`,
        seen,
        depth + 1,
      )}`;
    });

  return `{${parts.join(',')}}`;
}

function isArrayIndex(value: string, length: number): boolean {
  if (!/^(0|[1-9]\d*)$/.test(value)) return false;
  const index = Number(value);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
}

function fnv1a64(input: string, offset: bigint): bigint {
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  let hash = offset & mask;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
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
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error(`${label} contains an unpaired high surrogate`);
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${label} contains an unpaired low surrogate`);
    }
  }
}