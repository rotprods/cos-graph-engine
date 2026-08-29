# STATE — COS Graph Engine

Updated: 2026-08-29  
Mode: **PHASE_05_SECURITY_CONCURRENCY_AGENT_RUNTIME**  
Authority status: **SHADOW_ONLY / IMPLEMENTED_UNVERIFIED**  
Current phase: **05 / 09 — SECURITY / CONCURRENCY / AGENT RUNTIME**  
Canonical draft PR: **#46**  
Automatic CI/CD: **OFF**  
Merge authorization: **DENIED UNTIL HARDENING + EVIDENCE**

## North Star

Bring COS Graph Engine to `10.0 Authority` in all 20 audited engineering verticals and qualify it as the zero-cost graph compute/projection and agent-runtime substrate of AGENTIC_SYSTEMS_OS.

Scoring law:

`Authority = min(Build, Assurance)`.

Calibrated baseline remains:

- Build: **7.6/10**;
- Assurance: **2.6/10**;
- Authority: **2.6/10**.

Static implementation can justify a later Build re-score. Assurance and Authority remain unchanged until clean, linked execution evidence exists.

## Canonical linear lineage

- Phase 01 — `checkpoint/phase-01-reconciled-76dfdc7` @ `76dfdc737c231b2637f122125f7acf98b735ff1f` — PR #40;
- Phase 02 — `checkpoint/phase-02-contracts-06487e7` @ `06487e7acbce82c5a54dbb8dd171dceae2bb67ac` — PR #43;
- Phase 03 — `checkpoint/phase-03-core-ad6a93c` @ `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3` — PR #44;
- Phase 04 canonical base — `checkpoint/phase-04-temporal-2e15b88` @ `2e15b88388836b94b97a93753cb4db347e275e7e` — PR #45;
- Phase 05 — `hardening/phase-05-security-concurrency-runtime` — PR #46.

PR #47 was closed without merge as a duplicate PR view of the same Phase 05 head. It used the moving Phase 04 branch as base and referenced a nonexistent checkpoint. PR #46 is the single Phase 05 control object.

W13 PR #36 remains paused and non-authoritative. PR #37 remains draft/rework. Source branches #34/#35 remain preserved.

## Frozen static phases

### Phase 01 — canonical reconciliation

`COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`.

### Phase 02 — contracts, compatibility and deletion governance

`COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`.

### Phase 03 — core correctness

`COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`.

### Phase 04 — temporal, event and persistence

`COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`.

Phase 04 delivered the shared EventLog semantic contract, canonical JSON wire v1, append-only bitemporal knowledge authority, Postgres semantic fixtures and Hub snapshot/tail recovery contracts. No Phase 04 contract has been executed in a clean checkout.

## Phase 05 current authority candidates

Canonical additive barrel:

`packages/execution/src/authority-phase05-current.ts`

Strict static graph:

`npm run typecheck:phase05`

Aggregate contract command:

`npm run test:authority:phase05`

Evidence manifest:

`docs/hardening/PHASE_05_EVIDENCE_MANIFEST.v2.json`

Ownership manifest:

`docs/hardening/AUTHORITY_SURFACE_MANIFEST.json`

### P05.1 — durable side-effect truth

Implemented candidate:

- append-only operation revisions;
- payload-bound claim/transition idempotency;
- explicit `claimed → prepared → executing → reconciliation_required|committed|failed|compensation_required → compensating → compensated` states;
- provider exceptions after execution do not become false local failure or blind retry;
- interrupted operations require provider/resource reconciliation;
- partial application requires compensation evidence;
- in-memory and Postgres/Supabase-compatible stores;
- no exactly-once external-effect claim.

### P05.2/P05.3 — leases and commit-boundary fencing

Implemented candidate:

- bounded acquire/renew/release/expire/reacquire lifecycle;
- deterministic explicit-time evaluation;
- monotonic fencing tokens;
- stale lease ID/owner/token/expiry/resource revision rejection;
- in-memory and Postgres stores;
- prepare, begin and commit use the current lease validator;
- accepted side-effect commit validates the fencing token at the operation boundary.

