import assert from 'node:assert/strict';
import {
  AuthorityContextPackCompiler,
  AuthorityGraphRAGIndex,
  type AuthorityContextPack,
} from '../packages/graph/src';

const T0 = '2026-08-25T12:00:00.000Z';
const T1 = '2026-08-25T12:00:01.000Z';
const T2 = '2026-08-25T12:00:02.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const index = new AuthorityGraphRAGIndex({ topK: 10, walkDepth: 1 });
  const snapshot = index.replaceProjection({
    version: 1,
    sourceCursor: 'event:4',
    entities: [
      {
        id: 'project-entity',
        name: 'COS Graph Engine',
        type: 'project',
        projectId: 'COS_GRAPH_ENGINE',
        sensitivity: 'internal',
        provenanceRef: 'github://rotprods/cos-graph-engine',
        recordedAt: T0,
      },
      {
        id: 'global-entity',
        name: 'Global Doctrine',
        type: 'source',
        sensitivity: 'public',
        provenanceRef: 'drive://google/document/global-doctrine',
        recordedAt: T0,
      },
      {
        id: 'restricted-entity',
        name: 'Restricted Evidence',
        type: 'artifact',
        projectId: 'COS_GRAPH_ENGINE',
        sensitivity: 'restricted',
        provenanceRef: 'agentic://artifact/restricted',
        recordedAt: T0,
      },
      {
        id: 'future-entity',
        name: 'Future Observation',
        type: 'artifact',
        projectId: 'COS_GRAPH_ENGINE',
        sensitivity: 'internal',
        provenanceRef: 'agentic://artifact/future',
        recordedAt: T2,
      },
    ],
    relations: [],
    chunks: [
      {
        id: 'project-chunk',
        text: 'The reconciled candidate remains SHADOW_ONLY.',
        source: 'github://rotprods/cos-graph-engine/pull/40',
        embedding: [1, 0],
        entities: ['project-entity'],
        projectId: 'COS_GRAPH_ENGINE',
        sensitivity: 'internal',
        provenanceRef: 'github://rotprods/cos-graph-engine/pull/40',
        authority: 1,
        recordedAt: T0,
      },
      {
        id: 'global-chunk',
        text: 'All material changes require provenance and rollback.',
        source: 'drive://google/document/global-doctrine',
        embedding: [0.8, 0.2],
        entities: ['global-entity'],
        sensitivity: 'public',
        provenanceRef: 'drive://google/document/global-doctrine',
        authority: 0.9,
        recordedAt: T0,
      },
      {
        id: 'restricted-chunk',
        text: 'Restricted evidence must never leak into internal context.',
        source: 'agentic://artifact/restricted',
        embedding: [1, 0],
        entities: ['restricted-entity'],
        projectId: 'COS_GRAPH_ENGINE',
        sensitivity: 'restricted',
        provenanceRef: 'agentic://artifact/restricted',
        authority: 1,
        recordedAt: T0,
      },
      {
        id: 'future-chunk',
        text: 'This assertion was not known at the requested knowledge cutoff.',
        source: 'agentic://artifact/future',
        embedding: [1, 0],
        entities: ['future-entity'],
        projectId: 'COS_GRAPH_ENGINE',
        sensitivity: 'internal',
        provenanceRef: 'agentic://artifact/future',
        authority: 1,
        recordedAt: T2,
      },
    ],
  }, { expectedCurrentVersion: 0, expectedCurrentHash: index.projectionHash });

  const compiler = new AuthorityContextPackCompiler(index);
  const request = {
    projectId: 'COS_GRAPH_ENGINE',
    task: 'Continue canonical reconciliation',
    queryEmbedding: [1, 0],
    permission: 'internal' as const,
    asOf: T1,
    knownAt: T1,
    generatedAt: T1,
    expectedProjectionVersion: snapshot.version,
    expectedProjectionHash: snapshot.projectionHash,
    maxTokens: 2_000,
    allowGlobal: true,
  };

  const first = await compiler.compileVerified(request);
  const second = await compiler.compileVerified(request);
  check(first.id === second.id, 'same projection/request produces the same pack ID');
  check(first.evidenceHash === second.evidenceHash, 'same evidence produces the same evidence hash');
  check(first.integrityHash === second.integrityHash, 'same pack produces the same SHA-256 integrity hash');
  check(first.items.some(item => item.chunkId === 'project-chunk'), 'project-scoped evidence is included');
  check(first.items.some(item => item.chunkId === 'global-chunk'), 'explicit global evidence is included');
  check(!first.items.some(item => item.chunkId === 'restricted-chunk'), 'restricted evidence is excluded from internal context');
  check(!first.items.some(item => item.chunkId === 'future-chunk'), 'future system-knowledge evidence is excluded');
  check(first.projectionVersion === index.projectionVersion && first.projectionHash === index.projectionHash, 'pack is fenced to exact projection version/hash');
  await compiler.verify(first);
  assertions += 1;
  compiler.assertCurrent(first);
  assertions += 1;

  assert.throws(() => compiler.compile({ ...request, expectedProjectionVersion: 0 }), /STALE_CONTEXT_PROJECTION/);
  assertions += 1;
  assert.throws(() => compiler.compile({ ...request, expectedProjectionHash: 'wrong' }), /STALE_CONTEXT_PROJECTION_HASH/);
  assertions += 1;

  const tampered: AuthorityContextPack = {
    ...first,
    items: first.items.map(item => ({ ...item })),
    provenance: [...first.provenance],
  };
  tampered.items[0].text = 'tampered';
  await assert.rejects(() => compiler.verify(tampered), /CONTEXT_PACK_INTEGRITY_MISMATCH/);
  assertions += 1;

  const leaked = first.items[0];
  leaked.text = 'caller mutation';
  const third = await compiler.compileVerified(request);
  check(third.items[0].text !== 'caller mutation', 'pack item mutation cannot alter the authority projection');

  console.log(`Authority ContextPack contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
