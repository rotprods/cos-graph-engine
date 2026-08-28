import assert from 'node:assert/strict';
import {
  IdentityRegistry,
  canonicalHash128,
  canonicalIdentity,
  canonicalSerialize,
  canonicalUri,
  sha256Hex,
  stableHash128,
  stableSerialize,
} from '../packages/core/src';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  check(
    canonicalSerialize({ b: 2, a: 1 }) === canonicalSerialize({ a: 1, b: 2 }),
    'canonical object key ordering is deterministic',
  );
  check(canonicalSerialize(-0) === canonicalSerialize(0), '-0 canonicalizes to 0');
  check(
    canonicalSerialize({ text: 'Cafe\u0301' }) === canonicalSerialize({ text: 'Café' }),
    'canonical strings normalize to NFC',
  );
  check(
    canonicalHash128({ z: [1, 2], a: true }) === canonicalHash128({ a: true, z: [1, 2] }),
    'canonical hash is insertion-order independent',
  );

  const nullPrototype = Object.create(null) as Record<string, unknown>;
  nullPrototype.a = 1;
  check(canonicalSerialize(nullPrototype) === '{"a":1}', 'null-prototype plain objects are canonicalizable');

  assert.throws(() => canonicalSerialize(undefined), /unsupported canonical type/); assertions += 1;
  assert.throws(() => canonicalSerialize({ value: undefined }), /unsupported canonical type/); assertions += 1;
  assert.throws(() => canonicalSerialize(1n), /unsupported canonical type/); assertions += 1;
  assert.throws(() => canonicalSerialize(Number.NaN), /non-finite/); assertions += 1;
  assert.throws(() => canonicalSerialize(Number.POSITIVE_INFINITY), /non-finite/); assertions += 1;
  assert.throws(() => canonicalSerialize(new Date('2026-01-01')), /non-plain object/); assertions += 1;
  assert.throws(() => canonicalSerialize(new Map([['a', 1]])), /non-plain object/); assertions += 1;
  assert.throws(() => canonicalSerialize(new Set([1])), /non-plain object/); assertions += 1;
  assert.throws(() => canonicalSerialize({ fn: () => 1 }), /unsupported canonical type/); assertions += 1;

  class Example { value = 1; }
  assert.throws(() => canonicalSerialize(new Example()), /non-plain object/); assertions += 1;

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalSerialize(cyclic), /cycle/); assertions += 1;

  const sparse = new Array(2);
  sparse[1] = 'value';
  assert.throws(() => canonicalSerialize(sparse), /sparse array hole/); assertions += 1;

  const accessor: Record<string, unknown> = {};
  Object.defineProperty(accessor, 'secret', { enumerable: true, get: () => 1 });
  assert.throws(() => canonicalSerialize(accessor), /not a plain enumerable data property/); assertions += 1;

  const keyCollision = { 'Café': 1, 'Cafe\u0301': 2 };
  assert.throws(() => canonicalSerialize(keyCollision), /Unicode-normalized key collision/); assertions += 1;

  // Legacy serializer remains available while authority callers migrate.
  check(stableSerialize(undefined) === 'undefined', 'legacy serializer compatibility remains explicit');
  check(typeof stableHash128(undefined) === 'string', 'legacy stable hash remains available');

  const githubA = canonicalIdentity({
    scheme: 'github',
    authority: 'RotProds',
    resourceType: 'Repository',
    resourceId: 'COS-Graph-Engine',
  }, 'repo');
  const githubB = canonicalIdentity({
    scheme: 'github',
    authority: 'rotprods',
    resourceType: 'repository',
    resourceId: 'cos-graph-engine',
  }, 'repo');
  check(githubA.uri === githubB.uri && githubA.id === githubB.id, 'GitHub repository identity is case-normalized');
  check(githubA.resourceId === 'cos-graph-engine', 'normalized GitHub repository ID is returned to caller');

  const branchUpper = canonicalIdentity({
    scheme: 'github', authority: 'rotprods', resourceType: 'branch', resourceId: 'Feature/A',
  });
  const branchLower = canonicalIdentity({
    scheme: 'github', authority: 'rotprods', resourceType: 'branch', resourceId: 'feature/a',
  });
  check(branchUpper.id !== branchLower.id, 'case-sensitive Git branch resource IDs remain distinct');

  const driveUpper = canonicalIdentity({
    scheme: 'drive', authority: 'google', resourceType: 'document', resourceId: 'AbC123',
  });
  const driveLower = canonicalIdentity({
    scheme: 'drive', authority: 'GOOGLE', resourceType: 'DOCUMENT', resourceId: 'abc123',
  });
  check(driveUpper.id !== driveLower.id, 'opaque Drive resource ID case is preserved');
  check(driveUpper.authority === 'google' && driveUpper.resourceType === 'document', 'provider authority/type normalization is explicit');

  const unicodeA = canonicalIdentity({
    scheme: 'agentic', authority: 'rotprods', resourceType: 'artifact', resourceId: 'Café',
  });
  const unicodeB = canonicalIdentity({
    scheme: 'agentic', authority: 'rotprods', resourceType: 'artifact', resourceId: 'Cafe\u0301',
  });
  check(unicodeA.uri === unicodeB.uri && unicodeA.id === unicodeB.id, 'canonical identity normalizes resource Unicode to NFC');

  const registry = new IdentityRegistry();
  const registered = registry.register({
    scheme: 'github', authority: 'RotProds', resourceType: 'repository', resourceId: 'COS-Graph-Engine',
  }, 'repo');
  const canonical = registered.uri;
  registered.authority = 'mutated';
  registered.resourceId = 'mutated';
  const resolved = registry.resolve('github://ROTPRODS/repository/COS-GRAPH-ENGINE');
  check(resolved?.uri === canonical, 'registry resolution canonicalizes provider URI lookup');
  check(resolved?.authority === 'rotprods' && resolved.resourceId === 'cos-graph-engine', 'caller cannot mutate stored identity');

  registry.addAlias('Cafe\u0301 alias', canonical);
  check(registry.resolve('Café alias')?.uri === canonical, 'alias lookup applies the same Unicode normalization');
  check(registry.listAliases(canonical).some(alias => alias.alias === 'Café alias'), 'alias listing stores normalized alias');

  assert.throws(
    () => registry.addAlias('Café alias', canonicalUri({
      scheme: 'github', authority: 'other', resourceType: 'repository', resourceId: 'repo',
    })),
    /not registered/,
  );
  assertions += 1;

  await assert.rejects(() => sha256Hex(new Date('2026-01-01')), /non-plain object/);
  assertions += 1;
  const shaA = await sha256Hex({ b: 2, a: 'Cafe\u0301' });
  const shaB = await sha256Hex({ a: 'Café', b: 2 });
  check(shaA === shaB, 'SHA-256 integrity uses strict canonical serialization');

  console.log(`Authority identity/serialization contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
