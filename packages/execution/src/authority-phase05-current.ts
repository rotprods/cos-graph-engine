// Canonical Phase 05 authority surface at the current static checkpoint.
//
// This file is intentionally additive. Package-root promotion remains deferred
// to the Phase 07 API/compatibility gate, where legacy callers, typecheck and
// migration evidence can be evaluated together.

export {
  AuthorityExecutionRuntime,
  type PrepareAuthorityOperationInput,
  type BeginAuthorityOperationInput,
  type CommitAuthorityOperationInput,
} from './authority-execution-runtime';

export {
  AuthoritySideEffectRuntime,
  type MarkProviderOutcomeUnknownInput,
  type ProviderReconciliationResult,
  type ProviderSideEffectReconciler,
  type RecoverInterruptedSideEffectInput,
  type RecoverInterruptedSideEffectResult,
} from './authority-side-effect-runtime';

export {
  AuthoritySideEffectPostgresStore,
  AUTHORITY_SIDE_EFFECT_POSTGRES_DDL,
  type AuthoritySideEffectRevisionRow,
} from './authority-side-effect-store-postgres';

export {
  InMemoryAuthoritySideEffectStore,
  type AuthoritySideEffectState,
  type AuthorityEffectKnowledge,
  type AuthorityOperationError,
  type AuthorityCompensationEvidence,
  type AuthoritySideEffectRevision,
  type AuthoritySideEffectView,
  type AuthoritySideEffectAppendResult,
  type IAuthoritySideEffectStore,
  type AuthorityFencingValidator,
  type AuthoritySideEffectClaimInput,
  type AuthorityPrepareInput,
  type AuthorityCommitInput,
  type AuthorityFailureInput,
  type AuthorityCompensationRequiredInput,
  type AuthorityCompensationCompleteInput,
} from './authority-side-effect';

export {
  AuthorityLeaseService,
  InMemoryAuthorityLeaseStore,
  type AuthorityLeaseStoredState,
  type AuthorityLeaseEffectiveState,
  type AuthorityLeaseRevision,
  type AuthorityLeaseView,
  type AuthorityLeaseAppendResult,
  type IAuthorityLeaseStore,
  type AuthorityLeaseAcquireInput,
  type AuthorityLeaseRenewInput,
  type AuthorityLeaseReleaseInput,
} from './authority-lease';

export {
  AuthorityLeasePostgresStore,
  AUTHORITY_LEASE_POSTGRES_DDL,
  type AuthorityLeaseRevisionRow,
} from './authority-lease-store-postgres';

export {
  AuthorityExecutionObserver,
  ObservedAuthorityExecutionRuntime,
  type AuthorityExecutionSignalType,
  type AuthorityExecutionSignal,
  type IAuthorityExecutionSignalSink,
  type AuthorityObserverFailure,
} from './authority-execution-evidence';

export {
  AuthorityExecutionSignalStore,
} from './authority-execution-signal-store';

export {
  AuthorityPolicyEngine,
  InMemoryAuthorityApprovalStore,
  type AuthoritySensitivity,
  type AuthorityPolicyEffect,
  type AuthorityPrincipal,
  type AuthorityPolicyRequest,
  type AuthorityPolicyRule,
  type AuthorityPolicyRuleInput,
  type AuthorityApprovalGrant,
  type AuthorityApprovalGrantInput,
  type AuthorityPolicyDecision,
  type IAuthorityApprovalStore,
} from './authority-policy';

export {
  PolicyBoundAuthorityExecutionRuntime,
  type AuthorityExecutionPolicyContext,
  type PolicyAuthorizedResult,
} from './authority-policy-bound-runtime';

export {
  AuthorityAgentRunService,
  InMemoryAuthorityAgentRunStore,
  type AuthorityAgentRunState,
  type AuthorityStepOutcome,
  type AuthorityGoalSpec,
  type AuthorityAcceptanceCriterion,
  type AuthorityPlanStep,
  type AuthorityStepResult,
  type AuthorityCriterionResult,
  type AuthorityAgentRunRevision,
  type AuthorityAgentRunView,
  type AuthorityAgentRunAppendResult,
  type IAuthorityAgentRunStore,
  type AuthorityAgentRunCreateInput,
  type AuthorityAgentRunMutationBase,
  type AuthorityAgentRunPlanInput,
  type AuthorityAgentRunStepInput,
  type AuthorityAgentRunCompleteInput,
  type AuthorityAgentRunTerminalInput,
} from './authority-agent-run';

export {
  AuthorityAgentRunPostgresStore,
  AUTHORITY_AGENT_RUN_POSTGRES_DDL,
  type AuthorityAgentRunRevisionRow,
} from './authority-agent-run-store-postgres';

export {
  AuthorityHttpEgressGuard,
  AuthorityFileSandbox,
  type AuthorityHttpMethod,
  type AuthorityResolvedAddress,
  type AuthorityDnsResolver,
  type AuthorityHttpEgressPolicy,
  type AuthorityHttpEgressRequest,
  type AuthorityPinnedHttpTarget,
  type AuthorityFileOperation,
  type AuthorityFileRootPolicy,
  type AuthorityFileOpenRequest,
  type AuthorityFileBrokerResolution,
  type AuthorityFileSystemBroker,
  type AuthorityPinnedFileTarget,
} from './authority-isolation';

export {
  AuthorityPinnedHttpTool,
  AuthorityFileHandleTool,
  createAuthorityProviderRegistry,
  isAuthorityPreflightTool,
  type AuthorityProviderToolMode,
  type AuthorityProviderExecutionBinding,
  type AuthorityPreflightTool,
  type AuthorityPinnedHttpToolInput,
  type AuthorityBoundPinnedHttpToolInput,
  type AuthorityPinnedHttpTransportRequest,
  type AuthorityPinnedHttpTransport,
  type AuthorityFileHandleToolInput,
  type AuthorityFileHandleExecutionRequest,
  type AuthorityFileHandleExecutor,
  type AuthorityProviderToolOptions,
} from './authority-provider-tools';

export {
  AuthorityCapabilityRuntime,
  type AuthorityAgentStepEvidenceRequest,
  type AuthorityReadCapabilityRequest,
  type AuthoritySideEffectTimeline,
  type AuthoritySideEffectCapabilityRequest,
  type AuthorityAgentEvidenceStatus,
  type AuthorityLeaseReleaseStatus,
  type AuthorityReadCapabilityResult,
  type AuthoritySideEffectCapabilityStatus,
  type AuthoritySideEffectCapabilityResult,
  type AuthorityCapabilityRuntimeDependencies,
} from './authority-capability-runtime';

// Reference-only single-process validator. Durable authority deployments should
// use AuthorityLeaseService/AuthorityLeasePostgresStore at the resource boundary.
export {
  InMemoryAuthorityFencingValidator,
} from './authority-side-effect-coordinator';
