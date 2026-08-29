// Current additive Phase 05 repair surface.
// Package-root promotion remains deferred to Phase 07.

export * from './authority-phase05-evidence-v2-postgres';
export {
  AuthorityRepairService,
  AuthorityRepairWorker,
  InMemoryAuthorityRepairStore,
  type AuthorityRepairKind,
  type AuthorityRepairState,
  type AuthorityRepairError,
  type AuthorityRepairRevision,
  type AuthorityRepairView,
  type AuthorityRepairAppendResult,
  type IAuthorityRepairStore,
  type AuthorityRepairEnqueueInput,
  type AuthorityRepairClaimInput,
  type AuthorityRepairResolveInput,
  type AuthorityRepairFailInput,
  type AuthorityRepairHandlerContext,
  type AuthorityRepairHandler,
  type AuthorityRepairWorkerOptions,
} from './authority-repair-ledger';
export {
  AuthorityRepairPostgresStore,
  AUTHORITY_REPAIR_POSTGRES_DDL,
  type AuthorityRepairRevisionRow,
} from './authority-repair-store-postgres';
export {
  RepairingAuthorityCapabilityRuntime,
  AuthorityAgentEvidenceRepairHandler,
  AuthorityLeaseReleaseRepairHandler,
  type AuthorityRepairEnqueueFailure,
} from './authority-capability-repair-runtime';
