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

PR #47 is closed without merge as a duplicate PR view of the same Phase 05 head. PR #46 is the single Phase 05 control object.

W13 PR #36 remains paused/non-authoritative. PR #37 remains draft/rework. Source branches #34/#35 remain preserved.

## Frozen static phases

- Phase 01 canonical reconciliation — `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`;
- Phase 02 contracts/compatibility/deletion governance — `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`;
- Phase 03 core correctness — `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`;
- Phase 04 temporal/event/persistence — `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`.

Phase 04 delivered shared EventLog semantics, canonical JSON wire v1, append-only bitemporal knowledge authority, Postgres semantic fixtures and Hub snapshot/tail recovery contracts. No Phase 04 contract has been executed in a clean checkout.

## Phase 05 current control surface

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
- provider exceptions after execution never become false local failure or blind retry;
- explicit `markProviderOutcomeUnknown()` transition;
- provider/resource reconciliation before retry;
- compensation evidence for partial application;
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
- accepted local side-effect commit validates the fence.

Actual provider/resource acceptance still requires provider-native idempotency/reconciliation or a resource that consumes the fence.

### P05.4 — durable agent-run aggregate

Implemented candidate:

- append-only goal/plan/step/result/criterion revisions;
- DAG/dependency/attempt validation;
- exact evaluator ID/version evidence;
- critical side-effect steps require committed operation evidence;
- completion cannot be inferred from prose;
- failed and accepted attempts remain historical evidence;
- in-memory and `AuthorityAgentRunPostgresStore` candidates;
- Postgres advisory-lock serialization, operation-key idempotency, immutable rows, restart reconstruction and corruption checks.

### P05.5 — policy

Implemented candidate:

- default deny;
- principal/project/sensitivity gates;
- deny/approval precedence;
- exact-operation time-bounded approvals;
- independent claim/prepare/execute/commit authorization;
- denied mutations append no protected operation revision.

### P05.6 — deployment isolation

Implemented decision contracts:

- `AuthorityHttpEgressGuard` for host/protocol/method/port policy, DNS resolution, special-use address rejection, pinned answers, TTL and redirect reauthorization;
- `AuthorityFileSandbox` for root/operation policy, traversal defense, canonical containment, symlink control and trusted broker-opened opaque handles;
- `ADR-009-AUTHORITY-ISOLATION-BOUNDARIES.md`.

Hard boundary:

- the HTTP guard is not a transport; authority deployment must connect to pinned addresses directly while preserving TLS SNI/Host semantics;
- the filesystem sandbox is not the broker; authority execution must consume the atomically opened handle and may not reopen a path.

### P05.7 — execution evidence

Implemented candidate:

- content-hashed execution signals;
- near-miss evidence for stale fencing rejection;
- observation failure cannot alter protected results;
- detached signal store candidate.

Broader policy/lease/isolation/provider/agent-run signal and `AuthorityTelemetry` wiring remains open.

### P05.8 — canonical capability path

Implemented candidate:

- `AuthorityPinnedHttpTool` and `AuthorityFileHandleTool` consume pinned decisions/handles only;
- every authority provider tool exposes preflight and explicit `read|mutation` mode;
- authority registry removes legacy `filesystem`, `http_client` and `search` tools;
- `AuthorityCapabilityRuntime` privately owns `CapabilityRouter` + `StrictToolRegistry` execution;
- read path requires policy and read-mode permission;
- mutation path binds provider idempotency into durable operation identity;
- mutation path enters policy → claim → lease/fence → prepare → begin → provider → commit/reconciliation;
- committed retry returns durable truth without a second provider call;
- provider exception after begin becomes `reconciliation_required`;
- optional agent-run evidence is appended only after accepted commit;
- post-commit evidence or lease-release failure is repairable and cannot rewrite provider truth;
- additive end-to-end fake-provider contract written.

## Explicit remaining Phase 05 gaps

P0:

1. implement provider-native idempotency and reconciliation adapters for pinned HTTP and broker-handle filesystem execution;
2. bind isolation evaluation time to a trusted runtime clock instead of trusting only provider input `evaluatedAt`;
3. prove real HTTP pinned-address transport behavior with correct TLS SNI/Host and no second DNS resolution;
4. prove real platform broker/handle execution without path reopen;
5. prove no alternate package-root side-effect path can bypass the authority facade.

P1:

6. connect policy deny, lease conflict/expiry, isolation denial, provider uncertainty, lease-release repair and agent-run outcomes to canonical signals + `AuthorityTelemetry`;
7. resolve/archive superseded Phase 05 prototypes/barrels/tests/fixtures under Phase 02 deletion governance;
8. perform package-root/API promotion only in Phase 07 with compatibility evidence;
9. repair every strict-typecheck or contract failure found when execution starts.

## Current verification boundary

Everything in Phase 05 is `WRITTEN_UNEXECUTED`.

Not yet run:

- clean dependency install;
- strict TypeScript graph;
- authority contracts;
- contention/stale-writer campaign;
- crash-window/provider-reconciliation campaign;
- SSRF/DNS-pinning transport integration;
- handle-broker filesystem integration;
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

Close Phase 05 in this order:

1. add provider-native reconciliation contracts and trusted runtime time binding;
2. add real/pinned transport and broker-handle integration adapters or explicit deployment ports;
3. wrap the capability facade in failure-isolated signal + telemetry observation;
4. reconcile superseded files, compatibility and deletion governance;
5. freeze one exact Phase 05 checkpoint only after the surface has one owner per capability.
