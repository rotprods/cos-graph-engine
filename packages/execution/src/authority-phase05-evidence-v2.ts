// Current failure-isolated capability evidence surface.
// Package-root promotion remains deferred to Phase 07.

export * from './authority-phase05-current';
export {
  ObservedAuthorityCapabilityRuntimeV2,
  buildAuthorityCapabilitySignalV2,
  classifyCapabilityErrorV2,
  type AuthorityCapabilitySignalTypeV2,
  type AuthorityCapabilityOutcomeV2,
  type AuthorityCapabilitySignalV2,
  type IAuthorityCapabilitySignalSinkV2,
  type AuthorityCapabilityTelemetryStartV2,
  type AuthorityCapabilityTelemetryTerminalV2,
  type IAuthorityCapabilityTelemetryV2,
  type AuthorityCapabilityRuntimePortV2,
  type AuthorityCapabilityObserverFailureV2,
} from './authority-capability-evidence-v2';
export {
  InMemoryAuthorityCapabilitySignalStoreV2,
  type AuthorityCapabilitySignalQueryV2,
  type AuthorityCapabilitySignalAppendResultV2,
} from './authority-capability-signal-store-v2';
