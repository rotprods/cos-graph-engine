# TASKS — COS Graph Engine 10/10 Authority Program

## Program status

- North Star: `20/20 verticals at Authority 10.0`
- Current phase: `05 — SECURITY / CONCURRENCY / AGENT RUNTIME`
- Checkpoints: Phase01 `76dfdc7`, Phase02 `06487e7`, Phase03 `ad6a93c`, Phase04 `bedfec6`
- Draft PR chain: `#40 → #43 → #44 → #45`
- Authority: `SHADOW_ONLY`
- Automatic CI/CD: `OFF`
- Todoist project: `COS GRAPH ENGINE · 10/10 AUTHORITY PROGRAM` (`6hMP59rWj7f5xH7M`)

## Phase 00 — North Star & control plane — COMPLETE
- [x] Evidence-backed North Star, 20D audit, Todoist/Drive/GitHub control plane and Build/Assurance/Authority scoring.

## Phase 01 — Canonical reconciliation — COMPLETE_STATIC
- [x] Reconcile #34/#35 from #33, select one authority owner per capability, freeze `checkpoint/phase-01-reconciled-76dfdc7`.

## Phase 02 — Contracts / compatibility / deletion governance — COMPLETE_STATIC
- [x] Legacy evidence law, additive authority evidence, ADRs, compatibility matrix, rollback map, API policy, deletion governance and read-only migration projections.
- [x] Freeze `checkpoint/phase-02-contracts-06487e7`.

## Phase 03 — Core correctness — COMPLETE_STATIC
- [x] Copy-safe CAS/idempotency.
- [x] PropertyGraph read/index/traversal correctness.
- [x] Strict canonical serialization and provider-aware identity.
- [x] Deterministic multiedge forward/reverse CSR.
- [x] Additive authority contracts, ADR-007/008 and rollback/deletion governance.
- [x] Freeze `checkpoint/phase-03-core-ad6a93c`.

## Phase 04 — Temporal / Event / Persistence — COMPLETE_STATIC

### P04.1 EventLog semantic parity
- [x] Shared payload-bound logical-event contract for InMemory/Postgres.
- [x] Same logical retry converges across changing attempt IDs/recordedAt.
- [x] Same key + different semantic event fails closed.
- [x] Copy-safe append/get/getByKey/readFrom.
- [x] Shared cursor/limit/order validation.
- [x] Fake-Postgres parity contract.

### P04.2 Canonical persisted payloads
- [x] Canonical JSON wire v1.
- [x] Optional object `undefined` omission only at wire boundary.
- [x] Explicit serialization/integrity versioning.
- [x] JSON/JSONB roundtrip-stable hashes.
- [x] Additive canonical-wire contract.

### P04.3 Knowledge transaction/saga
- [x] Authority ledger separated from rebuildable PropertyGraph projection.
- [x] Projection failure represented as explicit degraded saga evidence.
- [x] Retry repairs projection without duplicating accepted truth.
- [x] Failure-injection contract.

### P04.4 Temporal semantics beyond memory
- [x] Append-only valid/system-time authority knowledge revisions.
- [x] No future correction/closure leakage into historical knownAt.
- [x] Provenance/epistemic/confidence/scope/sensitivity first-class.
- [x] Domain closure distinct from transaction-time supersession.

### P04.5 Postgres/Supabase semantic fixtures
- [x] Driver-neutral fake EventLog executor.
- [x] Driver-neutral fake authority Knowledge executor.
- [x] Driver-neutral fake Hub snapshot executor.
- [x] Transaction/CAS/JSON-roundtrip assertions without production DB mutation.

### P04.6 Replay / restore contracts
- [x] Corrupted snapshot failure.
- [x] Schema and serialization mismatch failure.
- [x] Empty projection snapshot + tail restore.
- [x] Deterministic final semantic hash.
- [x] Command/outcome tail replay without re-deciding history.
- [x] Event-log-behind-snapshot failure.

- [x] Update authority ownership/deletion/evidence manifests.
- [x] Publish `docs/hardening/PHASE_04_CLOSURE.md`.
- [x] Freeze `checkpoint/phase-04-temporal-event-bedfec6` @ `bedfec6b8ea147c91ac7d50a888c38b0439d53ff`.

**Checkpoint:** `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`. Assurance remains unchanged.

## Phase 05 — Security / Concurrency / Agent Runtime — ACTIVE

### P05.1 Durable side-effect ledger
- [ ] Define operation states: `claimed → prepared → executing → effect_observed → committed|failed|uncertain|compensation_required|compensated`.
- [ ] Bind operation identity to principal, project, resource, capability/action and canonical request hash.
- [ ] Persist immutable attempts/outcomes/provider references.
- [ ] Same operation key + same request converges; conflict fails closed.
- [ ] Crash after provider mutation but before result commit becomes `uncertain`, never silently retried as new work.
- [ ] Add in-memory reference store + Postgres/Supabase candidate + additive crash-window contracts.

### P05.2 Resource-bound fencing
- [ ] Issue monotonic fencing tokens per resource.
- [ ] Validate owner/token/fencing version at the actual resource commit boundary.
- [ ] Reject stale owner even if it retains a formerly valid local lease token.
- [ ] Record stale-write near miss.

### P05.3 Lease lifecycle and recovery
- [ ] Acquire/renew/release/expire/reacquire with bounded TTL.
- [ ] Deterministic clock injection.
- [ ] Crash recovery and orphan-owner reconciliation.
- [ ] No indefinite lock or silent lease stealing.

### P05.4 Durable agent aggregate
- [ ] Immutable goal/plan/step/result snapshots.
- [ ] Persist transition/outcome trace and acceptance evidence.
- [ ] Resume after restart without replaying already accepted side effects.
- [ ] Explicit compensation/waiver for partial failure.

### P05.5 Policy enforcement
- [ ] Principal/project/sensitivity model.
- [ ] Policy applied at server, retrieval, memory, tool, workflow and destructive boundaries.
- [ ] Unknown field/operator/action fails closed.
- [ ] Approval state is durable and non-forgeable.

### P05.6 HTTP/FS deployment isolation
- [ ] URL/path guard plus DNS/egress and filesystem sandbox contract.
- [ ] SSRF rebinding, private network, symlink and TOCTOU threat cases.
- [ ] Document which layer owns each defense.

### P05.7 Near-miss evidence
- [ ] Duplicate operation, stale fencing, lease conflict/expiry, policy deny, uncertain provider outcome and compensation failure emit immutable evidence.
- [ ] Observation failure cannot change protected operation outcome.

**Phase 05 checkpoint:** stale, duplicate, unauthorized or crash-recovered workers cannot create uncontrolled external effects or falsely report exactly-once completion.

## Phase 06 — Hub / Memory / GraphRAG / Observability
- [x] Candidate GraphRAG/context/memory/Hub/knowledge paths implemented.
- [ ] Complete AuthorityTelemetry integration, gold-query set and cross-project leakage evidence.

## Phase 07 — Test Truth / Manual CI
- [ ] Manual full matrix, clean lockfile/toolchain pin, legacy/orphan/authority suites, failure-red proof, exact qualification SHA and new W13.

## Phase 08 — Evidence Campaign
- [ ] Security, contention, replay, restore, failure injection, scientific benchmarks, cold-agent resume and evidence manifest.

## Phase 09 — Authority Qualification / Merge
- [ ] Final 20D re-audit, independent review, evidence-based scores, expected-SHA merge, separate deployment decision and promotion only at D01–D20=10.0.