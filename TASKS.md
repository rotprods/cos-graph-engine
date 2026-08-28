# TASKS — COS Graph Engine 10/10 Authority Program

## Program status

- North Star: `20/20 verticals at Authority 10.0`
- Current phase: `03 — CORE CORRECTNESS`
- Phase 01 checkpoint: `checkpoint/phase-01-reconciled-76dfdc7`
- Phase 02 checkpoint: `checkpoint/phase-02-contracts-06487e7`
- Phase 01 PR: `#40`
- Phase 02 PR: `#43`
- Authority: `SHADOW_ONLY`
- Automatic CI/CD: `OFF`
- Todoist project: `COS GRAPH ENGINE · 10/10 AUTHORITY PROGRAM` (`6hMP59rWj7f5xH7M`)

## Phase 00 — North Star & control plane — COMPLETE

- [x] Define evidence-backed 10/10 North Star.
- [x] Complete 20D audit and full-stack adversarial review.
- [x] Create isolated Todoist project.
- [x] Establish Build / Assurance / Authority scoring.
- [x] Persist GitHub ↔ Drive ↔ Todoist synchronization contract.

## Phase 01 — Reconcile #34 and #35 — COMPLETE_STATIC

- [x] Canonical branch from #33 and source-lineage inventory.
- [x] C01–C13 ownership decisions and deletion ledger.
- [x] Strict tool runtime, AuthorityTelemetry, EventBus failure observation, provider fixtures.
- [x] AuthorityStateMachine.
- [x] AuthorityAgenticRegistry.
- [x] AuthorityGraphRAGIndex.
- [x] AuthorityContextPackCompiler.
- [x] AuthorityHub runtime/query/context/recovery.
- [x] Append-only AuthorityMemory candidate.
- [x] Additive authority contract scripts.
- [x] Authority surface manifest/API diff/lockfile truth/source coverage.
- [x] Freeze `checkpoint/phase-01-reconciled-76dfdc7`.

**Checkpoint:** `STATIC_RECONCILIATION_COMPLETE / IMPLEMENTED_UNVERIFIED`.

## Phase 02 — Contracts, compatibility and deletion governance — COMPLETE_STATIC

- [x] Preserve legacy tests through machine-readable immutable evidence manifest.
- [x] Initialize explicit waiver registry for intentional legacy test changes.
- [x] Add executable legacy-test preservation gate.
- [x] Add authority tests without rewriting historical evidence.
- [x] Create ADR-001…ADR-006 + ADR index.
- [x] Create legacy→authority compatibility matrix.
- [x] Create rollback map covering code/data/event/operational recovery.
- [x] Create machine-readable deletion governance + >50-line executable gate.
- [x] Add read-only migration projections that cannot become alternate authority writers.
- [x] Add additive compatibility mutation-isolation contract.
- [x] Define public API stability/deprecation policy.
- [x] Define linear descendant branch law through Phase 07.
- [x] Freeze `checkpoint/phase-02-contracts-06487e7`.
- [x] Publish `PHASE_02_CLOSURE.md`.

**Checkpoint:** every intended behavior change now has a compatibility/rollback/evidence framework. Gates remain unexecuted; Assurance unchanged.

## Phase 03 — Core correctness — ACTIVE

### P03.1 CAS deep safety
- [ ] Make VersionedStore/CAS reads and snapshots deeply detached or immutable.
- [ ] Ensure nested caller mutation cannot change canonical state without version/hash change.
- [ ] Reject unsupported non-canonical values on authority CAS path.
- [ ] Add stale-write + nested-mutation adversarial authority contract.

### P03.2 PropertyGraph correctness
- [ ] Make getNode/getEdge/query/traversal outputs detached from canonical graph state.
- [ ] Preserve type/tag/source/target secondary indices atomically on updates.
- [ ] Validate edge endpoints and duplicate identity invariants.
- [ ] Add mutation-bypass/index-corruption authority contracts.

### P03.3 Traversal invariants
- [ ] Reject fractional/negative/unsafe depth.
- [ ] Define exact depth=0 semantics.
- [ ] Enforce directed-edge traversal direction unless explicitly overridden.
- [ ] Ensure paths contain both edge endpoints and consistent edge/node counts.
- [ ] Add traversal negative/property-style contracts.

