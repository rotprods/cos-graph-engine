import assert from 'node:assert/strict';
import type {
  AuthorityAgentRunService,
} from '../packages/execution/src/authority-agent-run';
import type {
  AuthorityReadCapabilityRequest,
  AuthorityReadCapabilityResult,
  AuthoritySideEffectCapabilityRequest,
  AuthoritySideEffectCapabilityResult,
} from '../packages/execution/src/authority-capability-runtime';
import type { AuthorityCapabilityRuntimePortV2 } from '../packages/execution/src/authority-capability-evidence-v2';
import {
  AuthorityAgentEvidenceRepairHandler,
  AuthorityLeaseReleaseRepairHandler,
  AuthorityRepairService,
  AuthorityRepairWorker,
  InMemoryAuthorityRepairStore,
  RepairingAuthorityCapabilityRuntime,
  type IAuthorityRepairStore,
} from '../packages/execution/src/authority-phase05-repair';
import type { AuthorityExecutionRuntime } from '../packages/execution/src/authority-execution-runtime';

const BASE = Date.parse('2026-08-29T22:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();
const SECRET = 'agent-result-needs-durable-repair';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthorityRepairStore();
  const service = new AuthorityRepairService(store);
  const underlying = new FakeCapabilityRuntime();
  const repairing = new RepairingAuthorityCapabilityRuntime(underlying, service);

  const readRequest = makeReadRequest();
  const readResult = await repairing.executeRead(readRequest);
  check(readResult.agentEvidence.status === 'pending_repair', 'protected read result remains pending repair');
  let ready = await service.listReady('COS_GRAPH_ENGINE', at(2));
  check(ready.length === 1 && ready[0]?.kind === 'agent_evidence_append', 'read evidence failure creates durable repair intent');
  check(ready[0]?.payload.resultSource !== undefined, 'read repair retains the result source needed for reconstruction');

  const fakeRunService = {
    recordStep: async (input: Record<string, unknown>) => ({
      revision: { revision: 4, input },
      appended: true,
    }),
  } as unknown as AuthorityAgentRunService;
  const worker = new AuthorityRepairWorker(service, [
    new AuthorityAgentEvidenceRepairHandler(fakeRunService),
  ], { ownerId: 'repair-worker://agent-evidence', leaseTtlMs: 10_000 });
  const readRepairReport = await worker.runProject('COS_GRAPH_ENGINE', at(3));
  check(readRepairReport.resolved === 1, 'agent evidence repair handler resolves inline read evidence');

  const sideEffectRequest = makeSideEffectRequest();
  const sideEffectResult = await repairing.executeSideEffect(sideEffectRequest);
  check(sideEffectResult.operation.state === 'committed', 'repair persistence cannot rewrite committed provider truth');
  ready = await service.listReady('COS_GRAPH_ENGINE', at(10));
  check(ready.length === 2, 'side effect queues agent evidence and lease release repairs');
  check(ready.some(item => item.kind === 'agent_evidence_append'), 'side-effect agent evidence repair is durable');
  check(ready.some(item => item.kind === 'lease_release'), 'lease release repair is durable');

  const fakeExecution = {
    getOperation: async (operationId: string) => operationId === 'operation://42'
      ? sideEffectResult.operation
      : null,
    releaseLease: async (input: Record<string, unknown>) => ({
      revision: {
        state: 'released',
        resourceRevision: 8,
        contentHash: 'lease-release-content-hash',
        ...input,
      },
      appended: true,
    }),
  } as unknown as AuthorityExecutionRuntime;
  const repairWorker = new AuthorityRepairWorker(service, [
    new AuthorityAgentEvidenceRepairHandler(fakeRunService, fakeExecution),
    new AuthorityLeaseReleaseRepairHandler(fakeExecution),
  ], { ownerId: 'repair-worker://side-effect', leaseTtlMs: 10_000 });
  const sideRepairReport = await repairWorker.runProject('COS_GRAPH_ENGINE', at(11));
  check(sideRepairReport.resolved === 2, 'both post-commit repair intents resolve through idempotent handlers');
  check((await service.listReady('COS_GRAPH_ENGINE', at(12))).length === 0, 'resolved repairs leave no open ready work');

  const original = new Error('ORIGINAL_CAPABILITY_FAILURE');
  underlying.readError = original;
  let caught: unknown;
  try { await repairing.executeRead(readRequest); } catch (error) { caught = error; }
  check(caught === original, 'repair wrapper preserves original protected error identity');
  check((await store.listProject('COS_GRAPH_ENGINE')).filter(item => item.recordedAt === at(1)).length === 1, 'failed protected invocation does not enqueue a new repair');

  const failingStore = new ThrowingRepairStore();
  const isolated = new RepairingAuthorityCapabilityRuntime(
    new FakeCapabilityRuntime(),
    new AuthorityRepairService(failingStore),
  );
  const stillAccepted = await isolated.executeRead(readRequest);
  check(stillAccepted.status === 'read_completed', 'repair-ledger outage cannot replace accepted capability result');
  check(isolated.getEnqueueFailures().length === 1, 'repair enqueue outage is retained as bounded local evidence');

  console.log(`Authority capability repair runtime contract: ${assertions} assertions passed`);
}

class FakeCapabilityRuntime implements AuthorityCapabilityRuntimePortV2 {
  readError: Error | null = null;

