import { canonicalSerialize } from './identity';

export type IntegrityHashAlgorithm = 'sha256' | 'fnv128-legacy';

/**
 * Cryptographic integrity hash for snapshots, evidence manifests and artifacts.
 *
 * Integrity uses the strict canonical serializer: unsupported JS objects,
 * undefined values, sparse arrays, accessors, cycles and non-finite numbers fail
 * closed instead of collapsing into ambiguous evidence. Compact deterministic
 * identity hashes remain a separate concern.
 */
export async function sha256Hex(value: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 integrity hashing requires WebCrypto subtle API');
  const bytes = new TextEncoder().encode(canonicalSerialize(value));
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
