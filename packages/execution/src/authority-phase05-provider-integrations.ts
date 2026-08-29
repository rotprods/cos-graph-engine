// Additive provider-integration surface for Phase 05 hardening.
// Package-root promotion remains deferred to Phase 07.

export * from './authority-phase05-deployment';
export {
  AuthorityJsonIdempotencyInspector,
  type AuthorityJsonInspectionTargetFactory,
  type AuthorityJsonIdempotencyInspectorOptions,
} from './authority-json-idempotency-inspector';
