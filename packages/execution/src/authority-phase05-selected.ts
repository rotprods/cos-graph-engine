// Single selected additive Phase 05 hardening surface.
//
// It is intentionally not exported from the package root until Phase 07 proves
// compatibility and removes alternate authority paths. Import this module
// explicitly for the current candidate.

export * from './authority-phase05-repair';
export {
  AuthorityLeaseRetryPlanner,
  type AuthorityLeaseRetryPlannerOptions,
} from './authority-provider-lease-retry-planner';
export {
  AuthorityJsonIdempotencyInspector,
  type AuthorityJsonInspectionTargetFactory,
  type AuthorityJsonIdempotencyInspectorOptions,
} from './authority-json-idempotency-inspector';
export {
  NodePinnedHttpsTransport,
  type NodePinnedHttpsTransportOptions,
  type NodePinnedHttpsResponse,
} from './authority-node-pinned-http-transport';
export {
  AuthorityNodeFileHandleExecutorV2,
  type AuthorityNodeFileHandleRegistrationV2,
  type AuthorityNodeFileHandleResultV2,
} from './authority-node-file-handle-executor-v2';
