const assert = require('node:assert/strict');

async function main() {
  const {
    MAX_CANONICAL_DEPTH,
    canonicalHash128,
    canonicalIdentity,
    canonicalSerialize,
    canonicalUri,
  } = await import('../packages/core/src/index.ts');

  assert.equal(MAX_CANONICAL_DEPTH, 128);

  assert.equal(
    canonicalSerialize({ z: 1, a: 2, middle: { y: true, x: false } }),
    '{"a":2,"middle":{"x":false,"y":true},"z":1}',
  );
  assert.equal(canonicalSerialize(-0), '0');
  assert.equal(canonicalSerialize('e\u0301'), canonicalSerialize('\u00e9'));

  const firstHash = canonicalHash128({ z: 1, a: 2 });
  const secondHash = canonicalHash128({ a: 2, z: 1 });
  assert.equal(firstHash, secondHash);
  assert.match(firstHash, /^[0-9a-f]{32}$/);

  const collidingKeys = {};
  Object.defineProperty(collidingKeys, 'e\u0301', { enumerable: true, value: 1 });
  Object.defineProperty(collidingKeys, '\u00e9', { enumerable: true, value: 2 });
  assert.throws(() => canonicalSerialize(collidingKeys), /Unicode-normalized key collision/);

  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'trap', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return 'must-not-run';
    },
  });
  assert.throws(() => canonicalSerialize(accessor), /uses an accessor/);
  assert.equal(getterCalls, 0, 'canonicalSerialize must reject accessors without invoking them');

  const symbolKey = { visible: true };
  symbolKey[Symbol('hidden')] = 'nope';
  assert.throws(() => canonicalSerialize(symbolKey), /symbol key/);

  const nonEnumerable = {};
  Object.defineProperty(nonEnumerable, 'hidden', { enumerable: false, value: 1 });
  assert.throws(() => canonicalSerialize(nonEnumerable), /non-enumerable/);

  const sparse = [];
  sparse.length = 2;
  sparse[1] = 'present';
  assert.throws(() => canonicalSerialize(sparse), /sparse array hole/);

  const extraArrayProperty = [1];
  extraArrayProperty.extra = 2;
  assert.throws(() => canonicalSerialize(extraArrayProperty), /non-index array property/);

  const arrayAccessor = [1];
  let arrayGetterCalls = 0;
  Object.defineProperty(arrayAccessor, '0', {
    enumerable: true,
    configurable: true,
    get() {
      arrayGetterCalls += 1;
      return 1;
    },
  });
  assert.throws(() => canonicalSerialize(arrayAccessor), /uses an accessor/);
  assert.equal(arrayGetterCalls, 0, 'array accessor must not execute');

  class Example {
    constructor() {
      this.value = 1;
    }
  }
  for (const bad of [new Date('2026-09-16T00:00:00.000Z'), new Map([['x', 1]]), new Set([1]), new Example()]) {
    assert.throws(() => canonicalSerialize(bad), /non-plain object/);
  }

  for (const bad of [undefined, 1n, () => true, Symbol('x')]) {
    assert.throws(() => canonicalSerialize(bad), /unsupported canonical type/);
  }
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.throws(() => canonicalSerialize(bad), /non-finite number/);
  }

  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalSerialize(cyclic), /contains a cycle/);

  assert.throws(() => canonicalSerialize('\ud800'), /unpaired high surrogate/);
  assert.throws(() => canonicalSerialize('\udc00'), /unpaired low surrogate/);
  const malformedKey = {};
  Object.defineProperty(malformedKey, '\ud800', { enumerable: true, value: 1 });
  assert.throws(() => canonicalSerialize(malformedKey), /unpaired high surrogate/);

  const atLimit = {};
  let atCursor = atLimit;
  for (let depth = 0; depth < MAX_CANONICAL_DEPTH; depth += 1) {
    const next = {};
    atCursor.next = next;
    atCursor = next;
  }
  assert.doesNotThrow(() => canonicalSerialize(atLimit));

  const tooDeep = {};
  let deepCursor = tooDeep;
  for (let depth = 0; depth <= MAX_CANONICAL_DEPTH; depth += 1) {
    const next = {};
    deepCursor.next = next;
    deepCursor = next;
  }
  assert.throws(
    () => canonicalSerialize(tooDeep),
    new RegExp(`exceeds maximum canonical nesting depth ${MAX_CANONICAL_DEPTH}`),
  );

  const shared = { stable: true };
  assert.doesNotThrow(() => canonicalSerialize({ left: shared, right: shared }));

  const github = canonicalIdentity({
    scheme: 'github',
    authority: 'GitHub.COM',
    resourceType: 'Repository',
    resourceId: 'RotProds/COS-Graph-Engine',
  }, 'repo');
  assert.equal(github.authority, 'github.com');
  assert.equal(github.resourceType, 'repository');
  assert.equal(github.resourceId, 'rotprods/cos-graph-engine');
  assert.equal(github.uri, 'github://github.com/repository/rotprods%2Fcos-graph-engine');
  assert.match(github.id, /^repo_[0-9a-f]{32}$/);
  assert.equal(
    github.uri,
    canonicalUri({
      scheme: 'github',
      authority: ' github.com ',
      resourceType: 'repository',
      resourceId: 'ROTPRODS/COS-GRAPH-ENGINE',
    }),
  );

  const custom = canonicalIdentity({
    scheme: 'custom',
    authority: 'EXAMPLE',
    resourceType: 'Artifact',
    resourceId: 'Case/Sensitive',
  });
  assert.equal(custom.authority, 'example');
  assert.equal(custom.resourceType, 'artifact');
  assert.equal(custom.resourceId, 'Case/Sensitive');
  assert.throws(() => canonicalIdentity({
    scheme: 'custom',
    authority: 'example',
    resourceType: 'artifact',
    resourceId: 'x',
  }, 'bad prefix!'), /Invalid canonical identity prefix/);

  process.stdout.write(JSON.stringify({
    suite: 'authority-core-identity',
    status: 'PASS',
    maximumCanonicalDepth: MAX_CANONICAL_DEPTH,
    deterministicOrdering: true,
    unicodeNfc: true,
    accessorsRejectedWithoutExecution: getterCalls === 0 && arrayGetterCalls === 0,
    unsupportedJavascriptShapesFailClosed: true,
    canonicalIdentityNormalized: true,
    compactHashPurpose: 'identity-dedup-only-not-cryptographic-integrity',
  }, null, 2) + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});