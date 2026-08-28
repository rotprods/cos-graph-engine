import assert from 'node:assert/strict';
import {
  AuthorityGraphRAGIndex,
  authorityGraphToLegacyReadSnapshot,
} from '../packages/graph/src';
import {
  AuthorityAgenticRegistry,
  AuthorityHub,
  authorityAgenticToLegacyReadSnapshot,
  authorityHubToLegacyRepositorySnapshot,
} from '../packages/hub/src';

const T0 = '2026-08-28T09:00:00.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const graph = new AuthorityGraphRAGIndex();
  graph.replaceProjection({
    version: 1,
    entities: [{
      id: 'project',
      name: 'COS',
      type: 'project',
      projectId: 'COS',
      sensitivity: 'internal',
      provenanceRef: 'github://rotprods/cos-graph-engine',
      recordedAt: T0,
    }],
    relations: [],
    chunks: [{
      id: 'chunk',
      text: 'authority evidence',
      source: 'github://rotprods/cos-graph-engine',
      embedding: [1, 0],
      entities: ['project'],
      projectId: 'COS',
      sensitivity: 'internal',
      provenanceRef: 'github://rotprods/cos-graph-engine',
      authority: 1,
      recordedAt: T0,
    }],
  });
  const legacyGraph = authorityGraphToLegacyReadSnapshot(graph);
  legacyGraph.entities[0].name = 'mutated';
  legacyGraph.chunks[0].text = 'mutated';
  legacyGraph.chunks[0].embedding[0] = 999;
  const graphAfter = graph.snapshot();
  check(graphAfter.entities[0].name === 'COS', 'Graph compatibility snapshot cannot mutate authority entity');
  check(graphAfter.chunks[0].text === 'authority evidence', 'Graph compatibility snapshot cannot mutate authority chunk');
  check(graphAfter.chunks[0].embedding[0] === 1, 'Graph compatibility embedding is detached');

  const registry = new AuthorityAgenticRegistry();
  const resource = registry.addResource({
    identity: { scheme: 'agentic', authority: 'rotprods', resourceType: 'project', resourceId: 'COS' },
    type: 'project',
    title: 'COS',
    projectId: 'COS',
    sensitivity: 'internal',
    provenanceRef: 'github://rotprods/cos-graph-engine',
    recordedAt: T0,
    metadata: { phase: 2 },
  });
  const legacyAgentic = authorityAgenticToLegacyReadSnapshot(registry, {
    projectId: 'COS',
    maxSensitivity: 'internal',
    asOf: T0,
    knownAt: T0,
  });
  legacyAgentic.resources[0].title = 'mutated';
  legacyAgentic.resources[0].metadata.phase = 999;
  const registryAfter = registry.getResource(resource.id, { knownAt: T0, maxSensitivity: 'internal' });
  check(registryAfter?.title === 'COS', 'Agentic compatibility snapshot cannot mutate authority title');
  check(registryAfter?.metadata.phase === 2, 'Agentic compatibility metadata is detached');

  const hub = new AuthorityHub();
  const repository = await hub.registerRepository({
    owner: 'rotprods',
    name: 'cos-graph-engine',
    projectId: 'COS',
    metadata: { branch: 'phase-02' },
    idempotencyKey: 'register-cos',
    correlationId: 'phase-02',
    sourceRef: 'github://rotprods/cos-graph-engine',
    occurredAt: T0,
    recordedAt: T0,
  });
  const legacyRepos = authorityHubToLegacyRepositorySnapshot(hub);
  legacyRepos[0].state = 'DEAD';
  legacyRepos[0].metadata.branch = 'mutated';
  const hubAfter = hub.getRepository(repository.id);
  check(hubAfter?.state === 'PENDING', 'Hub compatibility snapshot cannot mutate authority state');
  check(hubAfter?.metadata.branch === 'phase-02', 'Hub compatibility metadata is detached');

  console.log(`Authority read-only compatibility contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
