import { GraphFrameworkError } from './errors';
import { GraphRegistry } from './registry';
import {
  COS_GRAPH_PROTOCOL_VERSION,
  GraphAuthorizationRequest,
  GraphCapability,
  GraphCapabilityBase,
  GraphDiagnostic,
  GraphExecutionContext,
  GraphExecutionMode,
  GraphExecutionPolicy,
  GraphExecutionReceipt,
  GraphExecutionResult,
  GraphModule,
  GraphReference,
  GraphRuntimeEvent,
  GraphRuntimeObserver,
  GraphCancellationSignal,
} from './protocol';

export interface GraphInvocationOptions {
  readonly mode: GraphExecutionMode;
  readonly graph?: GraphReference;
  readonly idempotencyKey?: string;
  readonly cancellation?: GraphCancellationSignal;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GraphRuntimeOptions {
  readonly policy?: GraphExecutionPolicy;
  readonly observers?: readonly GraphRuntimeObserver[];
  readonly clock?: () => number;
  readonly operationIdFactory?: () => string;
}

export class GraphRuntime {
  readonly registry: GraphRegistry;

  private readonly policy?: GraphExecutionPolicy;
  private readonly observers: readonly GraphRuntimeObserver[];
  private readonly clock: () => number;
  private readonly operationIdFactory: () => string;

  constructor(options: GraphRuntimeOptions = {}, registry = new GraphRegistry()) {
    this.registry = registry;
    this.policy = options.policy;
    this.observers = options.observers ?? [];
    this.clock = options.clock ?? Date.now;

    let sequence = 0;
    this.operationIdFactory = options.operationIdFactory ?? (() => {
      sequence += 1;
      return `cosg-${this.clock().toString(36)}-${sequence.toString(36)}`;
    });
  }

  async install(module: GraphModule): Promise<this> {
    await this.registry.install(module);
    return this;
  }

  async uninstall(moduleId: string): Promise<this> {
    await this.registry.uninstall(moduleId);
    return this;
  }

  async invoke<Input, Output>(
    capability: GraphCapability<Input, Output>,
    input: Input,
    options: GraphInvocationOptions,
  ): Promise<GraphExecutionResult<Output>> {
    const registered = this.registry.resolveCapability(capability.descriptor.id);
    if (registered.capability !== capability) {
      throw new GraphFrameworkError(
        'CAPABILITY_IDENTITY_MISMATCH',
        `Capability object ${capability.descriptor.id} is not the registered implementation`,
        { capabilityId: capability.descriptor.id, moduleId: registered.moduleId },
      );
    }

    return this.execute(
      registered.moduleId,
      capability,
      options,
      (context) => capability.invoke(input, context),
    );
  }

  async invokeById(
    capabilityId: string,
    input: unknown,
    options: GraphInvocationOptions,
  ): Promise<GraphExecutionResult<unknown>> {
    const registered = this.registry.resolveCapability(capabilityId);
    return this.execute(
      registered.moduleId,
      registered.capability,
      options,
      (context) => registered.capability.invokeRaw(input, context),
    );
  }

