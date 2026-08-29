# TASKS — COS Graph Engine 10/10 Authority Program

## Program status

- North Star: `20/20 verticals at Authority 10.0`
- Current phase: `05 — SECURITY / CONCURRENCY / AGENT RUNTIME`
- Canonical Phase 05 PR: `#46`
- Phase 05 branch: `hardening/phase-05-security-concurrency-runtime`
- Phase 04 base: `checkpoint/phase-04-temporal-2e15b88`
- Authority: `SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`
- Automatic CI/CD: `OFF`
- Todoist project: `COS GRAPH ENGINE · 10/10 AUTHORITY PROGRAM` (`6hMP59rWj7f5xH7M`)

## Phase 00 — North Star & control plane — COMPLETE

- [x] Evidence-backed North Star, 20D audit, Build/Assurance/Authority scoring and GitHub↔Drive↔Todoist control plane.

## Phase 01 — Canonical reconciliation — COMPLETE_STATIC

- [x] Reconcile #34/#35, select one authority owner per capability and freeze Phase 01 checkpoint.

## Phase 02 — Contracts / compatibility / deletion governance — COMPLETE_STATIC

- [x] Legacy evidence law, additive authority tests, ADRs, compatibility matrix, rollback map, API policy and deletion governance.

## Phase 03 — Core correctness — COMPLETE_STATIC

- [x] Copy-safe CAS/idempotency.
- [x] PropertyGraph read/index/traversal correctness.
- [x] Strict canonical serialization and provider-aware identity.
- [x] Deterministic multiedge forward/reverse CSR.

## Phase 04 — Temporal / Event / Persistence — COMPLETE_STATIC

- [x] EventLog in-memory/Postgres semantic parity.
- [x] Canonical JSON wire v1.
- [x] Append-only bitemporal authority knowledge.
- [x] Rebuildable graph projection with degraded saga evidence.
- [x] Postgres semantic fixtures.
- [x] Hub snapshot integrity and snapshot+tail recovery contracts.
- [x] Freeze `checkpoint/phase-04-temporal-2e15b88`.

**Checkpoint:** source contracts written, not executed; Assurance unchanged.

## Phase 05 — Security / Concurrency / Agent Runtime — ACTIVE

### Governance / lineage

