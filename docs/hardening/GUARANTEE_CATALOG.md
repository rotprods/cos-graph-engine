# COS Graph Engine — Guarantee Catalog

This catalog translates architecture quality into falsifiable guarantees. Codex tasks should target one or more guarantee IDs, not vague feature requests.

## W0/W1 — Canonical truth
- **G-CI-001**: A required typecheck failure makes CI fail.
- **G-CI-002**: A required build failure makes CI fail.
- **G-CI-003**: A required test failure makes CI fail.
- **G-CI-004**: CI runs from the real repository root on a clean checkout.
- **G-TEST-001**: Every maintained test entrypoint is either executed by the canonical test command or explicitly quarantined with owner/reason/expiry.
- **G-TEST-002**: Reported test counts are generated, not manually asserted in docs.
- **G-BENCH-001**: Synthetic graph benchmarks are reproducible from a recorded seed.
- **G-BENCH-002**: A benchmark can only claim speedup when speedup is an explicit acceptance objective; pruning/memory/correctness passes are reported separately.

## Graph correctness
- **G-GRAPH-001**: Updating a node type/tags cannot leave secondary indexes stale.
- **G-GRAPH-002**: Updating edge source/target/type cannot leave adjacency/type indexes stale.
- **G-GRAPH-003**: Active edges cannot reference missing nodes.
- **G-GRAPH-004**: Multiple typed edges may coexist between the same node pair without collision.
- **G-GRAPH-005**: Canonical graph hash is deterministic for equivalent state.

## Temporal/provenance
- **G-TIME-001**: The system distinguishes valid/event time from recorded/system time.
- **G-TIME-002**: A correction never requires deleting historical truth; it supersedes/retracts with provenance.
- **G-PROV-001**: Every operational fact/edge can return the source episode/event that produced it.

## Event durability
- **G-EVENT-001**: Every accepted domain event survives process restart.
- **G-EVENT-002**: Re-delivering the same event is harmless.
- **G-EVENT-003**: Replaying the same canonical event sequence recreates the same projection hash.
- **G-EVENT-004**: Projectors have durable cursors and cannot silently skip accepted events.

## Memory/recovery
- **G-MEM-001**: Memory layer transitions update all derived indexes atomically.
- **G-MEM-002**: Inference cannot silently become FACT without evidence/provenance.
- **G-REC-001**: Empty-state restore + migrations + replay reconstruct canonical hashes.
- **G-REC-002**: Recovery artifacts are available without paid infrastructure.

## Security/policy
- **G-POL-001**: Unknown policy operators fail closed.
- **G-POL-002**: Policy is evaluated on the actual execution/mutation path, not merely available as an unused service.
- **G-POL-003**: Restricted graph objects are never returned to a lower permission scope.

## Concurrency
- **G-CON-001**: Stale expected-version writes fail rather than overwrite newer state.
- **G-CON-002**: Task ownership uses expiring leases; two active owners cannot successfully commit the same exclusive task state.
- **G-CON-003**: Retried writes use idempotency keys.

## Resilience
- **G-RES-001**: Near misses are persisted as learning signals.
- **G-RES-002**: Material changes document removed risks, introduced risks, new couplings, defenses and rollback.
- **G-RES-003**: Kill/restart during an accepted durable write cannot create an acknowledged-but-lost event.
- **G-RES-004**: Degraded state is observable and distinguishable from healthy state.

## Agent runtime
- **G-AGENT-001**: A fresh agent can resume from repository/control-plane state without hidden conversation memory.
- **G-AGENT-002**: Tool execution produces durable evidence and acceptance state.
- **G-AGENT-003**: A failed required step cannot be silently skipped while the parent goal is marked successful.

## Context / GraphRAG
- **G-RAG-001**: Context retrieval is project- and permission-scoped before prompt construction.
- **G-RAG-002**: Every returned authoritative fact exposes provenance.
- **G-RAG-003**: Gold-query benchmark measures retrieval quality against known answers.
- **G-RAG-004**: Stale context packs are invalidated by projection/source watermarks.

## Rule
No guarantee is `PASS` from prose, a model statement, or a manual demo alone. PASS requires machine-verifiable evidence committed or linked from the repository.
