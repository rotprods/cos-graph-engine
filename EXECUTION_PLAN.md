# COS Graph Engine — Execution Plan to 10/10 Authority

## Program shape

The remaining program is organized into **10 phases**. A phase may contain several PRs, but each PR should have one primary guarantee and a bounded blast radius.

## Phase 00 — North Star & Control Plane

Goal: make mission, state, scoring and execution unambiguous.

Deliverables:
- `GOAL.md`
- `STATE.md`
- `SCORECARD_20D.md`
- `GRAPH.md`
- `README_FIRST.md`
- current `AGENTS.md` constitution
- Todoist project isolated from unrelated work
- GitHub/Drive/Todoist synchronization rule

Checkpoint: a cold agent can identify mission, scores, current branch topology, blockers and next action without chat memory.

## Phase 01 — Reconcile #34 + #35

Goal: one canonical authority candidate.

Tasks:
- inventory exclusive #34 capabilities;
- inventory exclusive #35 capabilities;
- compare each duplicate primitive on invariants, atomicity, determinism, compatibility, testability and failure modes;
- create canonical branch from #33;
- port selected implementations;
- mark superseded branches only after equivalence evidence.

Checkpoint: no unresolved sibling authority implementations.

## Phase 02 — Contracts, Compatibility & Deletion Ledger

Goal: prevent semantic loss while hardening.

Tasks:
- deletion ledger for >50-line replacements;
- API/behavior diff main vs candidate;
- legacy suite preserved;
- new authority suite additive;
- ADR index for intentional breaks;
- rollback map per capability.

Checkpoint: every changed public behavior is intentional, documented and testable.

## Phase 03 — Core Correctness

Goal: trustworthy identity and graph mutation substrate.

Tasks:
- immutable/deep-safe CAS;
- clone-safe PropertyGraph;
- deterministic serializer restricted to supported values;
- Unicode/provider normalization;
- canonical CSR with multiedges and reverse projection;
- invariant/hash/property tests.

Vertical targets: D02, D03, D04, D12.

Checkpoint: nested mutation and graph-index corruption adversarial tests cannot bypass invariants.

## Phase 04 — Temporal, Event & Persistence

Goal: truthful history and deterministic recovery.

Tasks:
- append-only bi-temporal revisions;
- separate valid-time and system-time closure;
- durable EventLog semantic contract;
- command/outcome event separation;
- KnowledgeGraph transaction/saga semantics;
- durable snapshots and Postgres/Supabase fixtures;
- deterministic replay and empty-DB restore.

Vertical targets: D05, D06, D07.

Checkpoint: historical knownAt/validAt queries and rebuilds reproduce expected evidence exactly.

## Phase 05 — Security, Concurrency & Agent Runtime

Goal: safe side effects and durable execution.

Tasks:
- durable side-effect ledger;
- lease renewal/expiry/reacquisition;
- resource-level fencing validation immediately before commit;
- principal/scope/sensitivity enforcement everywhere;
- filesystem/network deployment defenses;
- immutable/durable goal aggregate;
- restart/compensation semantics;
- near-miss observation.

Vertical targets: D10, D11, D12, D13.

Checkpoint: stale workers, duplicate retries and process crashes cannot duplicate or silently corrupt a protected side effect.

## Phase 06 — Hub, Memory, GraphRAG & Observability

Goal: one bounded, provenance-native agentic context plane.

Tasks:
- select one authority GraphRAG path;
- append-only epistemic memory;
- outcome-based Hub replay;
- verified ContextPack compiler;
- gold-query retrieval set;
- AuthorityTelemetry integration;
- cross-project leakage = 0 in gold tests.

Vertical targets: D08, D09, D14, D20.

Checkpoint: `Project ID + Task` reconstructs a bounded, current, permission-safe, provenance-backed ContextPack deterministically.

## Phase 07 — Test Truth & Manual CI

Goal: zero automatic spend without losing verification breadth.

Tasks:
- regenerate lockfile from clean install;
- preserve/rebuild full manual verification matrix;
- legacy + strict typecheck;
- all orphan/excluded suites;
- negative/property/mutation tests;
- coverage artifacts;
- benchmark artifacts;
- forced-failure proof.

Vertical targets: D15, D16, D17.

Checkpoint: every required failure makes the qualification red; no `|| true`, silent skip or false-green aggregation.

## Phase 08 — Evidence Campaign

Goal: convert implementation into assurance.

Campaigns:
- security diff scan/threat model;
- contention/fencing/idempotency;
- crash-window testing;
- deterministic event/graph/context replay;
- corrupted snapshot + empty-DB restore;
- failure combinations/degraded modes;
- scientific benchmark campaign;
- blind cold-agent resume;
- evidence manifest by commit and vertical.

Checkpoint: every D01–D20 score has direct machine evidence.

## Phase 09 — Authority Qualification & Merge

Goal: reach the North Star without conflating qualification and deployment.

Tasks:
- independent 20D adversarial re-audit;
- independent write-enabled review;
- promote scores only with evidence;
- all D01–D20 Authority scores = 10.0;
- create final canonical PR with lineage, migrations and rollback;
- merge with expected SHA;
- verify post-merge state;
- separately decide release/deployment;
- synchronize Acta, STATE, HANDOFF and Todoist.

Checkpoint: `AUTHORITY_READY`.

## Phase transition law

A phase closes only when its checkpoint is evidenced. It may not be declared complete because all tasks were attempted.

When new evidence reduces confidence, reopen the relevant phase and lower the score. The system optimizes for truth, not apparent velocity.