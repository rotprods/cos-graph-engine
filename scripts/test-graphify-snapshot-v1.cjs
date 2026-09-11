const assert = require('node:assert/strict');

async function main() {
  const {
    GraphifyValidationError,
    validateGraphifySnapshot,
    canonicalizeGraphifySnapshot,
    projectGraphifySnapshot,
  } = await import('../packages/graph/src/graphify-snapshot.ts');

  const sha = 'a'.repeat(64);
  const snapshot = {
    schemaVersion: 'graphify.snapshot.v1',
    generatedAt: '2026-09-11T12:00:00.000Z',
    sourceRoot: '/mnt/data',
    producer: { name: 'openclaw-graphify', version: '1' },
    evidence: [
      { id: 'ev:hash', authority: 'content_hash', ref: `sha256:${sha}`, sha256: sha },
      { id: 'ev:git', authority: 'source_ref', ref: 'git:rotprods/cos-graph-engine@f85fe66b' },
    ],
    nodes: [
      { id: 'n:root', label: '/mnt/data', kind: 'directory', path: '/mnt/data', authority: 'deterministic_topology', metadata: { scan: 'v1' } },
      { id: 'n:checkpoint', label: 'CGEV2 death-safe state', kind: 'checkpoint', path: '/mnt/data/CGEV2/state.json', sha256: sha, authority: 'content_hash', evidenceIds: ['ev:hash'] },
      { id: 'n:model', label: 'qwen3 local', kind: 'model', sourceRef: 'ollama:qwen3', authority: 'source_ref', evidenceIds: ['ev:git'] },
    ],
    edges: [
      { id: 'e:contains', source: 'n:root', target: 'n:checkpoint', type: 'contains', authority: 'deterministic_topology', confidence: 1 },
      { id: 'e:derived', source: 'n:model', target: 'n:checkpoint', type: 'enriched', authority: 'semantic_overlay', confidence: 0.7 },
    ],
    semantic: {
      nodes: [
        { id: 's:checkpoint', concept: 'death-safe checkpoint', type: 'entity', definition: 'Recoverable state machine checkpoint', sourceNodeIds: ['n:checkpoint'], authority: 'semantic_overlay', embedding: [1, 0] },
        { id: 's:model', concept: 'local semantic worker', type: 'class', sourceNodeIds: ['n:model'], authority: 'llm_inference', embedding: [0, 1] },
      ],
      edges: [
        { id: 'se:related', source: 's:model', target: 's:checkpoint', relation: 'related_to', strength: 0.6, authority: 'llm_inference' },
      ],
    },
    chunks: [
      { id: 'c:checkpoint', text: 'Death-safe CGEV2 checkpoint', source: 'CGEV2/state.json', embedding: [1, 0], entityIds: ['n:checkpoint'] },
    ],
  };

  const before = JSON.stringify(snapshot);
  assert.deepEqual(validateGraphifySnapshot(snapshot), []);

  const projected = projectGraphifySnapshot(snapshot);
  assert.deepEqual(projected.diagnostics, []);
  assert.equal(projected.knowledge.entities.length, 3);
  assert.equal(projected.knowledge.relations.length, 2);
  assert.equal(projected.semantic.nodes.length, 2);
  assert.equal(projected.semantic.edges.length, 1);
  assert.equal(projected.embeddings.nodes.length, 2);
  assert.equal(projected.graphrag.chunks.length, 1);
  assert.deepEqual(projected.knowledge.validate(), []);
  assert.deepEqual(projected.semantic.validate(), []);
  assert.deepEqual(projected.embeddings.validate(), []);
  assert.deepEqual(projected.graphrag.validate(), []);

  const checkpoint = projected.knowledge.getEntity('n:checkpoint');
  assert.equal(checkpoint.properties.sha256, sha);
  assert.equal(checkpoint.properties.path, '/mnt/data/CGEV2/state.json');
  const enriched = projected.knowledge.getRelation('e:derived');
  assert.equal(enriched.type, 'related_to');
  assert.equal(enriched.properties.graphifyRelation, 'enriched');
  assert.equal(enriched.properties.authority, 'semantic_overlay');

  // Semantic/LLM text is an annotation only; it cannot rewrite deterministic identity.
  snapshot.semantic.nodes[0].definition = `pretend path=/tmp/fake pretend sha=${'b'.repeat(64)}`;
  const projectedAgain = projectGraphifySnapshot(snapshot);
  assert.equal(projectedAgain.knowledge.getEntity('n:checkpoint').properties.sha256, sha);
  assert.equal(projectedAgain.knowledge.getEntity('n:checkpoint').properties.path, '/mnt/data/CGEV2/state.json');
  snapshot.semantic.nodes[0].definition = 'Recoverable state machine checkpoint';

  // Canonical JSON is stable across top-level input ordering and must not mutate callers.
  const canonicalA = canonicalizeGraphifySnapshot(snapshot);
  const reordered = structuredClone(snapshot);
  reordered.nodes.reverse();
  reordered.edges.reverse();
  reordered.evidence.reverse();
  reordered.semantic.nodes.reverse();
  reordered.chunks.reverse();
  const canonicalB = canonicalizeGraphifySnapshot(reordered);
  assert.equal(canonicalA, canonicalB);
  assert.equal(JSON.stringify(snapshot), before);

  function expectInvalid(mutator, pattern) {
    const bad = structuredClone(snapshot);
    mutator(bad);
    const errors = validateGraphifySnapshot(bad);
    assert.ok(errors.length > 0, 'expected validation errors');
    assert.match(errors.join('\n'), pattern);
    assert.throws(() => projectGraphifySnapshot(bad), GraphifyValidationError);
  }

  expectInvalid(s => s.nodes.push({ ...s.nodes[0] }), /Duplicate node ID/);
  expectInvalid(s => { s.edges[0].target = 'n:missing'; }, /unknown target/);
  expectInvalid(s => { s.nodes[1].sha256 = 'not-a-sha'; }, /SHA-256/);
  expectInvalid(s => { s.semantic.nodes[0].sourceNodeIds = ['n:missing']; }, /unknown source node/);
  expectInvalid(s => { s.semantic.nodes[1].embedding = [0, 1, 2]; }, /embedding dimension/);
  expectInvalid(s => { s.chunks[0].entityIds = ['n:missing']; }, /unknown entity/);
  expectInvalid(s => { s.edges[0].confidence = 2; }, /confidence/);
  expectInvalid(s => { s.semantic.edges[0].strength = -0.1; }, /strength/);
  expectInvalid(s => { s.generatedAt = 'not-a-time'; }, /generatedAt/);

  const invalidVector = structuredClone(snapshot);
  invalidVector.chunks[0].embedding = [1, Number.NaN];
  assert.match(validateGraphifySnapshot(invalidVector).join('\n'), /finite/);

  process.stdout.write(JSON.stringify({
    suite: 'graphify-snapshot-v1',
    status: 'PASS',
    deterministicNodes: projected.knowledge.entities.length,
    deterministicEdges: projected.knowledge.relations.length,
    semanticNodes: projected.semantic.nodes.length,
    embeddingNodes: projected.embeddings.nodes.length,
    chunks: projected.graphrag.chunks.length,
  }, null, 2) + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
