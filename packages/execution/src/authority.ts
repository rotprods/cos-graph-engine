// Canonical Phase 05 authority surface.
//
// Raw implementation modules remain internal so callers cannot bypass the
// crash-reconciliation runtime or accidentally select a superseded Postgres
// prototype. Package-root export wiring is deferred to the explicit Phase 07
// API/compatibility gate.

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
  type AuthorityReconciliationInput,
  type AuthorityCompensationRequiredInput,
  type AuthorityCompensationCompleteInput,
} from './authority-side-effect';

export {
  InMemoryAuthorityFencingValidator,
} from './authority-side-effect-coordinator';
