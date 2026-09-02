export const COS_GRAPH_PROTOCOL_VERSION = 'cos.graph/v1alpha1' as const;

export type GraphProtocolVersion = typeof COS_GRAPH_PROTOCOL_VERSION;
export type GraphExecutionMode = 'stream' | 'stats' | 'mutate' | 'write';
export type GraphMaturity = 'experimental' | 'preview' | 'stable';
export type GraphCapabilityKind =
  | 'algorithm'
  | 'projection'
  | 'query'
  | 'transform'
  | 'store'
  | 'embedding'
  | 'rag'
  | 'agent'
  | 'workflow'
  | 'observer'
  | 'adapter';
export type GraphDeterminism = 'deterministic' | 'best-effort' | 'nondeterministic';
export type GraphSideEffects = 'none' | 'graph' | 'external';
export type GraphIdempotency = 'none' | 'supported' | 'required';

export interface GraphSchema<T> {
  parse(value: unknown): T;
}

export interface GraphReference {
  readonly id: string;
  readonly revision?: string;
  readonly snapshot?: string;
}

export interface GraphCancellationSignal {
  readonly aborted: boolean;
  readonly reason?: unknown;
}

export interface GraphCapabilityDescriptor {
  readonly id: string;
  readonly kind: GraphCapabilityKind;
  readonly version: string;
  readonly maturity: GraphMaturity;
  readonly description: string;
  readonly modes: readonly GraphExecutionMode[];
  readonly determinism: GraphDeterminism;
  readonly sideEffects: GraphSideEffects;
  readonly idempotency: GraphIdempotency;
}

export interface GraphModuleRequirement {
  readonly moduleId: string;
  readonly optional?: boolean;
}

export interface GraphModuleManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly protocol: GraphProtocolVersion;
  readonly maturity: GraphMaturity;
  readonly description: string;
  readonly capabilities: readonly GraphCapabilityDescriptor[];
  readonly requires?: readonly GraphModuleRequirement[];
}

export interface GraphExecutionContext {
  readonly operationId: string;
  readonly mode: GraphExecutionMode;
  readonly graph?: GraphReference;
  readonly idempotencyKey?: string;
  readonly cancellation?: GraphCancellationSignal;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly startedAt: number;
}

export interface GraphCapabilityBase {
  readonly descriptor: GraphCapabilityDescriptor;
  invokeRaw(input: unknown, context: GraphExecutionContext): Promise<unknown>;
}

export interface GraphCapability<Input, Output> extends GraphCapabilityBase {
  invoke(input: Input, context: GraphExecutionContext): Promise<Output>;
}

export interface GraphCapabilityDefinition<Input, Output> {
  readonly descriptor: GraphCapabilityDescriptor;
  readonly input: GraphSchema<Input>;
  readonly output: GraphSchema<Output>;
  execute(input: Input, context: GraphExecutionContext): Output | Promise<Output>;
}

export interface GraphModuleLifecycleContext {
  readonly protocol: GraphProtocolVersion;
  readonly installedModuleIds: readonly string[];
}

export interface GraphModule {
  readonly manifest: GraphModuleManifest;
  readonly capabilities: readonly GraphCapabilityBase[];
  onInstall?(context: GraphModuleLifecycleContext): void | Promise<void>;
  onUninstall?(context: GraphModuleLifecycleContext): void | Promise<void>;
}

export interface GraphModuleDefinition {
  readonly manifest: GraphModuleManifest;
  readonly capabilities: readonly GraphCapabilityBase[];
  onInstall?(context: GraphModuleLifecycleContext): void | Promise<void>;
  onUninstall?(context: GraphModuleLifecycleContext): void | Promise<void>;
}

export interface GraphAuthorizationRequest {
  readonly operationId: string;
  readonly moduleId: string;
  readonly capability: GraphCapabilityDescriptor;
  readonly mode: GraphExecutionMode;
  readonly graph?: GraphReference;
  readonly idempotencyKey?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface GraphExecutionPolicy {
  authorize(request: GraphAuthorizationRequest): boolean | Promise<boolean>;
}

export interface GraphDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly source?: string;
}

export interface GraphExecutionReceipt {
  readonly operationId: string;
  readonly moduleId: string;
  readonly capabilityId: string;
  readonly capabilityVersion: string;
  readonly protocol: GraphProtocolVersion;
  readonly mode: GraphExecutionMode;
  readonly determinism: GraphDeterminism;
  readonly sideEffects: GraphSideEffects;
  readonly idempotencyKey?: string;
  readonly graph?: GraphReference;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly durationMs: number;
  readonly status: 'succeeded';
}

export interface GraphExecutionResult<Output> {
  readonly value: Output;
  readonly receipt: GraphExecutionReceipt;
  readonly diagnostics: readonly GraphDiagnostic[];
}

export type GraphRuntimeEvent =
  | {
      readonly type: 'execution.started';
      readonly operationId: string;
      readonly moduleId: string;
      readonly capability: GraphCapabilityDescriptor;
      readonly mode: GraphExecutionMode;
      readonly startedAt: number;
    }
  | {
      readonly type: 'execution.succeeded';
      readonly receipt: GraphExecutionReceipt;
    }
  | {
      readonly type: 'execution.failed';
      readonly operationId: string;
      readonly moduleId: string;
      readonly capabilityId: string;
      readonly mode: GraphExecutionMode;
      readonly startedAt: number;
      readonly finishedAt: number;
      readonly error: unknown;
    }
  | {
      readonly type: 'execution.denied';
      readonly operationId: string;
      readonly moduleId: string;
      readonly capabilityId: string;
      readonly mode: GraphExecutionMode;
      readonly reason: string;
    };

export interface GraphRuntimeObserver {
  readonly id: string;
  observe(event: GraphRuntimeEvent): void | Promise<void>;
}

export function defineGraphCapability<Input, Output>(
  definition: GraphCapabilityDefinition<Input, Output>,
): GraphCapability<Input, Output> {
  return {
    descriptor: definition.descriptor,
    async invoke(input: Input, context: GraphExecutionContext): Promise<Output> {
      const parsedInput = definition.input.parse(input);
      const value = await definition.execute(parsedInput, context);
      return definition.output.parse(value);
    },
    async invokeRaw(input: unknown, context: GraphExecutionContext): Promise<unknown> {
      const parsedInput = definition.input.parse(input);
      const value = await definition.execute(parsedInput, context);
      return definition.output.parse(value);
    },
  };
}

export function defineGraphModule(definition: GraphModuleDefinition): GraphModule {
  return {
    manifest: definition.manifest,
    capabilities: definition.capabilities,
    onInstall: definition.onInstall,
    onUninstall: definition.onUninstall,
  };
}
