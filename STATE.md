# STATE — COS Graph Engine

Updated: 2026-08-25  
Mode: **CANONICAL_AUTHORITY_RECONCILIATION**  
Authority status: **SHADOW_ONLY**  
Current phase: **01 / 09 — RECONCILIATION #34 + #35**  
Active draft PR: **#40**  
Automatic CI/CD: **OFF**  
Merge authorization: **DENIED UNTIL RECONCILIATION + EVIDENCE**

## North Star

Bring COS Graph Engine to `10.0 Authority` in all 20 audited engineering verticals, then qualify it as the zero-cost graph compute/projection and agent-runtime substrate of AGENTIC_SYSTEMS_OS.

Scoring law:

`Authority = min(Build, Assurance)`.

Current means from the adversarial baseline:

- Build: **7.6/10**;
- Assurance: **2.6/10**;
- Authority: **2.6/10**.

Implementation in PR #40 may improve Build after review, but Assurance and Authority remain unchanged until execution evidence exists. See `SCORECARD_20D.md`.

## Current branch truth

Active branch:

`hardening/canonical-authority-reconciliation`

Exact base:

`hardening/w12-3-core-gap-closure` @ `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`

Divergent source branches:

- PR #34 / `hardening/w12-4-authority-completion` @ `af4973561b5f7d7a7415fa8f88a12a7d8d678a66`;
- PR #35 / `hardening/w12-4-authority-closure` @ `8b7e197f35e6fc114cd90ec0907db4c2f5b625f4`.

Draft reconciliation PR:

- PR #40 / `hardening/canonical-authority-reconciliation`;
- currently mergeable but intentionally draft;
- 29 commits and 24 changed files at the previous checkpoint;
- no remote verification run requested.

W13 PR #36 is based only on #35 and remains paused. PR #37 remains draft/rework because manual-only invocation must not remove verification breadth. Audit PR #38 and issue #39 govern the stop-the-line remediation.

## Completed in Phase 01

### Control and governance

- created canonical reconciliation branch directly from #33;
- measured #34/#35 divergence and recorded exact source refs;
- inventoried exclusive and overlapping capabilities;
- selected canonical direction for capabilities C01–C13;
- created semantic deletion ledger;
- materialized 20D Build/Assurance/Authority scorecard;
- materialized phase task graph and authority dependency graph;
- created isolated Todoist control plane and synchronized Drive;
- opened draft reconciliation PR #40.

### Low-conflict selected primitives

- strict tool runtime and false-success removal from #35;
- `AuthorityTelemetry` from #34 with export wiring;
- immutable EventBus delivery-failure observer stream from #35;
- semantic GitHub webhook fixtures from #34.

### Canonical authority kernels now implemented in PR #40

- `AuthorityStateMachine`: one serialized mutation queue, staged callbacks, expected-state/revision fencing, deterministic snapshots/restore checks, timer fencing and copy-safe state reads;
- `AuthorityAgenticRegistry`: canonical identity, object/projection CAS, append-only transaction-time revisions, scope/sensitivity filtering, deterministic parallel relation identity and history validation;
- `AuthorityGraphRAGIndex`: one atomic projection replacement path, expected version/hash CAS, deterministic relation identity, sensitivity derivation, temporal/system-knowledge filtering and deterministic snapshots;
- additive authority test harnesses for state-machine and agentic-registry contracts.

These kernels are **implemented but not executed or verified**.

## Canonical architecture decisions

- strict #35 tool execution semantics are selected, but durable side-effect idempotency/fencing is still required;
- `AuthorityGraphRAGIndex` is the single authority projection candidate; legacy L11 remains shadow/compatibility only until migration evidence exists;
- `AuthorityStateMachine` combines the transactional #35 core intent with #34 expected-state/revision semantics without two mutation queues;
- `AuthorityAgenticRegistry` is the canonical topology/registry candidate and now includes append-only system-time revisions and clone-safe metadata;
- Hub must combine #34 command/outcome replay and queries with #35 snapshot/recovery/context capabilities;
- neither historical memory adapter qualifies as final authority storage; append-only epistemic/system-time memory revisions remain required;
- #34 AuthorityTelemetry and #35 EventBus delivery-failure observation remain selected;
- W13 will be recreated only after the reconciled candidate is frozen.

## Current blockers

P0:

- ContextPack is not yet converged onto the single authority GraphRAG projection;
- Hub command/outcome, query, snapshot, recovery and context paths are not yet unified;
- memory authority still requires append-only system-time redesign;
- mutable-reference bypass remains in legacy CAS/PropertyGraph/Memory surfaces;
- side-effect idempotency/fencing is not yet durable;
- W13 currently certifies incomplete lineage;
- manual CI rework must preserve the full verification surface.

P1:

- identity normalization/serializer domain;
- KnowledgeGraph transactional projection;
- durable goal aggregate and side-effect saga;
- package/export/API/lockfile reconciliation;
- legacy + authority test separation;
- complete deletion ledger and behavior-diff evidence.

## Cost and execution posture

- incremental recurring infrastructure cost remains `EUR 0/month`;
- GitHub Actions must be manual-only;
- CD remains off;
- no remote run is authorized during Phase 01;
- Codex is optional for shell-heavy loops, not required for GitHub orchestration.

## Current next action

Close Phase 01 in this order:

1. bind verified `ContextPack` compilation to `AuthorityGraphRAGIndex` and make legacy L11 explicitly shadow/deprecated;
2. converge Hub around recorded command outcomes, deterministic replay, query contracts, snapshots, strict recovery and canonical context projection;
3. redesign authority memory as append-only epistemic/system-time revisions with in-memory/Postgres semantic parity;
4. reconcile package exports, TypeScript graphs, API behavior and deletion ledger;
5. freeze the candidate and recreate W13 from PR #40 lineage.

No Assurance score moves until the later evidence campaign executes.