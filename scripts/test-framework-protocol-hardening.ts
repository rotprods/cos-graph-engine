import assert from 'node:assert/strict';
import {
  COS_GRAPH_PROTOCOL_VERSION,
  GraphCapabilityBase,
  GraphFrameworkError,
  GraphModule,
  GraphSchema,
  createGraphRuntime,
  defineGraphCapability,
  defineGraphModule,
  inspectGraphModule,
} from '../packages/graph/src/framework';

const objectSchema: GraphSchema<Record<string, unknown>> = {
  parse(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Expected an object');
    }
    return { ...value } as Record<string, unknown>;
  },
};

async function expectFrameworkError(
  action: () => Promise<unknown>,
  code: GraphFrameworkError['code'],
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof GraphFrameworkError);
    assert.equal(error.code, code);
    return true;
  });
}

async function main(): Promise<void> {
  const frozenCapability = defineGraphCapability({
    descriptor: {
      id: 'cos.hardening.frozen',
      kind: 'query',
      version: '1.0.0-alpha.1+build.2',
      maturity: 'experimental',
      description: 'Verifies immutable factory metadata and semver compatibility',
      modes: ['stats', 'stream'],
      determinism: 'deterministic',
      sideEffects: 'none',
      idempotency: 'none',
    },
    input: objectSchema,
    output: objectSchema,
    execute(input) {
      return input;
    },
  });

  const frozenModule = defineGraphModule({
    manifest: {
      id: 'cos.hardening',
      name: 'COS Hardening Module',
      version: '1.0.0-alpha.1+build.2',
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      maturity: 'experimental',
      description: 'Exercises immutable graph protocol trust boundaries',
      capabilities: [{ ...frozenCapability.descriptor, modes: ['stream', 'stats'] }],
    },
    capabilities: [frozenCapability],
  });

  assert.equal(inspectGraphModule(frozenModule).valid, true);
  assert.equal(Object.isFrozen(frozenModule), true);
  assert.equal(Object.isFrozen(frozenModule.manifest), true);
  assert.equal(Object.isFrozen(frozenCapability), true);
  assert.equal(Object.isFrozen(frozenCapability.descriptor), true);
  assert.equal(Object.isFrozen(frozenCapability.descriptor.modes), true);

  const policyFailureRuntime = createGraphRuntime({
    policy: {
      authorize() {
        throw new Error('authorization backend unavailable');
      },
    },
  });
  const writeCapability = defineGraphCapability({
    descriptor: {
      id: 'cos.hardening.write',
      kind: 'store',
      version: '1.0.0',
      maturity: 'experimental',
      description: 'Verifies fail-closed policy dependency failures',
      modes: ['write'],
      determinism: 'deterministic',
      sideEffects: 'external',
      idempotency: 'required',
    },
    input: objectSchema,
    output: objectSchema,
    execute(input) {
      return input;
    },
  });
  const writeModule = defineGraphModule({
    manifest: {
      id: 'cos.hardening.write-module',
      name: 'Policy Failure Module',
      version: '1.0.0',
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      maturity: 'experimental',
      description: 'Confirms policy infrastructure failure stays typed and closed',
      capabilities: [writeCapability.descriptor],
    },
    capabilities: [writeCapability],
  });
  await policyFailureRuntime.install(writeModule);
  await expectFrameworkError(
    () => policyFailureRuntime.invoke(
      writeCapability,
      { value: 1 },
      { mode: 'write', idempotencyKey: 'hardening-policy-1' },
    ),
    'EXECUTION_POLICY_FAILED',
  );

  const mutableDescriptor = {
    id: 'cos.mutable.read',
    kind: 'query' as const,
    version: '1.0.0',
    maturity: 'experimental' as const,
    description: 'Mutable third-party descriptor used to verify install-time snapshots',
    modes: ['stats'] as const,
    determinism: 'deterministic' as const,
    sideEffects: 'none' as const,
    idempotency: 'none' as const,
  };
  const mutableCapability: GraphCapabilityBase = {
    descriptor: mutableDescriptor,
    async invokeRaw(input: unknown) {
      return input;
    },
  };
  const mutableModule: GraphModule = {
    manifest: {
      id: 'cos.mutable',
      name: 'Mutable Third-Party Module',
      version: '1.0.0',
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      maturity: 'experimental',
      description: 'Verifies lifecycle mutation cannot rewrite registered security metadata',
      capabilities: [mutableDescriptor],
    },
    capabilities: [mutableCapability],
    onInstall() {
      Object.assign(mutableDescriptor, {
        id: 'cos.mutable.changed',
        sideEffects: 'external',
      });
    },
  };

  const runtime = createGraphRuntime();
  await runtime.install(mutableModule);
  const result = await runtime.invokeById('cos.mutable.read', { safe: true }, { mode: 'stats' });
  assert.deepEqual(result.value, { safe: true });
  assert.equal(result.receipt.capabilityId, 'cos.mutable.read');
  assert.equal(result.receipt.sideEffects, 'none');
  assert.equal(runtime.registry.snapshot().capabilities[0]?.descriptor.id, 'cos.mutable.read');

  await runtime.uninstall('cos.mutable');
  assert.equal(runtime.registry.snapshot().capabilities.length, 0);

  console.log('COS Graph Protocol V1: hardening suite passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
