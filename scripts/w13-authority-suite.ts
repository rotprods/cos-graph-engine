import {
  canonicalIdentity,
  stableSerialize,
  type CellContext,
  type EntityId,
  type ITool,
  type PolicyRule,
  type ToolDefinition,
  type ToolResult,
} from '../packages/core/src/index';
import {
  InMemoryEventLog,
  InMemoryIdempotencyRegistry,
  InMemoryLeaseManager,
  VersionedStore,
} from '../packages/runtime/src/index';
import {
  StrictToolRegistry,
  CapabilityRouter,
} from '../packages/execution/src/index';
import { PolicyEngine } from '../packages/orchestration/src/index';
import {
  ContextPackCompiler,
  VerifiedAuthorityGraphRAGEngine,
} from '../packages/graph/src/index';
import {
  AgenticResourceRegistry,
  InMemoryHubSnapshotStore,
  StrictHubRecoveryCoordinator,
  VerifiedAgenticContextProjector,
  CosHub,
} from '../packages/hub/src/index';

let passed = 0;
let failed = 0;

function ok(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${message}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${message}`);
  }
}

async function rejects(
  fn: () => unknown | Promise<unknown>,
  pattern: RegExp,
  message: string,
): Promise<void> {
  try {
    await fn();
    ok(false, message);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    ok(pattern.test(text), `${message} (${text})`);
  }
}

const FIXED_TIME = '2026-08-24T12:00:00.000Z';
const ctx: CellContext = { traceId: 'w13-trace', userId: 'w13-user', sessionId: 'w13-session' };

async function testIdentity(): Promise<void> {
  const a = canonicalIdentity({ scheme: 'github', authority: 'RotProds', resourceType: 'repository', resourceId: 'cos-graph-engine' });
  const b = canonicalIdentity({ scheme: 'github', authority: 'rotprods', resourceType: 'repository', resourceId: 'cos-graph-engine' });
  ok(a.uri === b.uri && a.id === b.id, 'canonical identity normalizes provider authority');
  ok(
    stableSerialize({ b: 2, a: 1 }) === stableSerialize({ a: 1, b: 2 }),
    'stable serialization ignores object insertion order',
  );
}

async function testEventLog(): Promise<void> {
  const log = new InMemoryEventLog();
  const base = {
    id: 'evt-1' as EntityId,
    type: 'test.event',
    source: 'source-1' as EntityId,
    payload: { value: 1 },
    metadata: { test: true },
    severity: 'info' as const,
    timestamp: FIXED_TIME,
    traceId: 'trace-1',
    spanId: 'span-1',
    idempotencyKey: 'idem-1',
    correlationId: 'corr-1',
    recordedAt: FIXED_TIME,
  };
  const first = await log.append(base);
  const retry = await log.append({ ...base, id: 'evt-retry' as EntityId, spanId: 'span-retry' });
  ok(first.appended && !retry.appended && retry.event.sequence === first.event.sequence, 'event retries converge by payload-bound idempotency key');
  await rejects(
    () => log.append({ ...base, id: 'evt-conflict' as EntityId, payload: { value: 2 } }),
    /IDEMPOTENCY_CONFLICT/,
    'event idempotency key cannot be reused for a different logical payload',
  );
  const leaked = await log.get(first.event.id);
  if (leaked) (leaked.payload as { value: number }).value = 999;
  const reread = await log.get(first.event.id);
  ok((reread?.payload as { value: number }).value === 1, 'event-log reads are copy-safe');
}

async function testConcurrency(): Promise<void> {
  const store = new VersionedStore({ value: 1 });
  const initial = store.read();
  const swapped = store.compareHashAndSwap(initial.version, initial.contentHash, { value: 2 });
  ok(swapped.current.version === 1, 'CAS advances version exactly once');
  await rejects(() => store.compareAndSwap(0, { value: 3 }), /STALE_VERSION/, 'stale expected-version write is rejected');
  await rejects(() => store.compareHashAndSwap(1, initial.contentHash, { value: 3 }), /STALE_CONTENT/, 'stale expected-content write is rejected');

  const leases = new InMemoryLeaseManager();
  const first = leases.acquire('project:P1', 'worker-a', { ttlMs: 10, nowMs: 1_000 });
  await rejects(() => leases.acquire('project:P1', 'worker-b', { ttlMs: 10, nowMs: 1_005 }), /LEASE_CONFLICT/, 'concurrent lease acquisition is rejected');
  const second = leases.acquire('project:P1', 'worker-b', { ttlMs: 10, nowMs: 1_011 });
  ok(second.fencingVersion > first.fencingVersion, 'lease reacquisition advances fencing version');
  await rejects(() => leases.assertHeld('project:P1', first.token, 1_012), /LEASE_TOKEN_MISMATCH/, 'stale lease token cannot commit after successor lease');

  const idem = new InMemoryIdempotencyRegistry();
  const claim = idem.claim('task:1', { input: 'A' }, 'worker-a', 1_000);
  ok(claim.fresh, 'first idempotency claim is fresh');
  ok(!idem.claim('task:1', { input: 'A' }, 'worker-a', 1_001).fresh, 'identical retry resolves to existing claim');
  await rejects(() => idem.claim('task:1', { input: 'B' }, 'worker-a'), /IDEMPOTENCY_CONFLICT/, 'different payload cannot reuse task idempotency key');
}

async function testPolicy(): Promise<void> {
  const policies = new PolicyEngine();
  const allow: PolicyRule = {
    id: 'allow-rule' as EntityId,
    name: 'allow',
    description: 'allow test',
    effect: 'allow',
    actions: ['execute'],
    resources: ['resource:test'],
    conditions: [],
    priority: 10,
    enabled: true,
  };
  const deny: PolicyRule = {
    ...allow,
    id: 'deny-rule' as EntityId,
    name: 'deny',
    effect: 'deny',
  };
  await policies.addRule(allow);
  await policies.addRule(deny);
  const decision = await policies.evaluate('execute', 'resource:test', ctx);
  ok(!decision.allowed && /DENY/i.test(decision.reason), 'equal-priority conflict deterministically resolves DENY over ALLOW');

  const malformed: PolicyRule = {
    ...allow,
    id: 'malformed-rule' as EntityId,
    name: 'malformed',
    priority: 100,
    conditions: [{ field: 'userId', operator: 'unknown' as never, value: 'w13-user' }],
  };
  await policies.addRule(malformed);
  const malformedDecision = await policies.evaluate('execute', 'resource:test', ctx);
  ok(!malformedDecision.allowed, 'unknown policy operator cannot become implicit authorization');
}

class ContradictoryTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:contradictory' as EntityId,
    name: 'contradictory',
    description: 'returns malformed success evidence',
    version: { major: 1, minor: 0, patch: 0 },
    inputSchema: {},
    outputSchema: {},
    permissions: ['read'],
    cost: { units: 'credits', amount: 0 },
    timeout: 1000,
    rateLimit: { maxPerMinute: 10, maxPerHour: 100 },
    retryConfig: { maxRetries: 0, backoffMs: 0 },
  };
  async execute(): Promise<ToolResult> {
    return {
      success: true,
      output: { error: 'hidden failure' },
      cost: this.definition.cost,
      latency: 1,
      metadata: {},
    };
  }
}

class SideEffectTool implements ITool {
  readonly definition: ToolDefinition = {
    id: 'tool:side-effect' as EntityId,
    name: 'side_effect',
    description: 'authority fencing test',
    version: { major: 1, minor: 0, patch: 0 },
    inputSchema: {},
    outputSchema: {},
    permissions: ['write'],
    cost: { units: 'credits', amount: 0 },
    timeout: 1000,
    rateLimit: { maxPerMinute: 10, maxPerHour: 100 },
    retryConfig: { maxRetries: 0, backoffMs: 0 },
  };
  async execute(): Promise<ToolResult> {
    return { success: true, output: { written: true }, cost: this.definition.cost, latency: 1, metadata: {} };
  }
}

async function testToolRuntime(): Promise<void> {
  const registry = new StrictToolRegistry();
  registry.register(new ContradictoryTool());
  registry.register(new SideEffectTool());
  await rejects(() => registry.execute('contradictory', {}, ctx), /TOOL_RESULT_INVARIANT/, 'tool cannot self-certify contradictory success evidence');

  const router = new CapabilityRouter(registry, async () => ({ allowed: true, reason: 'w13-test' }));
  await rejects(() => router.execute('side_effect', {}, ctx), /CAPABILITY_IDEMPOTENCY_REQUIRED/, 'side effects require idempotency key');
  await rejects(
    () => router.execute('side_effect', {}, ctx, { idempotencyKey: 'effect-1' }),
    /CAPABILITY_FENCING_REQUIRED/,
    'side effects require fencing token/version',
  );
  const receipt = await router.execute('side_effect', {}, ctx, { idempotencyKey: 'effect-1', fencingVersion: 1 });
  ok(receipt.result.success, 'authorized fenced side effect executes through strict registry');
}

async function testAuthorityGraphAndContext(): Promise<void> {
  const makeGraph = () => {
    const graph = new VerifiedAuthorityGraphRAGEngine({ topK: 5, walkDepth: 2 });
    graph.addEntity({ id: 'project', name: 'Project', type: 'project', projectId: 'P1', sensitivity: 'internal' });
    graph.addEntity({ id: 'private', name: 'Private', type: 'fact', projectId: 'P1', sensitivity: 'private' });
    graph.addRelation({
      source: 'project',
      target: 'private',
      type: 'contains',
      projectId: 'P1',
      provenanceRef: 'source:relation',
      confidence: 1,
      recordedAt: FIXED_TIME,
    });
    graph.upsertChunk({
      id: 'internal-chunk',
      text: 'internal project evidence',
      source: 'source:internal',
      embedding: [1, 0],
      entities: ['project'],
      projectId: 'P1',
      sensitivity: 'internal',
      provenanceRef: 'source:internal',
      authority: 1,
      recordedAt: FIXED_TIME,
    });
    graph.upsertChunk({
      id: 'private-chunk',
      text: 'private evidence must not leak',
      source: 'source:private',
      embedding: [1, 0],
      entities: ['private'],
      projectId: 'P1',
      sensitivity: 'private',
      provenanceRef: 'source:private',
      authority: 1,
      recordedAt: FIXED_TIME,
    });
    return graph;
  };

  const graphA = makeGraph();
  const graphB = makeGraph();
  ok(graphA.projectionHash() === graphB.projectionHash(), 'identical authority graph replay produces identical projection hash');
  ok(graphA.validate().length === 0, 'authority graph invariants validate');
  const relation = graphA.listRelations()[0];
  ok(relation.sensitivity === 'private', 'relation sensitivity derives from the most sensitive endpoint before identity');

  const internal = graphA.retrieveScoped([1, 0], ['project'], { projectId: 'P1', permission: 'internal', asOf: FIXED_TIME });
  ok(internal.chunks.some(c => c.id === 'internal-chunk'), 'internal scope retrieves internal evidence');
  ok(!internal.chunks.some(c => c.id === 'private-chunk'), 'internal scope cannot retrieve private evidence');

  const compiler = new ContextPackCompiler(graphA);
  await rejects(
    () => compiler.compile({
      projectId: 'P1',
      task: 'test',
      queryEmbedding: [1, 0],
      projectionVersion: graphA.getProjectionVersion(),
      expectedProjectionVersion: graphA.getProjectionVersion() + 1,
      projectionHash: graphA.projectionHash(),
      expectedProjectionHash: graphA.projectionHash(),
      generatedAt: FIXED_TIME,
      asOf: FIXED_TIME,
    }),
    /STALE_CONTEXT_PROJECTION/,
    'stale context projection version fails closed',
  );
}

async function testAgenticContext(): Promise<void> {
  const registry = new AgenticResourceRegistry();
  const project = registry.addResource({
    identity: { scheme: 'agentic', authority: 'portfolio', resourceType: 'project', resourceId: 'P1' },
    type: 'project',
    title: 'Project P1',
    projectId: 'P1',
    status: 'active',
    sensitivity: 'internal',
    provenanceRef: 'registry:project',
    recordedAt: FIXED_TIME,
  });
  const decision = registry.addResource({
    identity: { scheme: 'agentic', authority: 'P1', resourceType: 'decision', resourceId: 'D1' },
    type: 'decision',
    title: 'Use deterministic replay',
    projectId: 'P1',
    status: 'active',
    sensitivity: 'internal',
    provenanceRef: 'registry:decision',
    recordedAt: FIXED_TIME,
    metadata: { summary: 'deterministic replay required' },
  });
  registry.addRelation({
    type: 'contains',
    from: project.id,
    to: decision.id,
    projectId: 'P1',
    provenanceRef: 'registry:relation',
    recordedAt: FIXED_TIME,
  });

  const projector = new VerifiedAgenticContextProjector(registry);
  const compiled = await projector.compileVerified({
    projectId: 'P1',
    task: 'What replay decision governs this project?',
    permission: 'internal',
    asOf: FIXED_TIME,
    generatedAt: FIXED_TIME,
    maxTokens: 2000,
  });
  ok(compiled.pack.items.length > 0, 'verified agentic projector produces bounded evidence pack');
  ok(compiled.pack.evidenceIntegrityAlgorithm === 'sha-256', 'verified context pack carries SHA-256 evidence integrity');
  ok(compiled.pack.provenance.includes('registry:decision'), 'context pack retains decision provenance');
}

async function testStrictHubRestore(): Promise<void> {
  const store = new InMemoryHubSnapshotStore();
  const hub = new CosHub();
  hub.registerRepository('rotprods', 'cos-graph-engine');
  // Seed one agent definition into the snapshot evidence. Strict restore must not
  // silently claim a complete recovery while no agent-definition projector exists.
  hub.agents.addNode({
    name: 'W13 Agent', role: 'validator', capabilities: ['verify'], tools: [], memoryIds: [], confidence: 1,
  });
  await store.save(await hub.snapshot());
  const fresh = new CosHub(hub.eventLog);
  const strict = new StrictHubRecoveryCoordinator(store);
  await rejects(() => strict.restoreLatest(fresh), /HUB_RESTORE_INCOMPLETE_DEFINITIONS/, 'authority Hub restore rejects unresolved durable definitions');
}

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         W13 COS AUTHORITY QUALIFICATION SUITE           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  await testIdentity();
  await testEventLog();
  await testConcurrency();
  await testPolicy();
  await testToolRuntime();
  await testAuthorityGraphAndContext();
  await testAgenticContext();
  await testStrictHubRestore();
  console.log(`\nW13 authority suite: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
