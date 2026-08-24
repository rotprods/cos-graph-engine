import { stableSerialize } from './identity';

export type IntegrityHashAlgorithm = 'sha256' | 'fnv128-legacy';

/**
 * Cryptographic integrity hash for snapshots, evidence manifests and artifacts.
 *
 * Deterministic identity (`stableHash128`) and integrity are intentionally
 * separate concepts. SHA-256 is asynchronous so the core can use WebCrypto in
 * Node >=18 and modern browser runtimes without coupling @cos/core to node:crypto.
 */
export async function sha256Hex(value: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('SHA-256 integrity hashing requires WebCrypto subtle API');
  }
  const bytes = new TextEncoder().encode(stableSerialize(value));
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