  private async execute<Output>(
    moduleId: string,
    capability: GraphCapabilityBase,
    options: GraphInvocationOptions,
    operation: (context: GraphExecutionContext) => Promise<Output>,
  ): Promise<GraphExecutionResult<Output>> {
    const descriptor = capability.descriptor;
    const operationId = this.operationIdFactory();
    const startedAt = this.clock();
    const diagnostics: GraphDiagnostic[] = [];

    if (!descriptor.modes.includes(options.mode)) {
      throw new GraphFrameworkError(
        'EXECUTION_MODE_UNSUPPORTED',
        `Capability ${descriptor.id} does not support ${options.mode}`,
        { capabilityId: descriptor.id, mode: options.mode, supportedModes: descriptor.modes },
      );
    }

    if (options.cancellation?.aborted) {
      throw new GraphFrameworkError(
        'EXECUTION_CANCELLED',
        `Execution ${operationId} was cancelled before start`,
        { operationId, capabilityId: descriptor.id, reason: options.cancellation.reason },
      );
    }

    if (descriptor.idempotency === 'required' && !options.idempotencyKey) {
      throw new GraphFrameworkError(
        'IDEMPOTENCY_KEY_REQUIRED',
        `Capability ${descriptor.id} requires an idempotency key`,
        { operationId, capabilityId: descriptor.id },
      );
    }

    const metadata = options.metadata ?? {};
    const requiresPolicy =
      options.mode === 'mutate' ||
      options.mode === 'write' ||
      descriptor.sideEffects !== 'none';

    if (requiresPolicy) {
      if (!this.policy) {
        await this.notify(
          {
            type: 'execution.denied',
            operationId,
            moduleId,
            capabilityId: descriptor.id,
            mode: options.mode,
            reason: 'No execution policy configured for a side-effecting operation',
          },
          diagnostics,
        );
        throw new GraphFrameworkError(
          'EXECUTION_POLICY_REQUIRED',
          `Capability ${descriptor.id} requires an execution policy for ${options.mode}`,
          { operationId, capabilityId: descriptor.id, mode: options.mode },
        );
      }

      const authorization: GraphAuthorizationRequest = {
        operationId,
        moduleId,
        capability: descriptor,
        mode: options.mode,
        graph: options.graph,
        idempotencyKey: options.idempotencyKey,
        metadata,
      };
      const allowed = await this.policy.authorize(authorization);
      if (!allowed) {
        await this.notify(
          {
            type: 'execution.denied',
            operationId,
            moduleId,
            capabilityId: descriptor.id,
            mode: options.mode,
            reason: 'Execution policy denied the operation',
          },
          diagnostics,
        );
        throw new GraphFrameworkError(
          'EXECUTION_DENIED',
          `Execution policy denied ${descriptor.id}`,
          { operationId, capabilityId: descriptor.id, mode: options.mode },
        );
      }
    }

    const context: GraphExecutionContext = {
      operationId,
      mode: options.mode,
      graph: options.graph,
      idempotencyKey: options.idempotencyKey,
      cancellation: options.cancellation,
      metadata,
      startedAt,
    };

    await this.notify(
      {
        type: 'execution.started',
        operationId,
        moduleId,
        capability: descriptor,
        mode: options.mode,
        startedAt,
      },
      diagnostics,
    );

    try {
      const value = await operation(context);
      const finishedAt = this.clock();
      const receipt: GraphExecutionReceipt = {
        operationId,
        moduleId,
        capabilityId: descriptor.id,
        capabilityVersion: descriptor.version,
        protocol: COS_GRAPH_PROTOCOL_VERSION,
        mode: options.mode,
        determinism: descriptor.determinism,
        sideEffects: descriptor.sideEffects,
        idempotencyKey: options.idempotencyKey,
        graph: options.graph,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt - startedAt),
        status: 'succeeded',
      };

      await this.notify({ type: 'execution.succeeded', receipt }, diagnostics);
      return { value, receipt, diagnostics };
    } catch (error: unknown) {
      const finishedAt = this.clock();
      await this.notify(
        {
          type: 'execution.failed',
          operationId,
          moduleId,
          capabilityId: descriptor.id,
          mode: options.mode,
          startedAt,
          finishedAt,
          error,
        },
        diagnostics,
      );

      if (error instanceof GraphFrameworkError) throw error;
      throw new GraphFrameworkError(
        'CAPABILITY_EXECUTION_FAILED',
        `Capability ${descriptor.id} failed`,
        { operationId, capabilityId: descriptor.id, moduleId, mode: options.mode, diagnostics },
        error,
      );
    }
  }

  private async notify(event: GraphRuntimeEvent, diagnostics: GraphDiagnostic[]): Promise<void> {
    for (const observer of this.observers) {
      try {
        await observer.observe(event);
      } catch (error: unknown) {
        diagnostics.push({
          code: 'OBSERVER_FAILURE',
          source: observer.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export function createGraphRuntime(options: GraphRuntimeOptions = {}): GraphRuntime {
  return new GraphRuntime(options);
}
