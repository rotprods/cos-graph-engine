// Additive Phase 05 deployment-facing authority surface.
//
// Import explicitly during hardening. Package-root promotion remains deferred to
// Phase 07 compatibility and evidence gates.

export * from './authority-phase05-observed';
export {
  NodePinnedHttpsTransport,
  type NodePinnedHttpsTransportOptions,
  type NodePinnedHttpsResponse,
} from './authority-node-pinned-http-transport';
export {
  AuthorityLeaseRetryPlanner,
  type AuthorityLeaseRetryPlannerOptions,
} from './authority-provider-lease-retry-planner';