### P03.4 Canonical serialization
- [ ] Restrict deterministic serializer to explicit supported JSON-like values.
- [ ] Reject Date/Map/Set/class instances/functions/symbols/undefined/non-finite numbers.
- [ ] Reject cycles.
- [ ] Preserve deterministic key ordering and number/string semantics.

### P03.5 Canonical identity normalization
- [ ] Add Unicode normalization.
- [ ] Define provider/scheme normalization profiles.
- [ ] Normalize aliases with the same provider rules.
- [ ] Keep deterministic ID hashing separate from SHA-256 integrity.
- [ ] Add confusable/case/Unicode normalization contracts.

### P03.6 Authority CSR
- [ ] Select one canonical multiedge-capable CSR surface.
- [ ] Maintain forward + reverse CSR.
- [ ] Make reverse traversal O(in-degree).
- [ ] Remove queue.shift() from hot traversal loops.
- [ ] Add deterministic edge identity/projection hash/invariant validation.
- [ ] Add parallel-edge/reverse-index/replay contracts.

**Phase 03 checkpoint:** graph/identity/state mutation cannot bypass canonical APIs or leave derived indices/hash/version stale.

## Phase 04 — Temporal, event and persistence

- [x] Append-only system-time authority memory candidate.
- [ ] Extend append-only temporal semantics to knowledge/other authority domains.
- [ ] Separate valid-time closure from transaction-time supersession everywhere.
- [ ] Unify in-memory/Postgres event idempotency semantics.
- [ ] Make KnowledgeGraph transactional or saga-compensable.
- [x] Authority Hub snapshot integrity + snapshot/tail replay candidate.
- [ ] Corrupted snapshot + empty DB restore evidence.
- [ ] Executable Postgres/Supabase semantic fixtures.

## Phase 05 — Security, concurrency and agent runtime

- [ ] Durable side-effect ledger.
- [ ] Resource commit-boundary fencing.
- [ ] Lease renewal/expiry/reacquisition/crash recovery.
- [ ] Immutable durable goal/plan/result aggregates.
- [ ] Principal/scope/sensitivity policy model.
- [ ] Deployment HTTP/FS isolation.
- [ ] Operational near-miss evidence.

## Phase 06 — Hub, memory, GraphRAG and observability

- [x] Canonical GraphRAG + ContextPack candidate.
- [x] Append-only epistemic memory candidate.
- [x] Outcome-based Hub replay candidate.
- [x] Scope/temporal/provenance ContextPacks.
- [x] Hub query/context/snapshot/recovery candidate.
- [ ] Instrument all canonical paths with AuthorityTelemetry.
- [ ] Gold-query evaluation set.
- [ ] Execute cross-project/sensitivity leakage evidence.

## Phase 07 — Test truth and manual CI

- [ ] Rework PR #37 into manual full verification matrix.
- [ ] Regenerate lockfile from clean install.
- [ ] Pin qualification TypeScript/tsx versions.
- [ ] Pass legacy + strict authority typechecks.
- [ ] Run all orphan/excluded suites.
- [ ] Add remaining contract/property/mutation/negative tests.
- [ ] Preserve coverage/benchmark/Docker artifacts.
- [ ] Prove required failures make manual gate red.
- [ ] Freeze exact qualification SHA.
- [ ] Recreate W13 from exact SHA.

## Phase 08 — Evidence campaign

- [ ] Security diff/threat model.
- [ ] CAS/lease/fencing/idempotency contention.
- [ ] Deterministic replay.
- [ ] Corrupted snapshot/empty-DB restore.
- [ ] Failure injection/degraded modes.
- [ ] Scientific benchmarks.
- [ ] Blind cold-agent resume.
- [ ] Evidence manifest per commit/vertical.

## Phase 09 — Authority qualification and merge

- [ ] Final adversarial 20D re-audit.
- [ ] Independent write-enabled review.
- [ ] Promote scores only from linked evidence.
- [ ] Canonical reviewable PR.
- [ ] Merge with expected SHA + rollback checkpoint.
- [ ] Separate deployment decision; CD remains off until authorized.
- [ ] `SHADOW_ONLY` → `AUTHORITY_READY` only when D01–D20 = 10.0.
- [ ] Persist final Acta/STATE/HANDOFF/Todoist closure.