- [x] Use one canonical Phase 05 PR (#46) from frozen Phase 04 checkpoint.
- [x] Close duplicate PR #47 without merge or branch deletion.
- [x] Create canonical additive Phase 05 barrel.
- [x] Create strict Phase 05 typecheck graph and aggregate contract command.
- [x] Reconcile Phase 05 evidence and authority ownership manifests.
- [x] Add ADR-009 for pinned HTTP transport and broker-handle filesystem boundaries.

### P05.1 — Durable side-effect ledger

- [x] Append-only side-effect operation revisions.
- [x] Payload-bound claim and transition idempotency.
- [x] Explicit uncertain/reconciliation and compensation states.
- [x] In-memory authority store.
- [x] Postgres/Supabase-compatible append-only store.
- [x] Provider reconciliation runtime candidate.
- [x] Additive in-memory/Postgres/crash-window contracts written.
- [ ] Add provider-native adapters that inspect actual provider/resource outcomes.

### P05.2 — Resource-bound fencing

- [x] Monotonic fencing tokens.
- [x] Validate lease ID, owner and token before prepare.
- [x] Validate current fencing token before begin/commit.
- [x] Explicit-time stale/expiry rejection.
- [x] Additive stale-fence contracts written.
- [ ] Prove actual provider/resource commit consumes the fence or provider-native idempotency contract.

### P05.3 — Lease lifecycle and recovery

- [x] Acquire/renew/release/expire/reacquire with bounded TTL.
- [x] Deterministic explicit clock.
- [x] Monotonic token after expiry/release reacquisition.
- [x] In-memory lease store.
- [x] Postgres lease store.
- [x] Restart/corruption/advisory-lock contracts written.
- [ ] Integrate lease orphan/reconciliation evidence with the canonical signal path.

### P05.4 — Durable agent aggregate

- [x] Append-only goal/plan/step/result/criterion revisions.
- [x] DAG, dependency and attempt ordering.
- [x] Exact evaluator ID/version acceptance evidence.
- [x] Side-effecting accepted step requires committed operation evidence.
- [x] In-memory run store and restart contract.
- [x] `AuthorityAgentRunPostgresStore` candidate.
- [x] Postgres fixture for operation idempotency, immutable rows, restart and corruption.
- [ ] Bind real capability execution receipts into run-step evidence automatically.

### P05.5 — Policy enforcement

- [x] Default deny.
- [x] Principal, project and sensitivity gates.
- [x] Deny/approval precedence.
- [x] Exact-operation time-bounded approvals.
- [x] Claim/prepare/execute/commit policy facade.
- [x] Policy-decision evidence persisted in operation metadata.
- [ ] Bind the real `CapabilityRouter`/`StrictToolRegistry` path to the policy-bound runtime.

### P05.6 — HTTP / filesystem isolation

- [x] HTTP host/protocol/method/port policy.
- [x] DNS resolution and public-address pinning.
- [x] Private/special-use/mixed answer rejection.
- [x] Decision TTL and redirect reauthorization.
- [x] Filesystem root/operation/traversal defense.
- [x] Trusted broker-opened opaque handle contract.
- [x] Root-prefix escape and symlink control.
- [x] Additive SSRF/DNS/file-handle negative contract written.
- [ ] Implement/test a real pinned HTTP transport with TLS SNI/Host preservation.
- [ ] Implement/test a real platform filesystem broker using openat/dirfd or equivalent.

### P05.7 — Near-miss / execution evidence

- [x] Deterministic content-hashed execution signals.
- [x] Stale fencing rejection evidence.
- [x] Observation failure isolation.
- [x] Detached signal store candidate.
- [ ] Wire policy deny, lease conflict/expiry, isolation denial, uncertain provider outcome and agent-run terminal outcomes.
- [ ] Bridge canonical signals to `AuthorityTelemetry` without making telemetry a SPOF.

### P05.8 — Canonical capability path

- [ ] Implement one facade owning read-only and side-effecting capability execution.
- [ ] Side-effecting path order: isolation → policy → operation claim → lease/fence → begin → provider → commit/reconcile → agent-run evidence.
- [ ] Prevent direct alternate side-effecting `CapabilityRouter` execution in authority mode.
- [ ] Preserve legacy paths as shadow/read-only compatibility until Phase 07.
- [ ] Add end-to-end fake provider contracts for success, deny, stale owner, crash, unknown and partial outcomes.

### P05.9 — Surface closure

- [ ] Resolve/archive superseded Phase 05 prototypes, barrels, tsconfigs, tests and fixtures under deletion governance.
- [ ] Complete compatibility and rollback deltas.
- [ ] Static review of strict TypeScript graph.
- [ ] Freeze one exact Phase 05 checkpoint.

**Phase 05 checkpoint:** stale, duplicate, unauthorized or crash-recovered workers cannot create uncontrolled external effects; one authority capability path owns the transition from request to evidence.

## Phase 06 — Hub / Memory / GraphRAG / Observability

- [x] Candidate GraphRAG/context/memory/Hub/knowledge paths implemented.
- [ ] Complete AuthorityTelemetry integration, gold-query set and cross-project leakage evidence.

## Phase 07 — Test Truth / Manual CI

- [ ] Manual full matrix, clean lockfile/toolchain pin, legacy/orphan/authority suites, failure-red proof and exact qualification SHA.

## Phase 08 — Evidence Campaign

- [ ] Security, contention, replay, restore, failure injection, scientific benchmarks, cold-agent resume and evidence manifest.

## Phase 09 — Authority Qualification / Merge

- [ ] Final 20D re-audit, independent review, evidence-based scores, expected-SHA merge and promotion only at D01–D20=10.0.
