import assert from 'node:assert/strict';
import type {
  CellContext,
  EntityId,
  ITool,
  ToolDefinition,
  ToolResult,
} from '../packages/core/src';
import {
  AuthorityCapabilityExecutor,
  CapabilityRouter,
  InMemorySideEffectLedgerStore,
  SideEffectCoordinator,
  SideEffectLedger,
  ToolRegistry,
} from '../packages/execution/src';

const T0 = '2026-08-28T13:00:00.000Z';
const T1 = '2026-08-28T13:00:01.000Z';
const T2 = '2026-08-28T13:00:02.000Z';
const T3 = '2026-08-28T13:00:03.000Z';
const T4 = '2026-08-28T13:00:04.000Z';
const T5 = '2026-08-28T13:00:05.000Z';
const T6 = '2026-08-28T13:00:06.000Z';
const T7 = '2026-08-28T13:00:07.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const registry = new ToolRegistry();
  const writeTool = new CountingTool('authority_write', ['write']);
  const readTool = new CountingTool('authority_read', ['read']);
  const uncertainTool = new ThrowingTool('authority_uncertain');
  registry.register(writeTool);
  registry.register(readTool);
  registry.register(uncertainTool);

  const router = new CapabilityRouter(
    registry,
    async request => {
      const policy = request.context.metadata?.policy;
      if (policy === 'deny') return { allowed: false, reason: 'test policy denied operation' };
      return { allowed: true };
    },
    () => ({ allowed: true }),
  );
  const times = [T1, T2, T3, T4, T5, T6, T7];
  const ledger = new SideEffectLedger(new InMemorySideEffectLedgerStore());
  const coordinator = new SideEffectCoordinator(ledger, () => times.shift() ?? T7);
  const executor = new AuthorityCapabilityExecutor(router, coordinator);

  const context: CellContext = {
    traceId: 'trace-authority-capability',
    metadata: { policy: 'allow' },
  };
  const base = {
    capability: 'authority_write',
    input: { value: 1, optional: undefined },
    context,
    principalId: 'agent://rot/executor',
    projectId: 'COS_GRAPH_ENGINE',
    resource: 'github://rotprods/cos-graph-engine/branch/phase-05',
    operationKey: 'capability-op-1',
    sourceRef: 'agentic://run/P05-CAPABILITY-1',
    recordedAt: T0,
    fencingVersion: 41,
  } as const;

  const first = await executor.execute(base);
  check(first.sideEffecting && first.operation?.state === 'succeeded', 'write capability reaches durable succeeded state');
  check(first.providerInvoked && writeTool.calls === 1, 'write provider is invoked exactly once on first execution');
  check(first.operation?.fencingVersion === 41, 'fencing evidence is persisted with operation');
  check(first.operation?.requestHash.length === 32, 'canonical request hash is persisted');

  const retry = await executor.execute({ ...base, recordedAt: T7 });
  check(retry.reusedTerminalResult && !retry.providerInvoked, 'terminal retry reuses ledger outcome');
  check(writeTool.calls === 1, 'terminal retry cannot invoke write provider again');

  await assert.rejects(() => executor.execute({
    ...base,
    input: { value: 2 },
    recordedAt: T7,
  }), /SIDE_EFFECT_OPERATION_CONFLICT/);
  assertions += 1;
  check(writeTool.calls === 1, 'conflicting operation-key reuse fails before provider invocation');

  await assert.rejects(() => executor.execute({
    ...base,
    operationKey: 'capability-op-no-fence',
    fencingVersion: undefined,
  }), /AUTHORITY_CAPABILITY_FENCINGVERSION_REQUIRED/);
  assertions += 1;

  const deniedContext: CellContext = {
    traceId: 'trace-authority-denied',
    metadata: { policy: 'deny' },
  };
  const denied = await executor.execute({
    ...base,
    operationKey: 'capability-op-denied',
    recordedAt: T4,
    context: deniedContext,
    fencingVersion: 42,
  });
  check(denied.operation?.state === 'failed', 'pre-effect policy denial is durably recorded as failed');
  check(writeTool.calls === 1, 'policy denial does not call provider tool');
  const deniedRetry = await executor.execute({
    ...base,
    operationKey: 'capability-op-denied',
    recordedAt: T7,
    context: deniedContext,
    fencingVersion: 42,
  });
  check(deniedRetry.reusedTerminalResult && writeTool.calls === 1, 'denied operation retry reuses terminal failure');

  const uncertain = await executor.execute({
    ...base,
    capability: 'authority_uncertain',
    operationKey: 'capability-op-uncertain',
    recordedAt: T4,
    fencingVersion: 43,
  });
  check(uncertain.operation?.state === 'uncertain', 'provider exception becomes uncertain, never false failure');
  check(uncertainTool.calls === 1, 'uncertain provider was invoked once');
  await assert.rejects(() => executor.execute({
    ...base,
    capability: 'authority_uncertain',
    operationKey: 'capability-op-uncertain',
    recordedAt: T7,
    fencingVersion: 43,
  }), /SIDE_EFFECT_RECONCILIATION_REQUIRED/);
  assertions += 1;
  check(uncertainTool.calls === 1, 'uncertain operation cannot auto-retry provider');

  const read = await executor.execute({
    ...base,
    capability: 'authority_read',
    operationKey: undefined,
    fencingVersion: undefined,
    recordedAt: T7,
  });
  check(!read.sideEffecting && read.operation === null, 'read-only capability does not create side-effect operation');
  check(readTool.calls === 1 && read.capabilityReceipt?.result.success, 'read-only capability still executes normally');

  const operations = await ledger.listProjectOperations('COS_GRAPH_ENGINE');
  check(operations.some(operation => operation.state === 'succeeded'), 'ledger exposes succeeded operation evidence');
  check(operations.some(operation => operation.state === 'failed'), 'ledger exposes policy-denied failure evidence');
  check(operations.some(operation => operation.state === 'uncertain'), 'ledger exposes uncertain provider evidence');
  check(!operations.some(operation => operation.action === 'capability:authority_read'), 'read-only execution does not pollute side-effect ledger');

  console.log(`Authority capability executor contract: ${assertions} assertions passed`);
}

class CountingTool implements ITool {
  calls = 0;
  readonly definition: ToolDefinition;

  constructor(name: string, permissions: ToolDefinition['permissions']) {
    this.definition = definition(name, permissions);
  }

  async execute(input: unknown, _context: CellContext): Promise<ToolResult> {
    this.calls += 1;
    return {
      success: true,
      output: { accepted: true, input },
      cost: { units: 'test', amount: 0 },
      latency: 1,
      metadata: { calls: this.calls },
    };
  }
}

class ThrowingTool implements ITool {
  calls = 0;
  readonly definition: ToolDefinition;

  constructor(name: string) {
    this.definition = definition(name, ['write']);
  }

  async execute(_input: unknown, _context: CellContext): Promise<ToolResult> {
    this.calls += 1;
    throw new Error('provider connection lost after mutation may have occurred');
  }
}

function definition(name: string, permissions: ToolDefinition['permissions']): ToolDefinition {
  return {
    id: `tool:${name}` as EntityId,
    name,
    description: `Test capability ${name}`,
    version: { major: 1, minor: 0, patch: 0 },
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    permissions: [...permissions],
    cost: { units: 'test', amount: 0 },
    timeout: 1_000,
    rateLimit: { maxPerMinute: 100, maxPerHour: 1_000 },
    retryConfig: { maxRetries: 0, backoffMs: 0 },
  };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
