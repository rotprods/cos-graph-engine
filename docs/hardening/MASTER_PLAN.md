# COS Graph Engine — Convergence & Hardening Master Plan

## North Star
Bring COS Graph Engine to production-grade assurance before it becomes an authoritative substrate for AGENTIC_SYSTEMS_OS.

A capability is not considered mature because code exists or tests are numerous. It is mature only when its guarantees are deterministic, falsifiable, replayable, recoverable, observable, permission-scoped and backed by automated evidence.

## Operating doctrine
Every task MUST apply:
1. `/leydekidlin` — define observed facts, assumptions, unknowns, scope, desired outcome, constraints, success criteria and falsifiable failure condition.
2. `/leydegilbert` — once defined, own the path to completion using tools, evidence and tests; missing step-by-step instructions are not a blocker.
3. `/complexsystems` — model interacting failures, latent conditions, defenses, degraded states, near misses, blast radius, rollback and new couplings introduced by any fix.

## Strategic decision
Do not add a Level 20 yet. Enter a Convergence Era.

The unit of work is a **guarantee**, not a feature.

Bad: `improve EventBus`.
Good: `every accepted domain event survives process restart and duplicate delivery is harmless`.

## Waves
### W0 — Canonical Main Recovery
Goal: make `main` a trustworthy base.
- reconcile CI root/path defects
- reconcile workspace dependency/version drift
- identify stacked/open PR dependencies
- remove false-green CI patterns
- define merge order and consolidation strategy

Exit gate: clean install + deterministic test command + CI actually fails when typecheck/build/tests fail.

### W1 — Test Truth & CI Truth
Goal: prove that reported green means real coverage.
- wire orphan tests
- inventory all test entrypoints
- remove `|| echo` / swallowed failures in required gates
- deterministic benchmark seeds
- distinguish correctness/performance/pruning benchmark goals
- required status checks documented

Exit gate: every declared mandatory test is executed from a single canonical command and a forced failure makes CI red.

### W2 — Graph Invariants
- atomic secondary-index maintenance
- no dangling active edges
- parallel-edge correctness
- reverse CSR
- bounded traversal invariants
- deterministic graph hash

### W3 — Deterministic Identity
- canonical URI namespace
- provider/native IDs preserved
- alias resolution
- no display-name identity
- idempotency keys

### W4 — Temporal + Provenance
- bi-temporal facts
- first-class episodes
- supersession/retraction, no destructive truth rewrite
- source event / provenance on operational graph objects

### W5 — Durable Event Kernel
- append-only event log
- causation/correlation IDs
- sequence/order semantics
- projection cursors
- duplicate delivery safety
- replay

### W6 — Persistent Memory + Recovery
- durable SMB backing
- index rebuild after restart
- memory epistemic typing
- snapshots + external zero-cost recovery

### W7 — Policy + Security Enforcement
- fail closed on unknown operators
- policy on actual execution path
- sensitivity/project/principal scope
- audit trail

### W8 — Durable Agent Runtime
- real capability/tool execution
- plan DAG
- task lease
- expected state version
- acceptance gates
- compensation/rollback
- closure/handoff contract

### W9 — Concurrency + Idempotency
- optimistic concurrency
- leases
- write ordering
- multi-writer fixtures
- retry safety

### W10 — Resilience + Failure Injection
- FailureMode / LatentCondition / Defense / NearMiss / DegradedState / RecoveryPath / ChangeRisk
- kill/restart tests
- partial failure tests
- restore drills
- defense interaction tests

### W11 — Scientific Performance + Observability
- seeded deterministic benchmarks
- confidence intervals / repeated runs
- reverse-CSR and queue improvements
- no misleading aggregate PASS metric
- traces for event/projector/query/context/agent operations

### W12 — Hub / GraphRAG / AGENTIC integration
- evolve `@cos/hub` into project/chat/agent/artifact control plane
- graph-backed bounded context compiler
- shadow-mode workloads
- gold-query evaluation
- authority only after gates pass

## Authority gates
### Gate A — Before any authoritative use
Target >=9/10 evidence-backed in:
- correctness
- temporal semantics
- event durability
- persistence/recovery
- security/policy
- concurrency
- resilience
- testing
- CI/CD

### Gate B — Shadow integration
COS reads/project/retrieves real AGENTIC_SYSTEMS_OS workloads without becoming source of truth.

### Gate C — Authority
Only after replay, restore, failure-injection, concurrency and policy tests pass under representative workloads.

## Current prerequisite PRs
Observed open PRs that must be reconciled before broad hardening:
- #2 CI working directory/root fix
- #11 workspace dependency alignment
- #12 cognitive L8–L11 correctness fixes
- #16 orphan test wiring

Do not blindly merge stacked PRs. Inspect diffs, dependency order and current heads first.

## Definition of Done for any hardening PR
A hardening PR is complete only when:
- problem statement is falsifiable
- invariant/guarantee is documented
- implementation is minimal and reversible
- tests fail before fix where feasible
- tests pass after fix
- no relevant failure is swallowed
- replay/restore implications are considered
- blast radius and rollback are documented
- AGENTS/HANDOFF/STATE are updated if project state changes
