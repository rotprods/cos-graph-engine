// Additive observed authority surface.
//
// Package-root promotion remains deferred to the Phase 07 compatibility gate.
// Consumers evaluating Phase 05 should import this file explicitly.

export * from './authority-phase05-current';
export {
  ObservedAuthorityCapabilityRuntime,
  buildAuthorityCapabilitySignal,
  type AuthorityCapabilitySignalType,
  type AuthorityCapabilityOutcome,
  type AuthorityCapabilitySignal,
  type IAuthorityCapabilitySignalSink,
  type AuthorityCapabilityTelemetryStart,
  type AuthorityCapabilityTelemetryTerminal,
  type IAuthorityCapabilityTelemetry,
  type AuthorityCapabilityRuntimePort,
  type AuthorityCapabilityObserverFailure,
} from './authority-capability-evidence';
