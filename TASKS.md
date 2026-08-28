# TASKS — COS Graph Engine 10/10 Authority Program

## Program status

- North Star: `20/20 verticals at Authority 10.0`
- Current phase: `04 — TEMPORAL / EVENT / PERSISTENCE`
- Checkpoints: Phase01 `76dfdc7`, Phase02 `06487e7`, Phase03 `ad6a93c`
- Draft PR chain: `#40 → #43 → #44`
- Authority: `SHADOW_ONLY`
- Automatic CI/CD: `OFF`
- Todoist project: `COS GRAPH ENGINE · 10/10 AUTHORITY PROGRAM` (`6hMP59rWj7f5xH7M`)

## Phase 00 — North Star & control plane — COMPLETE
- [x] Evidence-backed North Star, 20D audit, Todoist/Drive/GitHub control plane, Build/Assurance/Authority scoring.

## Phase 01 — Canonical reconciliation — COMPLETE_STATIC
- [x] Reconcile #34/#35 from #33 without blind merge.
- [x] Select one authority owner per capability.
- [x] Implement state/registry/GraphRAG/context/Hub/memory candidates.
- [x] Freeze `checkpoint/phase-01-reconciled-76dfdc7`.

## Phase 02 — Contracts / compatibility / deletion governance — COMPLETE_STATIC
- [x] Immutable legacy-test evidence policy + executable gate.
- [x] Additive authority evidence.
- [x] ADR-001…ADR-006.
- [x] Compatibility matrix, rollback map, API policy.
- [x] Machine-readable deletion governance + executable gate.
- [x] Read-only migration projections.
- [x] Freeze `checkpoint/phase-02-contracts-06487e7`.

## Phase 03 — Core correctness — COMPLETE_STATIC

### P03.1 CAS deep safety
- [x] Detached VersionedStore constructor/write/read/CAS boundaries.
- [x] Detached idempotency payload/result/record boundaries.
- [x] Stale version/hash fail closed.
- [x] Add copy-safety authority contract.

### P03.2 PropertyGraph correctness
- [x] Detached node/edge/query/traversal values.
- [x] Atomic type/tag/source/target index maintenance.
- [x] Endpoint/identity validation.
- [x] Add mutation/index authority contract.

### P03.3 Traversal invariants
- [x] Safe-integer depth validation.
- [x] Exact depth=0 semantics.
- [x] Directed/undirected direction semantics.
- [x] Path node/edge cardinality and destination correctness.

### P03.4 Canonical serialization
- [x] Add strict `canonicalSerialize/canonicalHash128` authority lane.
- [x] Reject ambiguous/non-canonical JS values and cycles.
- [x] NFC normalization + normalized-key collision rejection.
- [x] Retain legacy stable hash lane explicitly for compatibility.

### P03.5 Identity normalization
- [x] Provider/scheme normalization profiles.
- [x] NFC normalization and alias parity.
- [x] Detached IdentityRegistry reads.
- [x] Keep deterministic identity distinct from SHA-256 integrity.

### P03.6 Authority CSR
- [x] Select BidirectionalCSRGraph; no third CSR.
- [x] Deterministic multiedge identity via identityKey.
- [x] Forward + reverse CSR and O(in-degree) reverse traversal.
- [x] Cursor BFS, deterministic projection hash and stronger invariants.
- [x] Add CSR authority contract.

- [x] ADR-007 / ADR-008, compatibility and Phase03 rollback addendum.
- [x] Classify every >50-line cumulative deletion from Phase01 baseline.
- [x] Freeze `checkpoint/phase-03-core-ad6a93c`.
- [x] Publish `PHASE_03_CLOSURE.md`.

**Checkpoint:** `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`. No Assurance movement.

## Phase 04 — Temporal / Event / Persistence — ACTIVE

### P04.1 EventLog semantic parity
- [ ] Make InMemoryEventLog and PostgresEventLog payload-bound idempotency equivalent.
- [ ] Same logical retry converges even if producer event ID changes.
- [ ] Same idempotency key + different logical payload fails closed.
- [ ] Copy-safe append/get/getByKey/readFrom results.
- [ ] Consistent cursor/limit/order validation.
- [ ] Add adapter-parity authority contract.

### P04.2 Canonical persisted payloads
- [ ] Canonicalize optional signed/snapshotted fields; never sign explicit undefined.
- [ ] Version integrity serialization/algorithm explicitly.
- [ ] Normalize Postgres JSON/timestamp round trips before equality/hash checks.
- [ ] Add round-trip fixtures.

### P04.3 KnowledgeGraph transaction/saga
- [ ] Prevent statement/relation partial commits.
- [ ] Supersession/retraction preserves provenance/history.
- [ ] Add rollback/compensation/degraded-state semantics.
- [ ] Add failure-injection contract.

### P04.4 Temporal semantics beyond memory
- [ ] Add append-only valid/system-time knowledge revisions.
- [ ] No future correction/retraction leakage at historical knownAt.
- [ ] Propagate temporal/provenance rules into authority projection inputs.

### P04.5 Postgres/Supabase semantic fixtures
- [ ] Driver-neutral fake executor for event/memory/Hub adapters.
- [ ] Verify in-memory/Postgres semantic parity without production DB mutation.
- [ ] Verify transaction/concurrency conflict behavior.

### P04.6 Replay / restore contracts
- [ ] Corrupted snapshot failure.
- [ ] Schema mismatch failure.
- [ ] Empty projection snapshot + tail restore.
- [ ] Deterministic final semantic hash.
- [ ] Exactly-once projection replay of post-snapshot events.

**Phase 04 checkpoint:** persisted history answers the same semantic questions across adapters, replay and restore without rewriting past knowledge.

## Phase 05 — Security / Concurrency / Agent Runtime
- [ ] Durable side-effect ledger; resource fencing; leases/recovery; durable goal aggregates; policy principal/scope; deployment isolation; near-miss evidence.

## Phase 06 — Hub / Memory / GraphRAG / Observability
- [x] Candidate GraphRAG/context/memory/Hub paths implemented.
- [ ] Full AuthorityTelemetry integration, gold-query set and leakage execution evidence.

## Phase 07 — Test Truth / Manual CI
- [ ] Manual full matrix, clean lockfile/toolchain pin, all legacy/orphan/authority suites, failure-red proof, exact qualification SHA, recreate W13.

## Phase 08 — Evidence Campaign
- [ ] Security, contention, replay, restore, failure injection, scientific benchmarks, cold-agent resume, evidence manifest.

## Phase 09 — Authority Qualification / Merge
- [ ] Final 20D re-audit, independent review, evidence-based scores, expected-SHA merge, separate deploy decision, promote only at D01–D20=10.0.
