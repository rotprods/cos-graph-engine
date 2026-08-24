# W12.4 — Authority Closure Implementation Plan

Status: IN PROGRESS
Base: `hardening/w12-3-core-gap-closure`
North Star: close the remaining implementation gaps that prevent W13 from being a pure evidence/qualification campaign.

## Definition gate

### Observed facts
- W2→W12.3 introduced real code across graph correctness, identity, temporal/provenance, durable events, recovery, policy, agent execution, concurrency, resilience, GraphRAG, memory and Hub.
- The convergence head is still a stacked draft and has not yet received the final compile/test/replay/restore campaign.
- Several authority paths still contain transitional or nondeterministic behavior.

### Success condition
W13 may begin only when no known architectural gap requires a new runtime subsystem. Remaining work at W13 must be verification, defect correction, migration reconciliation and score qualification—not invention of missing control-plane primitives.

### Falsifiable failure condition
W12.4 fails if any authority path can still:
- report false success;
- perform an uncoordinated side effect;
- generate replay-unstable identity;
- compile stale or scope-unsafe context;
- overwrite concurrent durable state silently;
- lose recovery provenance;
- infer causality from a safety signal;
- mutate state without an auditable transition boundary.

## Execution slices

### A. Execution truth and side-effect safety
1. Activate `StrictToolRegistry` in `COSServer`.
2. Fix legacy `SearchTool` false-success behavior at source.
3. Preserve the invariant layer even when custom tools are registered.
4. Keep capability input guard → policy → tool result validation ordering explicit.

### B. Deterministic GraphRAG and agentic context bridge
1. Replace random GraphRAG relation IDs with canonical deterministic IDs.
2. Reject semantic relation-ID collisions and duplicate contradictory relations.
3. Add an `AgenticResourceRegistry → GraphRAGEngine` projector.
4. Require project/sensitivity/temporal/provenance fields before authority-grade context compilation.
5. Bind projection version and evidence hash to the resulting `ContextPack`.

### C. Temporal and concurrency-safe memory
1. Introduce an optional epistemic/bi-temporal memory envelope without breaking legacy callers.
2. Add explicit supersession/contradiction lineage fields.
3. Preserve revision CAS in durable memory adapters.
4. Add a deterministic memory projection hash for replay/restore evidence.

### D. Hub persistence and replay boundary
1. Introduce immutable `HubSnapshotStore` contracts.
2. Add in-memory reference and Postgres/Supabase-compatible adapters.
3. Verify snapshot hash before import and replay events strictly after cursor.
4. Keep GitHub delivery IDs as producer idempotency keys.

### E. Runtime safety signal integration
1. Route policy, lease, idempotency, stale-write, subscriber-delivery, snapshot and context-staleness signals into `ResilienceObserver`.
2. Preserve observation as evidence only; do not create causal edges automatically.
3. Attach project/resource/actor/source references to every emitted near miss.

### F. Transactional state transitions
1. Serialize `StateMachine.send()` calls per machine.
2. Run exit/action/entry under an explicit transition transaction.
3. On failure, roll back current state/history/counters and record the transition failure.
4. Prevent timer callbacks from racing a newer state generation.

### G. Authority manifest
1. Add a machine-readable capability/schema manifest.
2. Mark each 20D dimension `implemented`, `verification_pending`, or `blocked`.
3. Freeze the W13 command/evidence matrix.

## Complex-systems review

### Risks removed
- false tool success;
- random relation identity during replay;
- unscoped registry-to-context projection;
- silent concurrent memory overwrite;
- unaudited state-transition races.

### Risks introduced
- stricter execution can break legacy callers that relied on permissive behavior;
- deterministic deduplication can expose historical duplicates;
- transition rollback cannot undo arbitrary external side effects performed by user callbacks;
- external persistence adapters add database availability and migration coupling.

### Defenses
- compatibility surfaces remain available until W13 cutover;
- fail-closed errors are explicit and typed by stable error prefixes;
- side-effect callbacks must use capability/idempotency/fencing controls;
- snapshot/event-log authority remains separate from derived projections;
- no automatic CD and no automatic GitHub Actions during convergence.

## Exact completion checkpoint
W12.4 closes when all slices are committed to a draft stacked PR, the PR description lists implemented vs verification-pending items honestly, and `HANDOFF.md` points exclusively to W13 qualification and defect triage.