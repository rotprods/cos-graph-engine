// Phase 05 canonical authority surface.
// Package-root export promotion is deferred to the Phase 07 API/compatibility gate.

export {
  AuthorityExecutionRuntime,
  type PrepareAuthorityOperationInput,
  type BeginAuthorityOperationInput,
  type CommitAuthorityOperationInput,
} from './authority-execution-runtime';

export {
  AuthoritySideEffectRuntime,
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
  InMemoryAuthorityFencingValidator,
} from './authority-side-effect-coordinator';
