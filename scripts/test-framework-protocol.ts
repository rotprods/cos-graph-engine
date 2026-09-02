import assert from 'node:assert/strict';
import {
  COS_GRAPH_PROTOCOL_VERSION,
  GraphFrameworkError,
  GraphSchema,
  createGraphRuntime,
  defineGraphCapability,
  defineGraphModule,
  inspectGraphModule,
} from '../packages/graph/src/framework';

const numberInput: GraphSchema<{ value: number }> = {
  parse(value: unknown): { value: number } {
    if (typeof value !== 'object' || value === null || !('value' in value)) {
      throw new Error('Expected an object with value');
    }
    const candidate = Reflect.get(value, 'value');
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      throw new Error('Expected a finite numeric value');
    }
    return { value: candidate };
  },
};

const numberOutput: GraphSchema<{ doubled: number }> = {
  parse(value: unknown): { doubled: number } {
    if (typeof value !== 'object' || value === null || !('doubled' in value)) {
      throw new Error('Expected an object with doubled');
    }
    const candidate = Reflect.get(value, 'doubled');
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      throw new Error('Expected a finite doubled value');
    }
    return { doubled: candidate };
  },
};

const readCapability = defineGraphCapability({
  descriptor: {
    id: 'cos.algorithm.double',
    kind: 'algorithm',
    version: '1.0.0',
    maturity: 'preview',
    description: 'Deterministic reference algorithm used by the protocol conformance suite',
    modes: ['stream', 'stats'],
    determinism: 'deterministic',
    sideEffects: 'none',
    idempotency: 'none',
  },
  input: numberInput,
  output: numberOutput,
  execute(input) {
    return { doubled: input.value * 2 };
  },
});

const writeCapability = defineGraphCapability({
  descriptor: {
    id: 'cos.store.persist-double',
    kind: 'store',
    version: '1.0.0',
    maturity: 'preview',
    description: 'Reference side-effecting capability used to verify fail-closed policy semantics',
    modes: ['write'],
    determinism: 'deterministic',
    sideEffects: 'external',
    idempotency: 'required',
  },
  input: numberInput,
  output: numberOutput,
  execute(input) {
    return { doubled: input.value * 2 };
  },
});

