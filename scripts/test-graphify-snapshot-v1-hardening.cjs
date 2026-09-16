const assert = require('node:assert/strict');

async function main() {
  const {
    GraphifyValidationError,
    validateGraphifySnapshot,
    canonicalizeGraphifySnapshot,
    projectGraphifySnapshot,
  } = await import('../packages/graph/src/graphify-snapshot.ts');

  const base = () => ({
    schemaVersion: 'graphify.snapshot.v1',
    generatedAt: '2026-09-16T10:00:00.000Z',
    sourceRoot: '/authority-safe',
    evidence: [],
    nodes: [
      { id: '__proto__', label: 'proto-node', kind: 'file', authority: 'deterministic_topology' },
      { id: 'n:target', label: 'target', kind: 'file', authority: 'deterministic_topology' },
    ],
    edges: [
      { id: '__proto__', source: '__proto__', target: 'n:target', type: 'contains', authority: 'deterministic_topology' },
    ],
    semantic: {
      nodes: [
        { id: '__proto__', concept: 'semantic proto', type: 'entity', sourceNodeIds: ['__proto__'], authority: 'semantic_overlay', embedding: [1, 0] },
        { id: 's:target', concept: 'semantic target', type: 'entity', sourceNodeIds: ['n:target'], authority: 'semantic_overlay', embedding: [0, 1] },
      ],
      edges: [
        { id: '__proto__', source: '__proto__', target: 's:target', relation: 'related_to', strength: 1, authority: 'semantic_overlay' },
      ],
    },
    chunks: [
      { id: '__proto__', text: 'proto chunk', source: 'fixture', embedding: [1, 0], entityIds: ['__proto__'] },
    ],
  });

  const projected = projectGraphifySnapshot(base());
  for (const [label, table] of Object.entries(projected.provenance)) {
    assert.equal(Object.getPrototypeOf(table), null, `${label} provenance table must have a null prototype`);
    assert.equal(Object.prototype.hasOwnProperty.call(table, '__proto__'), true, `${label} must preserve __proto__ as an own key`);
  }
  assert.equal(Object.prototype.polluted, undefined);

  const protoMetadata = JSON.parse('{"__proto__":{"polluted":"no"},"z":1,"a":2}');
  const metadataSnapshot = base();
  metadataSnapshot.nodes[0].metadata = protoMetadata;
  const canonical = canonicalizeGraphifySnapshot(metadataSnapshot);
  assert.match(canonical, /"__proto__":\{"polluted":"no"\}/);
  const projectedMetadata = projectGraphifySnapshot(metadataSnapshot);
  assert.equal(
    projectedMetadata.knowledge.getEntity('__proto__').properties.metadata,
    '{"__proto__":{"polluted":"no"},"a":2,"z":1}',
  );
  assert.equal(Object.prototype.polluted, undefined);

  const circularArraySnapshot = base();
  const loop = [];
  loop.push(loop);
  circularArraySnapshot.nodes[0].metadata = { loop };
  const circularErrors = validateGraphifySnapshot(circularArraySnapshot);
  assert.match(circularErrors.join('\n'), /circular reference/);
  assert.throws(() => projectGraphifySnapshot(circularArraySnapshot), GraphifyValidationError);

  for (const badValue of [new Date('2026-09-16T00:00:00Z'), new Map([['x', 1]]), new Set([1])]) {
    const snapshot = base();
    snapshot.nodes[0].metadata = { badValue };
    const errors = validateGraphifySnapshot(snapshot);
    assert.match(errors.join('\n'), /non-plain JSON object/);
    assert.throws(() => canonicalizeGraphifySnapshot(snapshot), GraphifyValidationError);
  }

  const shared = { stable: true };
  const sharedSnapshot = base();
  sharedSnapshot.nodes[0].metadata = { left: shared, right: shared };
  assert.deepEqual(validateGraphifySnapshot(sharedSnapshot), []);
  assert.doesNotThrow(() => canonicalizeGraphifySnapshot(sharedSnapshot));

  process.stdout.write(JSON.stringify({
    suite: 'graphify-snapshot-v1-hardening',
    status: 'PASS',
    provenanceTablesProtected: 5,
    prototypeSensitiveMetadataPreserved: true,
    circularArraysFailClosed: true,
    nonPlainObjectsFailClosed: true,
  }, null, 2) + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
