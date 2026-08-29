// Additive platform integration surface for Phase 05 hardening.
// Package-root promotion remains deferred to Phase 07.

export * from './authority-phase05-provider-integrations';
export {
  AuthorityNodeFileHandleExecutor,
  type AuthorityNodeFileHandleRegistration,
  type AuthorityNodeFileReadResult,
  type AuthorityNodeFileWriteResult,
  type AuthorityNodeFileStatResult,
} from './authority-node-file-handle-executor';