const referenceModule = defineGraphModule({
  manifest: {
    id: 'cos.reference',
    name: 'COS Reference Module',
    version: '1.0.0',
    protocol: COS_GRAPH_PROTOCOL_VERSION,
    maturity: 'preview',
    description: 'Reference module for Graph Protocol V1 conformance tests',
    capabilities: [readCapability.descriptor, writeCapability.descriptor],
  },
  capabilities: [readCapability, writeCapability],
});

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
  const conformance = inspectGraphModule(referenceModule);
  assert.equal(conformance.valid, true, JSON.stringify(conformance.issues));

  const observed: string[] = [];
  const runtime = createGraphRuntime({
    observers: [
      {
        id: 'reference-observer',
        observe(event) {
          observed.push(event.type);
        },
      },
    ],
  });
  await runtime.install(referenceModule);

  const typed = await runtime.invoke(readCapability, { value: 21 }, { mode: 'stats' });
  assert.deepEqual(typed.value, { doubled: 42 });
  assert.equal(typed.receipt.capabilityId, 'cos.algorithm.double');
  assert.equal(typed.receipt.moduleId, 'cos.reference');
  assert.equal(typed.receipt.protocol, COS_GRAPH_PROTOCOL_VERSION);
  assert.deepEqual(observed, ['execution.started', 'execution.succeeded']);

  const dynamic = await runtime.invokeById('cos.algorithm.double', { value: 4 }, { mode: 'stream' });
  assert.deepEqual(dynamic.value, { doubled: 8 });

  const diagnosticRuntime = createGraphRuntime({
    observers: [
      {
        id: 'failing-observer',
        observe(event) {
          if (event.type === 'execution.succeeded') throw new Error('telemetry unavailable');
        },
      },
    ],
  });
  await diagnosticRuntime.install(referenceModule);
  const observedFailure = await diagnosticRuntime.invoke(readCapability, { value: 3 }, { mode: 'stats' });
  assert.deepEqual(observedFailure.value, { doubled: 6 });
  assert.equal(observedFailure.diagnostics.length, 1);
  assert.equal(observedFailure.diagnostics[0]?.code, 'OBSERVER_FAILURE');

  await expectFrameworkError(
    () => runtime.invoke(readCapability, { value: 1 }, { mode: 'write' }),
    'EXECUTION_MODE_UNSUPPORTED',
  );

  await expectFrameworkError(
    () => runtime.invoke(writeCapability, { value: 2 }, { mode: 'write' }),
    'IDEMPOTENCY_KEY_REQUIRED',
  );

  await expectFrameworkError(
    () => runtime.invoke(writeCapability, { value: 2 }, { mode: 'write', idempotencyKey: 'write-1' }),
    'EXECUTION_POLICY_REQUIRED',
  );

  const deniedRuntime = createGraphRuntime({ policy: { authorize: () => false } });
  await deniedRuntime.install(referenceModule);
  await expectFrameworkError(
    () => deniedRuntime.invoke(writeCapability, { value: 2 }, { mode: 'write', idempotencyKey: 'write-2' }),
    'EXECUTION_DENIED',
  );

  const allowedRuntime = createGraphRuntime({ policy: { authorize: () => true } });
  await allowedRuntime.install(referenceModule);
  const written = await allowedRuntime.invoke(
    writeCapability,
    { value: 5 },
    { mode: 'write', idempotencyKey: 'write-3', graph: { id: 'graph:reference', revision: '7' } },
  );
  assert.deepEqual(written.value, { doubled: 10 });
  assert.equal(written.receipt.idempotencyKey, 'write-3');
  assert.equal(written.receipt.graph?.revision, '7');

  await expectFrameworkError(() => runtime.install(referenceModule), 'MODULE_ALREADY_INSTALLED');

  const brokenModule = defineGraphModule({
    manifest: {
      ...referenceModule.manifest,
      id: 'Invalid Module ID',
    },
    capabilities: referenceModule.capabilities,
  });
  assert.equal(inspectGraphModule(brokenModule).valid, false);

  const lyingCapability = defineGraphCapability({
    descriptor: { ...readCapability.descriptor, sideEffects: 'external' },
    input: numberInput,
    output: numberOutput,
    execute(input) {
      return { doubled: input.value * 2 };
    },
  });
  const driftedModule = defineGraphModule({
    manifest: {
      id: 'cos.drifted',
      name: 'Drifted Module',
      version: '1.0.0',
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      maturity: 'preview',
      description: 'Must fail conformance when implementation metadata diverges from its declaration',
      capabilities: [readCapability.descriptor],
    },
    capabilities: [lyingCapability],
  });
  const driftReport = inspectGraphModule(driftedModule);
  assert.equal(driftReport.valid, false);
  assert.ok(driftReport.issues.some((issue) => issue.code === 'CAPABILITY_DESCRIPTOR_DRIFT'));

  const dependencyCapability = defineGraphCapability({
    descriptor: {
      ...readCapability.descriptor,
      id: 'cos.dependent.read',
    },
    input: numberInput,
    output: numberOutput,
    execute(input) {
      return { doubled: input.value * 2 };
    },
  });
  const dependent = defineGraphModule({
    manifest: {
      id: 'cos.dependent',
      name: 'Dependent Module',
      version: '1.0.0',
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      maturity: 'preview',
      description: 'Verifies dependency ordering and fail-closed registration',
      capabilities: [dependencyCapability.descriptor],
      requires: [{ moduleId: 'cos.missing' }],
    },
    capabilities: [dependencyCapability],
  });
  await expectFrameworkError(() => runtime.install(dependent), 'MODULE_DEPENDENCY_MISSING');

  const snapshot = runtime.registry.snapshot();
  assert.equal(snapshot.modules.length, 1);
  assert.equal(snapshot.capabilities.length, 2);
  assert.equal(snapshot.protocol, COS_GRAPH_PROTOCOL_VERSION);

  console.log('COS Graph Protocol V1: conformance suite passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
