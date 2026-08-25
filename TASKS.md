# TASKS — COS Graph Engine 10/10 Authority Program

## Program status

- North Star: `20/20 verticals at Authority 10.0`
- Current phase: `01 — RECONCILIATION #34 + #35`
- Active draft PR: `#40`
- Authority: `SHADOW_ONLY`
- Automatic CI/CD: `OFF`
- Todoist project: `COS GRAPH ENGINE · 10/10 AUTHORITY PROGRAM` (`6hMP59rWj7f5xH7M`)

## Phase 00 — North Star & control plane

- [x] Define evidence-backed 10/10 North Star.
- [x] Complete 20D audit and full-stack adversarial review.
- [x] Create isolated Todoist project under Ecosistema rotprods Perfeccion.
- [x] Establish Build / Assurance / Authority scoring.
- [x] Persist GitHub ↔ Drive ↔ Todoist synchronization contract.

**Checkpoint:** governance truth exists in all three planes.

## Phase 01 — Reconcile #34 and #35

### Control and decisions

- [x] Create `hardening/canonical-authority-reconciliation` from #33.
- [x] Record source refs, divergence and capability inventories.
- [x] Define canonical capability decisions C01–C13.
- [x] Create semantic deletion ledger.
- [x] Open draft reconciliation PR #40.

### Low-conflict primitive ports

- [x] Port strict tool runtime with provenance.
- [x] Port AuthorityTelemetry with export wiring.
- [x] Port immutable EventBus delivery-failure observation.
- [x] Port semantic GitHub webhook fixtures.

### Canonical authority kernels

- [x] Implement one `AuthorityStateMachine` combining transactional mutation with expected-state/revision fencing.
- [x] Implement one append-only revisioned `AuthorityAgenticRegistry` with canonical identity and object/projection CAS.
- [x] Implement one atomic `AuthorityGraphRAGIndex` with projection version/hash CAS and temporal/scope filtering.
- [x] Add authority state-machine and registry contract scripts.
- [ ] Bind verified ContextPack compilation to the single authority GraphRAG projection.
- [ ] Mark legacy L11 GraphRAG explicitly shadow/deprecated and document migration.
- [ ] Converge Hub command/outcome replay, query, snapshot, recovery and context paths.
- [ ] Redesign authority memory as append-only epistemic/system-time revisions.

### Surface and governance closure

- [ ] Resolve every remaining overlapping file explicitly.
- [ ] Produce package/export/API behavior diff.
- [ ] Complete deletion ledger for all material replacements.
- [ ] Eliminate ambiguous duplicate authority paths.
- [ ] Reconcile package exports, TypeScript graphs and lockfile inputs.
- [ ] Freeze the reconciled candidate.
- [ ] Recreate W13 from the reconciled candidate.

**Checkpoint:** one canonical candidate contains every selected capability from both siblings, one authority owner exists per capability, compatibility paths are labeled, and W13 descends from PR #40 lineage.

## Phase 02 — Contracts, compatibility and deletion governance

- [ ] Preserve legacy tests as a separate suite.
- [ ] Add authority tests without rewriting historical evidence.
- [ ] Complete deletion ledger for every >50-line replacement.
- [ ] Create ADR index and compatibility decisions.
- [ ] Create rollback map per capability and data model.

**Checkpoint:** every intentional behavior change has migration, evidence and rollback.

## Phase 03 — Core correctness

- [ ] Make CAS values deeply immutable/copy-safe.
- [ ] Make PropertyGraph reads, queries and traversals clone-safe.
- [ ] Correct traversal direction/depth/path invariants.
- [ ] Restrict stable serialization to supported canonical JSON-like values.
- [ ] Add Unicode/provider normalization to canonical identity.
- [ ] Consolidate authority CSR: multiedges, reverse CSR, deterministic hash and invariants.

**Checkpoint:** graph/identity/state mutation cannot bypass canonical APIs or leave derived indexes stale.

## Phase 04 — Temporal, event and persistence

- [ ] Implement append-only system-time revisions across authority memory and knowledge domains.
- [ ] Separate domain validity closure from transaction-time supersession.
- [ ] Unify in-memory/Postgres event idempotency semantics.
- [ ] Make KnowledgeGraph transactional or saga-compensable.
- [ ] Complete snapshot integrity and deterministic replay.
- [ ] Complete corrupted-snapshot and empty-database restore.
- [ ] Add Postgres/Supabase semantic fixtures.

**Checkpoint:** historical validAt/knownAt queries, replay and restore produce evidence-equivalent state.

## Phase 05 — Security, concurrency and agent runtime

- [ ] Implement durable side-effect ledger.
- [ ] Validate fencing at the resource commit boundary.
- [ ] Add lease renewal, expiry, reacquisition and crash recovery.
- [ ] Make goal/plan/result aggregates immutable and durable.
- [ ] Complete principal/scope/sensitivity policy model.
- [ ] Add deployment-level HTTP/FS isolation defenses.
- [ ] Connect operational near-miss evidence.

**Checkpoint:** stale/duplicate/unauthorized workers cannot create uncontrolled side effects.

## Phase 06 — Hub, memory, GraphRAG and observability

- [ ] Complete one canonical authority GraphRAG + ContextPack path.
- [ ] Implement append-only epistemic memory with deep immutability.
- [ ] Replay Hub outcomes rather than re-deciding commands.
- [ ] Complete scope/temporal/provenance-safe ContextPacks.
- [ ] Instrument canonical paths with AuthorityTelemetry without making it a single point of failure.
- [ ] Build gold-query evaluation set.

**Checkpoint:** a fresh authorized agent receives bounded, deterministic, evidence-backed context with no cross-project leakage.

## Phase 07 — Test truth and manual CI

- [ ] Rework PR #37 into a manual full verification matrix.
- [ ] Regenerate lockfile from a clean install.
- [ ] Pass legacy and strict authority typechecks.
- [ ] Run all orphan/excluded suites.
- [ ] Add contract/property/mutation/negative tests.
- [ ] Preserve coverage, benchmark and Docker qualification artifacts.
- [ ] Prove required failures make the manual gate red.

**Checkpoint:** no test is orphaned, no required failure is suppressed and verification breadth is retained at zero automatic spend.

## Phase 08 — Evidence campaign

- [ ] Security diff scan and threat model.
- [ ] CAS/lease/fencing/idempotency contention campaign.
- [ ] Event/graph/context deterministic replay.
- [ ] Corrupted snapshot and empty-DB restore drill.
- [ ] Failure-injection/degraded-mode campaign.
- [ ] Scientific benchmark campaign.
- [ ] Blind cold-agent resume.
- [ ] Evidence manifest per commit and vertical.

**Checkpoint:** all mandatory evidence gates are green and reproducible.

## Phase 09 — Authority qualification and merge

- [ ] Perform final adversarial 20D re-audit.
- [ ] Obtain independent write-enabled review.
- [ ] Promote scores only from linked evidence.
- [ ] Consolidate into a canonical reviewable PR.
- [ ] Merge with expected SHA and rollback checkpoint.
- [ ] Decide deployment separately; keep CD off until explicitly authorized.
- [ ] Promote `SHADOW_ONLY` → `AUTHORITY_READY` only when D01–D20 = 10.0.
- [ ] Persist final Acta, STATE, HANDOFF and Todoist closure.

**Checkpoint / North Star:** COS is deterministic, secure, durable, replayable, recoverable, concurrency-safe and cold-startable with 20/20 Authority scores at 10.0.