# Phase 01 — Semantic Replacement / Deletion Ledger Addendum

This addendum supplements `DELETION_LEDGER.md`. The current reconciliation is intentionally additive, so most entries describe **proposed future retirement** rather than code already deleted.

No entry below authorizes removal before its evidence gate is complete.

## DEL-2026-007 — Legacy L11 GraphRAG → AuthorityGraphRAGIndex

- **Source:** `packages/graph/src/level11-graphrag.ts` / `GraphRAGEngine`.
- **Replacement:** `packages/graph/src/authority-graphrag-index.ts` / `AuthorityGraphRAGIndex`.
- **Previous behavior:** incremental mutable entities/chunks/relations; relation IDs generated randomly; scoped retrieval existed but accepted mutable current state.
- **Reason:** deterministic replay, atomic versioned projections, projection CAS, mandatory provenance and explicit system-knowledge filtering.
- **Observable delta:** authority callers cannot incrementally mutate projection truth; they replace a complete versioned projection and must supply/accept exact version/hash semantics.
- **Compatibility:** legacy remains `SHADOW_DEPRECATED`; no deletion yet.
- **Evidence required:** strict typecheck, authority context contracts, gold-query parity, leakage tests, deterministic replay hash.
- **Rollback:** remove authority export and continue legacy shadow path; no durable data migration has been executed.
- **Status:** `IMPLEMENTED_PENDING_EVIDENCE`.

## DEL-2026-008 — Legacy ContextPackCompiler → AuthorityContextPackCompiler

- **Source:** `packages/graph/src/context-pack.ts` / `ContextPackCompiler`.
- **Replacement:** `packages/graph/src/authority-context-pack.ts` / `AuthorityContextPackCompiler`.
- **Previous behavior:** concrete legacy GraphRAG dependency, implicit generated wall-clock time, version-only stale check.
- **Reason:** authority packs must be deterministic, scope-safe, provenance-backed and integrity-verifiable.
- **Observable delta:** callers must provide `asOf`, `knownAt`, `generatedAt`, expected projection version and expected projection hash; verified packs carry SHA-256 integrity.
- **Compatibility:** migration-required; legacy remains shadow.
- **Evidence required:** context contract, tamper test, stale version/hash tests, cross-project/sensitivity leakage tests.
- **Rollback:** restore callers to legacy compiler; no persistence migration.
- **Status:** `IMPLEMENTED_PENDING_EVIDENCE`.

## DEL-2026-009 — CosHub repository runtime → AuthorityHub

- **Source:** `packages/hub/src/hub.ts` / `CosHub`.
- **Replacement:** `packages/hub/src/authority-hub.ts` plus `authority-query.ts`, `authority-context-projector.ts`, `authority-store.ts`.
- **Previous behavior:** repo events were persisted and transition logic could be re-executed during replay; repository runtime did not own a complete command/outcome contract.
- **Reason:** replay must reproduce recorded outcomes, not reinterpret historical commands under newer code.
- **Observable delta:** authority mutation creates command + accepted/rejected outcome events; command-without-outcome is degraded/incomplete state and blocks snapshot/replay completion; snapshots use semantic state hashes plus SHA-256 envelope integrity.
- **Compatibility:** legacy Hub remains shadow until recovery/replay evidence passes.
- **Evidence required:** authority Hub contract, failed-outcome-store fixture, full replay equivalence, snapshot+tail replay, corrupted-snapshot and Postgres adapter fixtures.
- **Rollback:** remove authority Hub exports and keep `CosHub` shadow; event data written by the authority path must not be interpreted as legacy state-change events.
- **Status:** `IMPLEMENTED_PENDING_EVIDENCE`.

## DEL-2026-010 — Current-row memory authority drafts → append-only AuthorityMemoryGateway

- **Source:** `MemoryManager`, `PostgresMemoryStore` and sibling W12.4 current-row authority adapters.
- **Replacement:** `AuthorityMemoryGateway` + `AuthorityMemoryCoordinator` + append-only revision store + `PostgresAuthorityMemoryStore`.
- **Previous behavior:** current-row updates could overwrite fields such as validity/record time; historical `knownAt` could therefore inherit future corrections.
- **Reason:** real bi-temporal semantics require immutable transaction-time history.
- **Observable delta:** a correction creates a new revision; `systemUntil` is derived, never back-written; late retries resolve against their original parent/operation; relation visibility propagates endpoint sensitivity at the query cutoff.
- **Compatibility:** legacy stores remain cache/shadow; authority callers migrate to Gateway.
- **Evidence required:** late-correction query contracts, future-revision non-leakage, reclassification relation-leakage tests, concurrent CAS, Postgres semantic parity and restore/rebuild.
- **Rollback:** stop authority writes and retain immutable revision rows; do not destructively down-migrate historical revisions into one current row.
- **Status:** `IMPLEMENTED_PENDING_EVIDENCE`.

## DEL-2026-011 — Versioned/transactional state drafts → AuthorityStateMachine

- **Source:** legacy `StateMachine` and divergent W12.4 state implementations.
- **Replacement:** `packages/graph/src/authority-state-machine.ts` / `AuthorityStateMachine`.
- **Previous behavior:** either lacked revision fencing or used a sibling implementation with competing callback-failure semantics.
- **Reason:** one mutation queue and one authority owner are required.
- **Observable delta:** staged callback state is committed only after internal success; expected-state/revision mismatch fails closed; snapshot restore validates definition identity/hash.
- **Compatibility:** legacy remains shadow; migration required for callers that mutate leaked context.
- **Evidence required:** authority state contract, serialization/contention, callback-failure, timer-fencing and restore tests.
- **Rollback:** restore legacy caller wiring; no durable schema migration.
- **Status:** `IMPLEMENTED_PENDING_EVIDENCE`.

## Closure rule

These entries may move to `ACCEPTED` only when the exact final candidate SHA is fixed and the required evidence is linked. A model assertion or green unrelated suite does not satisfy the gate.
