# HANDOFF — COS Graph Engine

## Recovery point

Phases 01–04 are statically complete. Phase 05 is actively implementing the security/concurrency/agent-runtime authority path.

COS remains:

`SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`

No merge, automatic Action, deployment, release, production database or Supabase mutation has occurred.

## Canonical lineage

- Phase 01: `checkpoint/phase-01-reconciled-76dfdc7` @ `76dfdc737c231b2637f122125f7acf98b735ff1f` — PR #40;
- Phase 02: `checkpoint/phase-02-contracts-06487e7` @ `06487e7acbce82c5a54dbb8dd171dceae2bb67ac` — PR #43;
- Phase 03: `checkpoint/phase-03-core-ad6a93c` @ `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3` — PR #44;
- Phase 04 base: `checkpoint/phase-04-temporal-2e15b88` @ `2e15b88388836b94b97a93753cb4db347e275e7e` — PR #45;
- Phase 05: `hardening/phase-05-security-concurrency-runtime` — canonical draft PR #46.

PR #47 is closed without merge as a duplicate PR view of the Phase 05 head. Do not reopen it as an authority path. The head branch is preserved through PR #46.

Source #34/#35 remain preserved. W13 #36 remains paused/non-authoritative. PR #37 remains draft/rework.

## Read first

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `TASKS.md`
6. `GRAPH.md`
7. `docs/hardening/PHASE_01_CLOSURE.md`
8. `docs/hardening/PHASE_02_CLOSURE.md`
9. `docs/hardening/PHASE_03_CLOSURE.md`
10. `docs/hardening/PHASE_04_CLOSURE.md`
11. `docs/hardening/PHASE_05_EVIDENCE_MANIFEST.v2.json`
12. `docs/hardening/AUTHORITY_SURFACE_MANIFEST.json`
13. `docs/hardening/ADR_INDEX.md`
14. `docs/hardening/adrs/ADR-009-AUTHORITY-ISOLATION-BOUNDARIES.md`
15. `docs/hardening/COMPATIBILITY_MATRIX.md`
16. `docs/hardening/ROLLBACK_MAP.md`
17. `docs/hardening/TEST_EVIDENCE_MANIFEST.json`
18. `docs/hardening/DELETION_GOVERNANCE.json`
19. `AGENTS.md`

## Current Phase 05 code owners

Additive authority barrel:

`packages/execution/src/authority-phase05-current.ts`

### Side effects

- `AuthoritySideEffectRuntime`;
- `InMemoryAuthoritySideEffectStore`;
- `AuthoritySideEffectPostgresStore`;
- `AuthorityExecutionRuntime`.

### Leases/fencing

- `AuthorityLeaseService`;
- `InMemoryAuthorityLeaseStore`;
- `AuthorityLeasePostgresStore`.

### Policy

- `AuthorityPolicyEngine`;
- `InMemoryAuthorityApprovalStore`;
- `PolicyBoundAuthorityExecutionRuntime`.

### Agent runs

- `AuthorityAgentRunService`;
- `InMemoryAuthorityAgentRunStore`;
- `AuthorityAgentRunPostgresStore`.

### Isolation

- `AuthorityHttpEgressGuard`;
- `AuthorityFileSandbox`.

### Evidence

- `AuthorityExecutionObserver`;
- `AuthorityExecutionSignalStore`;
- `AuthorityTelemetry` remains the cross-package observability owner.

## Implemented static guarantees

### External-effect truth

- append-only operation history;
- payload-bound claim and transition idempotency;
- explicit uncertain/reconciliation and compensation semantics;
- provider exception after execution never becomes blind retry;
- in-memory/Postgres stores;
- fencing validation before accepted commit.

### Lease/concurrency

- bounded acquire/renew/release/expire/reacquire;
- monotonic fencing;
- explicit-time evaluation;
- stale owner/token/revision rejection;
- in-memory/Postgres stores.

### Policy

- default deny;
- project/sensitivity/principal isolation;
- exact-operation approvals;
- independent authorization at claim/prepare/execute/commit;
- no protected mutation on denial.

### Durable run aggregate

- append-only goal/plan/step/result/criterion revisions;
- DAG/dependency/attempt rules;
- exact evaluator evidence;
- side-effect step evidence requirements;
- in-memory/Postgres stores and restart/corruption contracts.

### Deployment isolation contracts

- DNS answer pinning, special-use address rejection, redirect reauthorization and TTL;
- canonical root containment, traversal defense, symlink policy and broker-opened opaque handles;
- decision tamper detection;
- explicit rule that normal fetch/path reopen is not authority-equivalent.

### Evidence

- deterministic execution signals;
- stale fencing near-miss evidence;
- observer failure isolation.

All of these remain `WRITTEN_UNEXECUTED`.

## Next exact implementation slice

### P05.8 — canonical capability path

Build one additive facade; do not mutate the package root yet.

Required sequence for side-effecting capabilities:

```text
request
→ capability resolution
→ input/isolation preparation
→ policy claim authorization
→ durable operation claim
→ active lease + fencing validation
→ policy execute authorization
→ begin executing
→ pinned provider/handle execution
→ commit or explicit reconciliation/compensation
→ agent-run step evidence
→ signal + telemetry observation
```

Read-only capabilities still require policy/scope and isolation where applicable, but do not create a side-effect operation.

Implementation rules:

1. use `CapabilityRouter`/`StrictToolRegistry` for the real tool call;
2. do not use the older `AuthorityCapabilityExecutor` as the final owner;
3. the HTTP adapter must consume `AuthorityPinnedHttpTarget` directly, not call normal `fetch(url)`;
4. the filesystem adapter must consume `AuthorityPinnedFileTarget.handleToken`, not reopen `canonicalTargetUri`;
5. provider exceptions after begin become reconciliation-required;
6. provider-native idempotency/reconciliation evidence closes retries;
7. direct side-effecting router execution must be blocked in authority mode;
8. contracts must cover allow, deny, stale lease, expired decision, provider success, provider unknown, partial application and compensation.

## Remaining Phase 05 after P05.8

- wire policy/lease/isolation/agent-run outcomes to canonical signal + `AuthorityTelemetry` paths;
- resolve superseded Phase 05 prototypes/barrels/tests/fixtures under deletion governance;
- update compatibility/rollback docs;
- static review the strict TypeScript graph;
- freeze one exact Phase 05 checkpoint.

## Hard safety rules

- no exactly-once provider-effect claim;
- no blind retry after execution begins;
- no path/URL re-resolution after authority isolation decision;
- idempotency-key presence is not durable idempotency;
- fencing-token presence is not resource acceptance proof;
- policy and isolation must intercept the real execution path;
- no alternate authority writer;
- no legacy test rewrite without waiver + ADR;
- material deletion requires deletion-governance entry;
- no automatic Actions/CD;
- no Assurance score movement before execution.

## Static verification commands prepared, not run

```text
npm run typecheck:phase05
npm run test:authority:phase05
```

## Rollback

- Phase 05 rollback base: `checkpoint/phase-04-temporal-2e15b88`;
- Phase 03: `checkpoint/phase-03-core-ad6a93c`;
- Phase 02: `checkpoint/phase-02-contracts-06487e7`;
- Phase 01: `checkpoint/phase-01-reconciled-76dfdc7`;
- pre-reconciliation: #33 `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`.