### P05.4 — durable agent-run aggregate

Implemented candidate:

- append-only goal/plan/step/result/criterion revisions;
- DAG and dependency validation;
- exact evaluator ID/version evidence;
- critical side-effect steps require committed operation evidence;
- completion cannot be inferred from prose;
- failed and accepted attempts remain historical evidence;
- in-memory store;
- `AuthorityAgentRunPostgresStore` with advisory-lock serialization, operation-key idempotency, immutable rows, restart reconstruction and corruption checks.

### P05.5 — policy

Implemented candidate:

- default deny;
- principal/project/sensitivity gates;
- explicit deny dominates allow;
- approval dominates broad allow;
- exact-operation time-bounded approvals;
- independent claim/prepare/execute/commit authorization;
- denied mutations append no protected operation revision.

### P05.6 — deployment isolation

Implemented decision contracts:

- `AuthorityHttpEgressGuard` for host/protocol/method/port policy, DNS resolution, special-use address rejection, pinned answers, TTL and redirect reauthorization;
- `AuthorityFileSandbox` for root/operation policy, traversal defense, canonical containment, symlink control and trusted broker-opened opaque handles;
- `ADR-009-AUTHORITY-ISOLATION-BOUNDARIES.md`.

Hard boundary:

- the HTTP guard is not a transport; authority deployment must connect to the pinned address set directly while preserving TLS SNI/Host semantics;
- the filesystem sandbox is not the broker; authority execution must use the atomically opened handle and may not reopen a path.

### P05.7 — execution evidence

Implemented candidate:

- content-hashed execution signals;
- near-miss evidence for stale fencing rejection;
- observation failure cannot alter the protected result;
- detached signal reads.

Broader policy/lease/isolation/agent-run signal and `AuthorityTelemetry` wiring is still open.

## Explicit remaining Phase 05 gaps

P0:

1. bind the real `CapabilityRouter` + `StrictToolRegistry` path to `PolicyBoundAuthorityExecutionRuntime` and the isolation decisions;
2. add provider-native idempotency/reconciliation adapters that consume pinned transports/handles;
3. prove no alternate side-effecting capability path can bypass policy, lease and operation history.

P1:

4. connect policy, lease, isolation and agent-run outcomes to canonical signal + `AuthorityTelemetry` paths;
5. resolve/archive superseded Phase 05 prototypes/barrels/fixtures under Phase 02 deletion governance;
6. perform package-root/API promotion only in Phase 07 with compatibility evidence;
7. repair every strict-typecheck or contract failure found when execution starts.

## Current verification boundary

Everything in Phase 05 is `WRITTEN_UNEXECUTED`.

Not yet run:

- clean dependency install;
- strict TypeScript graph;
- authority contracts;
- contention and stale-writer campaign;
- crash-window/provider-reconciliation campaign;
- SSRF/DNS-pinning integration test;
- handle-broker filesystem integration test;
- security diff/threat-model review;
- replay/restore qualification;
- full legacy/orphan suite.

Therefore no `VERIFIED`, `AUTHORITY_READY`, `exactly-once` or score-promotion claim is authorized.

## Cost and safety posture

- recurring incremental infrastructure cost: `EUR 0/month`;
- Actions manual-only;
- CD/deploy/release OFF;
- no production DB or Supabase mutation;
- Codex optional for later shell-heavy verification, not required for GitHub orchestration;
- no merge before evidence and independent review.

## Next exact action

Close the remaining Phase 05 authority path in this order:

1. create one canonical capability facade that binds `CapabilityRouter`/`StrictToolRegistry` to policy, durable operation history, lease/fence validation and isolation evidence;
2. implement provider adapter contracts for pinned HTTP and broker-handle filesystem execution plus reconciliation;
3. wire terminal/denied/stale/uncertain outcomes to signal + telemetry without making observers a SPOF;
4. statically reconcile superseded files and manifests;
5. freeze a Phase 05 checkpoint only after the surface has one owner per capability.
