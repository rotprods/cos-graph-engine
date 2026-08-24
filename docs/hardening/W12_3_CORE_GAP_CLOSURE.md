# W12.3 — Core Gap Closure

This wave exists because stacked branches revealed an important systemic hazard: later waves had forked before late W9 commits, so some guarantees did not propagate into the current convergence head.

## /leydekidlin

Observed gaps after W2→W12 implementation:

1. Legacy CSR stored one `source->target` edge identity, losing parallel/typed edges.
2. Reverse traversal on legacy CSR was O(E).
3. W9 fencing/idempotency improvements had not propagated into W10→W12 descendants.
4. Autonomous tool execution had no authority-grade capability router.
5. Event log had durable semantics but no explicit transactional persistence port.
6. Resilience graph required manual near-miss creation instead of ingesting operational safety signals.
7. GraphRAG had scope/temporal/provenance retrieval but no bounded cross-agent ContextPack contract.

## Implemented

### Graph correctness
- `BidirectionalCSRGraph` preserves parallel edges with independent edge identity.
- Forward and reverse CSR projections are both rebuilt from canonical edges.
- Reverse-neighbor lookup is O(in-degree).
- BFS uses head-index queue, not `shift()`.
- Bidirectional shortest-path expands the smaller frontier and uses reverse CSR.
- Mutation validates endpoints/IDs before canonical writes.
- Deterministic projection ordering by edge ID.
- `validate()` checks dangling edges and projection cardinality.

### Concurrency propagation
- CAS supports expected-version and expected-content-hash guards.
- Leases expose monotonic `fencingVersion`.
- Idempotency keys are bound to payload hashes.
- `GoalExecutionCoordinator` combines idempotency + goal lease + result ownership verification.

### Capability execution
- `CapabilityRouter` resolves real `ToolRegistry` tools.
- Side-effecting capabilities require idempotency key + fencing version.
- Authorization is an injected hook, avoiding execution→orchestration circular dependency.
- `ToolResult.success=false` becomes an execution failure, not false success.

### Event durability
- `ITransactionalStateStore<T>` makes the atomic persistence boundary explicit.
- `TransactionalEventLog` atomically performs dedupe, collision checks and sequence allocation.
- Equal idempotency keys with different logical events fail closed.
- Persisted event state is integrity-validated before reads/appends.

### Resilience learning
- `ResilienceObserver` converts stale writes, lease conflicts, policy denials, replay divergence, snapshot failures, scope rejections and other safety signals into durable near-miss evidence.
- Burst deduplication prevents graph flooding.
- Observation never invents causality; linking to incidents/failure modes remains explicit.

### Agent context
- `ContextPackCompiler` enforces project, permission and temporal scope before prompt construction.
- Context is bounded by a token budget.
- Authority-grade packs reject evidence without provenance.
- Packs carry projection version and fail stale-context checks.
- Evidence hash makes context selection auditable/reproducible.

## /complexsystems

This wave intentionally does not delete legacy CSR or legacy execution paths yet. A destructive cutover before final compile/test/replay evidence would create a new failure path. New authority-grade primitives are introduced alongside compatibility paths, and W13 will determine the safe cutover.

## Remaining before 10/10 claim

- migrate active legacy CSR consumers to BidirectionalCSRGraph where semantics require parallel/reverse traversal;
- inject CapabilityRouter into AutonomousLoop and bind PolicyEngine authorization;
- provide concrete Postgres/SQLite transactional state adapter;
- wire ResilienceObserver to runtime/event/policy/recovery signal emitters;
- reconcile `@cos/hub` PR #13 against canonical identity/event/temporal contracts;
- run final compile/typecheck/test/replay/restore/security/concurrency/benchmark/cold-start campaign;
- re-audit all 20 dimensions and only then promote scores to 10/10.
