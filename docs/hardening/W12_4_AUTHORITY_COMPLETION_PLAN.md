# W12.4 — Authority Completion Plan

Status: EXECUTING
Base: `hardening/w12-3-core-gap-closure`
Target: close remaining implementation gaps before W13 qualification.

## North Star

COS may enter W13 only when every authority path has a concrete implementation for identity, temporal truth, durable history, concurrency, policy, capability execution, memory, graph retrieval, resilience, observability and recovery. W13 then verifies those implementations; it does not invent missing architecture.

## Operating laws

Every slice applies:

1. `/leydekidlin`: observed defect, scope, invariants, falsifiable failure condition.
2. `/leydegilbert`: own the implementation path and produce repository evidence.
3. `/complexsystems`: identify removed hazards, introduced couplings, degraded behavior, early-warning signals, rollback and smallest reversible cutover.

## Execution graph

### A. Authority GraphRAG and context projection

Goal: eliminate random relationship identity and create a deterministic bridge from the Agentic Resource Graph to bounded agent context.

Deliverables:
- `AuthorityGraphRAGIndex` with atomic projection replacement.
- deterministic entity/relation/chunk identity.
- scope, sensitivity, temporal and provenance validation before indexing.
- `AgenticContextProjector` from `AgenticResourceRegistry`.
- deterministic zero-cost lexical-hash embeddings as explicit fallback, with injectable embedding provider.
- `ContextPackCompiler` generalized to a structural scoped-retriever contract.

Gate:
- identical registry + version produces identical projection hash and evidence ordering.
- no dangling relation or chunk entity reference can enter the authority index.
- private/restricted and temporally invalid evidence is removed before context assembly.

### B. Authority memory semantics

Goal: make durable memory epistemically and temporally explicit rather than treating all stored content as timeless fact.

Deliverables:
- authority memory record/query contracts.
- bi-temporal validity and system-knowledge windows.
- provenance, confidence, epistemic type, sensitivity, project scope and verification time.
- immutable supersession/contradiction/retraction semantics.
- deterministic projection hash.
- Postgres/Supabase authority-memory DDL and CAS-compatible repository contract.

Gate:
- corrections never erase historical evidence.
- `asOf` and `knownAt` are distinct queries.
- unsupported scope/sensitivity fails closed.

### C. Hub persistence, query and provider ingestion

Goal: make `@cos/hub` a durable graph control plane for projects, chats, agent runs, code and repositories.

Deliverables:
- external snapshot-store contract plus in-memory and Postgres implementations.
- snapshot integrity with SHA-256 and event cursor.
- bounded query service for project runtime, open loops, provenance paths and neighborhoods.
- GitHub provider adapter fixtures preserving delivery ID and semantic distinctions (`closed != merged != deployed`).
- replay from snapshot cursor + event log.

Gate:
- corrupted snapshot is rejected.
- duplicate provider delivery is harmless.
- replay recreates the same state hash.

### D. State/concurrency hardening

Goal: prevent asynchronous state-machine transitions from interleaving or committing stale transitions.

Deliverables:
- serialized dispatch queue.
- state revision and expected-state/expected-revision CAS.
- copy-safe context reads.
- transition failure evidence and explicit local rollback boundary.
- cancellation/disposal for state timeouts.

Gate:
- two concurrent transitions cannot both commit against the same revision.
- failed guard/action/entry cannot be reported as successful transition.

### E. Authority observability

Goal: produce end-to-end traceable evidence for event acceptance, projection, retrieval, policy, capability execution, leases, recovery and context compilation.

Deliverables:
- authority operation tracer over existing TelemetrySystem.
- deterministic correlation/causation metadata.
- latency, success/failure, projection version and evidence hash fields.
- resilience observer integration for rejected writes, stale context, replay divergence and delivery failure.

Gate:
- every authority mutation/retrieval emits one terminal operation event.
- telemetry observer failure cannot change the protected operation outcome.

### F. W13 qualification substrate

Goal: make final verification one explicit, manual-only, reproducible campaign.

Deliverables:
- manual-only W13 workflow.
- qualification manifest with exact commands and evidence artifact paths.
- authority-matrix generator/input contract.
- no automated CD.

Gate:
- workflow can only be invoked manually.
- a failed required command fails the qualification run.

## Cutover policy

Legacy APIs remain available during W12.4. Authority consumers must explicitly select the new authority path. W13 determines which legacy paths can be deprecated or removed. No score becomes 10/10 during W12.4; the only valid labels are `IMPLEMENTED`, `PARTIALLY_IMPLEMENTED`, and `UNVERIFIED`.

## Exact completion order

1. Authority GraphRAG + Agentic bridge.
2. Authority memory contracts/repository.
3. Hub store/query/provider adapters.
4. State machine serialization/CAS.
5. Authority telemetry wiring.
6. W13 manual qualification substrate.
7. Update 20D matrix, STATE and HANDOFF.
8. Open stacked draft PR; keep unmerged until W13.
