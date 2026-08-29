// Current additive durable capability-evidence surface.
// Package-root promotion remains deferred to Phase 07.

export * from './authority-phase05-evidence-v2';
export {
  AuthorityCapabilitySignalPostgresStoreV2,
  AUTHORITY_CAPABILITY_SIGNAL_POSTGRES_DDL,
  type AuthorityCapabilitySignalRowV2,
} from './authority-capability-signal-store-postgres';