  async executeRead(_request: AuthorityReadCapabilityRequest): Promise<AuthorityReadCapabilityResult> {
    if (this.readError) throw this.readError;
    return {
      status: 'read_completed',
      receipt: {
        capability: 'authority_http_read', sideEffecting: false, inputHash: 'read-input-hash',
        result: { success: true, output: { secret: SECRET }, cost: { units: 'credits', amount: 0 }, latency: 2, metadata: {} },
      },
      policy: {
        decisionId: 'policy-read', effect: 'allow', allowed: true, requiresApproval: false,
        reason: 'allow', matchedRuleIds: ['rule-read'], approvalGrantId: null,
        evaluatedAt: at(1), requestHash: 'request-hash', decisionHash: 'decision-hash',
      },
      agentEvidence: { status: 'pending_repair', error: 'agent store unavailable' },
    } as AuthorityReadCapabilityResult;
  }

  async executeSideEffect(_request: AuthoritySideEffectCapabilityRequest): Promise<AuthoritySideEffectCapabilityResult> {
    return makeSideEffectResult();
  }
}

class ThrowingRepairStore implements IAuthorityRepairStore {
  async append(): Promise<never> { throw new Error('repair store unavailable'); }
  async getCurrent(): Promise<null> { return null; }
  async getByDedupeKey(): Promise<null> { return null; }
  async getHistory(): Promise<[]> { return []; }
  async listProject(): Promise<[]> { return []; }
}

function makeReadRequest(): AuthorityReadCapabilityRequest {
  return {
    capability: 'authority_http_read', projectId: 'COS_GRAPH_ENGINE',
    principal: { id: 'principal://roberto', roles: ['builder'], projectIds: ['COS_GRAPH_ENGINE'], sensitivityClearance: 'restricted', attributes: {} },
    sensitivity: 'private', resourceUri: 'https://api.example.com/read', input: {}, at: at(1),
    context: { traceId: 'corr-read' },
    agentStep: {
      runId: 'run://read', expectedRevision: 3, operationKey: 'agent-step-read',
      stepId: 'step-read', attempt: 1, startedAt: at(0), completedAt: at(1),
      evidenceRefs: ['provider://read/1'],
    },
  };
}

function makeSideEffectRequest(): AuthoritySideEffectCapabilityRequest {
  return {
    capability: 'authority_http_write', projectId: 'COS_GRAPH_ENGINE',
    principal: { id: 'principal://roberto', roles: ['builder'], projectIds: ['COS_GRAPH_ENGINE'], sensitivityClearance: 'restricted', attributes: {} },
    sensitivity: 'private', resourceUri: 'resource://42', input: {},
    idempotencyKey: 'operation-42', providerIdempotencyKey: 'provider-42',
    correlationId: 'corr-42', causationId: null,
    provenance: [{ source: 'test://capability-repair' }], context: { traceId: 'corr-42' },
    timeline: { claimAt: at(4), leaseAt: at(5), prepareAt: at(6), beginAt: at(7), outcomeAt: at(8), releaseAt: at(9) },
    leaseOwnerId: 'worker://42', leaseTtlMs: 60_000,
    agentStep: {
      runId: 'run://side-effect', expectedRevision: 5, operationKey: 'agent-step-side-effect',
      stepId: 'step-write', attempt: 1, startedAt: at(7), completedAt: at(8),
      evidenceRefs: ['provider://write/42', 'operation://42'],
    },
  };
}

function makeSideEffectResult(): AuthoritySideEffectCapabilityResult {
  return {
    status: 'committed',
    operation: {
      operationId: 'operation://42', projectId: 'COS_GRAPH_ENGINE', idempotencyKey: 'operation-42',
      operationKey: 'operation-42', operationHash: 'operation-hash', revisionId: 'operation-revision-5', revision: 5,
      previousRevisionId: 'operation-revision-4', state: 'committed', effectKnowledge: 'applied',
      principalId: 'principal://roberto', agentRunId: 'run://side-effect', capability: 'authority_http_write',
      resourceUri: 'resource://42', input: {}, inputHash: 'input-hash', providerIdempotencyKey: 'provider-42',
      leaseId: 'lease-42', leaseOwnerId: 'worker://42', fencingToken: 7,
      result: { accepted: true, secret: SECRET }, resultHash: 'result-hash', error: null, compensation: null,
      correlationId: 'corr-42', causationId: null, provenance: [{ source: 'test://capability-repair' }],
      recordedAt: at(8), metadata: {}, contentHash: 'operation-content-hash', terminal: true,
    },
    receipt: {
      capability: 'authority_http_write', sideEffecting: true, inputHash: 'capability-input-hash',
      result: { success: true, output: { accepted: true }, cost: { units: 'credits', amount: 0 }, latency: 3, metadata: {} },
    },
    lease: {
      revisionId: 'lease-revision-7', leaseId: 'lease-42', resourceUri: 'resource://42',
      operationKey: 'lease-operation-42', resourceRevision: 7, previousRevisionId: 'lease-revision-6',
      state: 'active', ownerId: 'worker://42', fencingToken: 7, acquiredAt: at(5), renewedAt: null,
      expiresAt: at(65), releasedAt: null, metadata: {}, recordedAt: at(5), contentHash: 'lease-content-hash',
    },
    policies: [],
    agentEvidence: { status: 'pending_repair', error: 'agent store unavailable' },
    leaseRelease: { status: 'release_failed', error: 'lease store unavailable' },
    providerError: null,
  } as AuthoritySideEffectCapabilityResult;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
