# HANDOFF — COS Graph Engine

## Recovery point

Phases 01–04 are statically complete. Phase 05 has a canonical policy/fencing/isolation capability facade but remains incomplete and unexecuted.

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

## Current Phase 05 authority owners

Additive barrel:

`packages/execution/src/authority-phase05-current.ts`

### Capability execution

- `AuthorityCapabilityRuntime` — canonical facade candidate;
- private `CapabilityRouter` + `StrictToolRegistry`;
- `AuthorityPinnedHttpTool`;
- `AuthorityFileHandleTool`;
- `createAuthorityProviderRegistry`.

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

### Canonical capability path

```text
request
→ authority provider preflight
→ policy
→ durable operation claim
→ lease + fencing
→ prepare
→ begin
→ strict provider tool
→ commit OR reconciliation_required
→ agent-run step evidence
→ lease release / repair evidence
```

- legacy direct tools are removed from the authority registry;
- read/mutation tool modes are explicit;
- provider idempotency is bound into durable operation input;
- preflight runs before `executing`;
- committed retries return durable truth without another provider call;
- provider exceptions after begin become `reconciliation_required`;
- optional agent-run evidence is appended only after accepted commit;
- post-commit evidence/lease-release failure cannot rewrite provider truth.

### External-effect truth

- append-only operation history;
- payload-bound claim/transition idempotency;
- uncertain/reconciliation and compensation semantics;
- explicit provider-outcome-unknown transition;
- in-memory/Postgres stores;
- fencing validation before accepted local commit.

### Lease/concurrency

- bounded acquire/renew/release/expire/reacquire;
- monotonic fencing;
- explicit-time stale owner/token/revision rejection;
- in-memory/Postgres stores.

### Policy

- default deny;
- project/sensitivity/principal isolation;
- exact-operation approvals;
- authorization at claim/prepare/execute/commit;
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
- normal fetch/path reopen is explicitly non-equivalent.

All remain `WRITTEN_UNEXECUTED`.

## Next exact implementation slice

### P05.10 — provider reconciliation and trusted execution boundary

1. define provider-native reconciliation adapters for HTTP and filesystem:
   - inspect by provider idempotency/resource identity;
   - return `applied | not_applied | partial` with immutable evidence;
   - never infer `not_applied` from transport exception alone;
2. bind isolation validation to a trusted facade clock/timeline rather than accepting only tool-supplied `evaluatedAt`;
3. specify and implement deployment ports:
   - pinned-address HTTP transport preserving original TLS SNI/Host;
   - platform handle broker/executor with no path reopen;
4. extend capability contracts for:
   - stale owner/token;
   - provider-not-applied retry preparation;
   - partial application and compensation;
   - evidence-repair after provider commit;
5. emit failure-isolated signals for policy deny, isolation deny, lease conflict/expiry, provider uncertainty, compensation and agent-run evidence repair;
6. bridge terminal signals to `AuthorityTelemetry` without making telemetry an execution dependency.

## Remaining Phase 05 after P05.10

- resolve superseded Phase 05 prototypes/barrels/tests/fixtures under deletion governance;
- update compatibility and rollback documentation;
- statically inspect the strict TypeScript graph;
- freeze one exact Phase 05 checkpoint.

## Hard safety rules

- no exactly-once provider-effect claim;
- no blind retry after execution begins;
- no path/URL re-resolution after isolation decision;
- idempotency-key presence is not durable idempotency;
- fencing-token presence is not provider/resource acceptance proof;
- policy and isolation must intercept the real path;
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
