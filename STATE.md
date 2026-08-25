# STATE — COS Graph Engine

Updated: 2026-08-25  
Mode: **CANONICAL_AUTHORITY_RECONCILIATION**  
Authority status: **SHADOW_ONLY**  
Current phase: **01 / 09 — RECONCILIATION #34 + #35**  
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

See `SCORECARD_20D.md`.

## Current branch truth

Active branch:

`hardening/canonical-authority-reconciliation`

Exact base:

`hardening/w12-3-core-gap-closure` @ `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`

Divergent source branches:

- PR #34 / `hardening/w12-4-authority-completion` @ `af4973561b5f7d7a7415fa8f88a12a7d8d678a66`;
- PR #35 / `hardening/w12-4-authority-closure` @ `8b7e197f35e6fc114cd90ec0907db4c2f5b625f4`.

W13 PR #36 is based only on #35 and remains paused. PR #37 remains draft/rework because manual-only invocation must not remove verification breadth. Audit PR #38 and issue #39 govern the stop-the-line remediation.

## Completed in Phase 01

- created canonical reconciliation branch directly from #33;
- measured #34/#35 divergence and recorded exact source refs;
- inventoried exclusive and overlapping capabilities;
- selected canonical direction for capabilities C01–C13;
- created semantic deletion ledger;
- materialized 20D Build/Assurance/Authority scorecard;
- materialized phase task graph and authority dependency graph;
- created isolated Todoist control plane and synchronized Drive.

## Current architecture decisions

- strict #35 tool execution semantics are selected, but durable side-effect idempotency/fencing is still required;
- GraphRAG will have one atomic authority projection combining #34 projection CAS with #35 normalization and verified-context constraints;
- #35 transactional StateMachine is the intended core; #34 expected-state/revision fencing will be integrated without preserving two competing mutation queues;
- #34 versioned AgenticResourceRegistry is selected, subject to deep immutability hardening;
- Hub will use #34 command/outcome replay and query semantics plus #35 snapshot/recovery/context capabilities;
- neither current memory adapter qualifies as true bi-temporal authority storage; append-only transaction-time revisions are required;
- #34 AuthorityTelemetry and #35 EventBus delivery-failure observation are selected;
- W13 will be recreated only after the reconciled candidate is frozen.

## Current blockers

P0:

- no single reconciled W12.4 candidate yet;
- mutable-reference bypass in CAS/graph/memory surfaces;
- memory authority lacks append-only transaction-time history;
- side-effect idempotency/fencing is not yet durable;
- W13 currently certifies incomplete lineage;
- manual CI rework must preserve full verification surface.

P1:

- identity normalization/serializer domain;
- KnowledgeGraph transactional projection;
- durable goal aggregate and Hub outcome replay convergence;
- package/export/lockfile reconciliation;
- legacy + authority test separation.

## Cost and execution posture

- incremental recurring infrastructure cost remains `EUR 0/month`;
- GitHub Actions must be manual-only;
- CD remains off;
- no remote run is authorized during Phase 01;
- Codex is optional for shell-heavy loops, not required for GitHub orchestration.

## Current next action

Port the low-conflict selected primitives into this branch with source provenance:

1. strict tool runtime from #35;
2. AuthorityTelemetry from #34;
3. immutable EventBus delivery-failure observation from #35;
4. provider fixtures as additive evidence assets.

Then open a draft reconciliation PR against #33 and proceed to canonical state/registry convergence.
