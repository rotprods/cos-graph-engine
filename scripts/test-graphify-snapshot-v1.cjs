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
      { id: 'n:checkpoint', label: 'CGEV2 death-safe state', kind: 'checkpoint', path: '/mnt/data/CGEV2/state.json', sha256: sha, size: 42, authority: 'content_hash', evidenceIds: ['ev:hash'] },
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
  assert.equal(checkpoint.properties.size, '42');
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

  // Canonical JSON is stable across input ordering and must not mutate callers.
  const canonicalA = canonicalizeGraphifySnapshot(snapshot);
  const reordered = structuredClone(snapshot);
  reordered.nodes.reverse();
  reordered.edges.reverse();
  reordered.evidence.reverse();
  reordered.semantic.nodes.reverse();
  reordered.semantic.edges.reverse();
  reordered.chunks.reverse();
  const canonicalB = canonicalizeGraphifySnapshot(reordered);
  assert.equal(canonicalA, canonicalB);
  assert.equal(JSON.stringify(snapshot), before);

  // Exercise the full deterministic type/relation normalization surface while
  // proving that the original graphify vocabulary survives in provenance/properties.
  const mappingSnapshot = structuredClone(snapshot);
  mappingSnapshot.nodes.push(
    { id: 'n:artifact', label: 'artifact', kind: 'artifact', authority: 'deterministic_topology' },
    { id: 'n:git', label: 'git', kind: 'git', authority: 'source_ref' },
    { id: 'n:runtime', label: 'runtime', kind: 'runtime', authority: 'source_ref' },
    { id: 'n:file', label: 'file', kind: 'file', authority: 'deterministic_topology' },
    { id: 'n:concept', label: 'concept', kind: 'concept', authority: 'semantic_overlay' },
    { id: 'n:unknown', label: 'unknown', kind: 'unknown', authority: 'llm_inference' },
  );
  mappingSnapshot.edges.push(
    { id: 'e:canonical', source: 'n:root', target: 'n:artifact', type: 'uses', authority: 'deterministic_topology' },
    { id: 'e:depends', source: 'n:root', target: 'n:git', type: 'depends_on', authority: 'deterministic_topology' },
    { id: 'e:generated', source: 'n:runtime', target: 'n:artifact', type: 'generated_by', authority: 'deterministic_topology' },
    { id: 'e:derived-from', source: 'n:file', target: 'n:artifact', type: 'derived_from', authority: 'deterministic_topology' },
    { id: 'e:member', source: 'n:file', target: 'n:root', type: 'member_of', authority: 'deterministic_topology' },
  );
  mappingSnapshot.semantic.nodes.push({
    id: 's:no-vector', concept: 'annotation only', type: 'entity', sourceNodeIds: ['n:file'], authority: 'semantic_overlay',
  });
  mappingSnapshot.semantic.edges.push({
    id: 'se:unknown-vocab', source: 's:no-vector', target: 's:checkpoint', relation: 'evidenced_by', strength: 1, authority: 'semantic_overlay',
  });
  const mapped = projectGraphifySnapshot(mappingSnapshot);
  assert.equal(mapped.knowledge.getEntity('n:artifact').type, 'product');
  assert.equal(mapped.knowledge.getEntity('n:git').type, 'system');
  assert.equal(mapped.knowledge.getEntity('n:runtime').type, 'system');
  assert.equal(mapped.knowledge.getEntity('n:file').type, 'concept');
  assert.equal(mapped.knowledge.getEntity('n:concept').type, 'concept');
  assert.equal(mapped.knowledge.getEntity('n:unknown').type, 'concept');
  assert.equal(mapped.knowledge.getRelation('e:canonical').type, 'uses');
  assert.equal(mapped.knowledge.getRelation('e:depends').type, 'uses');
  assert.equal(mapped.knowledge.getRelation('e:generated').type, 'produced_by');
  assert.equal(mapped.knowledge.getRelation('e:derived-from').type, 'produced_by');
  assert.equal(mapped.knowledge.getRelation('e:member').type, 'part_of');
  assert.equal(mapped.semantic.edges.find(edge => edge.id === 'se:unknown-vocab').relation, 'related_to');
  assert.equal(mapped.provenance.semanticEdges['se:unknown-vocab'].originalType, 'evidenced_by');
  assert.equal(mapped.embeddings.nodes.some(node => node.id === 's:no-vector'), false);

  // Optional semantic/chunk layers are valid and project to empty higher layers.
  const topologyOnly = {
    schemaVersion: 'graphify.snapshot.v1',
    generatedAt: '2026-09-11T12:00:00.000Z',
    sourceRoot: '/tmp/topology-only',
    evidence: [],
    nodes: [{ id: 'n:only', label: 'only', kind: 'file', authority: 'deterministic_topology' }],
    edges: [],
  };
  assert.deepEqual(validateGraphifySnapshot(topologyOnly), []);
  const topologyProjection = projectGraphifySnapshot(topologyOnly);
  assert.equal(topologyProjection.semantic.nodes.length, 0);
  assert.equal(topologyProjection.embeddings.nodes.length, 0);
  assert.equal(topologyProjection.graphrag.chunks.length, 0);
  assert.doesNotThrow(() => canonicalizeGraphifySnapshot(topologyOnly));

  function expectInvalid(mutator, pattern) {
    const bad = structuredClone(snapshot);
    mutator(bad);
    const errors = validateGraphifySnapshot(bad);
    assert.ok(errors.length > 0, 'expected validation errors');
    assert.match(errors.join('\n'), pattern);
    assert.throws(() => projectGraphifySnapshot(bad), GraphifyValidationError);
  }

  // Identity, schema and evidence failures.
  expectInvalid(s => { s.schemaVersion = 'graphify.snapshot.v2'; }, /Unsupported schemaVersion/);
  expectInvalid(s => { s.sourceRoot = ''; }, /sourceRoot/);
  expectInvalid(s => { s.generatedAt = 'not-a-time'; }, /generatedAt/);
  expectInvalid(s => s.evidence.push({ ...s.evidence[0] }), /Duplicate evidence ID/);
  expectInvalid(s => { s.evidence[0].id = ''; }, /evidence has an empty ID/);
  expectInvalid(s => { s.evidence[0].authority = 'invalid'; }, /Evidence .* invalid authority/);
  expectInvalid(s => { s.evidence[0].ref = ''; }, /ref must be non-empty/);
  expectInvalid(s => { s.evidence[0].sha256 = 'not-a-sha'; }, /malformed SHA-256/);

  // Deterministic node/edge authority failures.
  expectInvalid(s => s.nodes.push({ ...s.nodes[0] }), /Duplicate node ID/);
  expectInvalid(s => { s.nodes[0].label = ''; }, /label must be non-empty/);
  expectInvalid(s => { s.nodes[0].authority = 'invalid'; }, /Node .* invalid authority/);
  expectInvalid(s => { s.nodes[1].sha256 = 'not-a-sha'; }, /SHA-256/);
  expectInvalid(s => { s.nodes[1].size = -1; }, /size must be/);
  expectInvalid(s => { s.nodes[1].evidenceIds = ['ev:missing']; }, /unknown evidence/);
  expectInvalid(s => { s.edges[0].source = 'n:missing'; }, /unknown source/);
  expectInvalid(s => { s.edges[0].target = 'n:missing'; }, /unknown target/);
  expectInvalid(s => { s.edges[0].type = ''; }, /type must be non-empty/);
  expectInvalid(s => { s.edges[0].authority = 'invalid'; }, /Edge .* invalid authority/);
  expectInvalid(s => { s.edges[0].confidence = Number.NaN; }, /confidence/);
  expectInvalid(s => { s.edges[0].confidence = 2; }, /confidence/);
  expectInvalid(s => { s.edges[0].evidenceIds = ['ev:missing']; }, /unknown evidence/);
  expectInvalid(s => s.edges.push({ ...s.edges[0] }), /Duplicate edge ID/);

  // Semantic authority / vector failures.
  expectInvalid(s => s.semantic.nodes.push({ ...s.semantic.nodes[0] }), /Duplicate semantic node ID/);
  expectInvalid(s => { s.semantic.nodes[0].concept = ''; }, /concept must be non-empty/);
  expectInvalid(s => { s.semantic.nodes[0].authority = 'invalid'; }, /Semantic node .* invalid authority/);
  expectInvalid(s => { s.semantic.nodes[0].sourceNodeIds = ['n:missing']; }, /unknown source node/);
  expectInvalid(s => { s.semantic.nodes[0].evidenceIds = ['ev:missing']; }, /unknown evidence/);
  expectInvalid(s => { s.semantic.nodes[1].embedding = [0, 1, 2]; }, /embedding dimension/);
  expectInvalid(s => { s.semantic.nodes[1].embedding = []; }, /finite numbers/);
  expectInvalid(s => s.semantic.edges.push({ ...s.semantic.edges[0] }), /Duplicate semantic edge ID/);
  expectInvalid(s => { s.semantic.edges[0].source = 's:missing'; }, /unknown source/);
  expectInvalid(s => { s.semantic.edges[0].target = 's:missing'; }, /unknown target/);
  expectInvalid(s => { s.semantic.edges[0].relation = ''; }, /relation must be non-empty/);
  expectInvalid(s => { s.semantic.edges[0].strength = -0.1; }, /strength/);
  expectInvalid(s => { s.semantic.edges[0].authority = 'invalid'; }, /Semantic edge .* invalid authority/);
  expectInvalid(s => { s.semantic.edges[0].evidenceIds = ['ev:missing']; }, /unknown evidence/);

  // Chunk and JSON-safety failures.
  expectInvalid(s => s.chunks.push({ ...s.chunks[0] }), /Duplicate chunk ID/);
  expectInvalid(s => { s.chunks[0].text = ''; }, /text must be non-empty/);
  expectInvalid(s => { s.chunks[0].source = ''; }, /source must be non-empty/);
  expectInvalid(s => { s.chunks[0].embedding = []; }, /finite numbers/);
  expectInvalid(s => { s.chunks[0].embedding = [1, Number.NaN]; }, /finite/);
  expectInvalid(s => { s.chunks[0].entityIds = ['n:missing']; }, /unknown entity/);
  expectInvalid(s => { s.chunks[0].authority = 'invalid'; }, /Chunk .* invalid authority/);
  expectInvalid(s => { s.chunks[0].evidenceIds = ['ev:missing']; }, /unknown evidence/);
  expectInvalid(s => { s.nodes[0].metadata.bad = Number.POSITIVE_INFINITY; }, /non-finite number/);
  expectInvalid(s => { s.nodes[0].metadata.bad = undefined; }, /non-JSON value/);
  expectInvalid(s => { s.nodes[0].metadata.bad = 1n; }, /non-JSON value/);
  expectInvalid(s => { s.nodes[0].metadata.bad = () => 1; }, /non-JSON value/);

  const circular = structuredClone(snapshot);
  circular.nodes[0].metadata.loop = circular.nodes[0].metadata;
  assert.match(validateGraphifySnapshot(circular).join('\n'), /circular reference/);
  assert.throws(() => projectGraphifySnapshot(circular), GraphifyValidationError);

  process.stdout.write(JSON.stringify({
    suite: 'graphify-snapshot-v1',
    status: 'PASS',
    deterministicNodes: projected.knowledge.entities.length,
    deterministicEdges: projected.knowledge.relations.length,
    semanticNodes: projected.semantic.nodes.length,
    embeddingNodes: projected.embeddings.nodes.length,
    chunks: projected.graphrag.chunks.length,
    authorityFailureFamiliesExercised: 40,
  }, null, 2) + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
