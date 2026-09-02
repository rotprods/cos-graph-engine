# COS Graph Framework M1 — Usable Framework Kernel

Status: **IMPLEMENTED / STACKED / EVIDENCE-GATED**

Parent chain: PR #81 Graph Protocol V1 → M1A canonical state → M1B runtime state module → M1C real CSR adapter.

## Milestone definition

M1 is reached when COS is no longer only a collection of graph classes behind a common module protocol. The framework must own a canonical graph state contract that can be mutated safely, replayed deterministically, invoked through the runtime, and projected into at least one existing COS engine without losing correctness silently.

## Canonical graph document

`cos.graph/document/v1alpha1` defines one transportable property-graph representation:

- graph ID + monotonic revision;
- typed nodes with labels and JSON-like properties;
- directed or undirected edges;
- deterministic edge identity when callers do not supply an ID;
- explicit `identityKey` for intentional parallel relations;
- canonical materialization independent of insertion order;
- strict finite-number / plain-object / cycle / accessor validation;
- null-prototype normalized property maps so keys such as `__proto__` remain data;
- SHA-256 canonical state hashes.

The document intentionally contains no wall-clock timestamps. Temporal truth belongs to the event envelope so projection identity is not accidentally host-time dependent.

## Transactional state semantics

`InMemoryGraphStore` is the reference semantic implementation, not the final distributed persistence backend.

Acceptance is fail-closed:

```text
normalize mutation payload
→ canonical request hash
→ prior idempotency lookup
→ expectedRevision CAS
→ isolated candidate mutation
→ graph invariant validation
→ before/after state hashes
→ append one hash-chained event
→ atomic candidate promotion
```

Same idempotency key + same canonical payload returns the original receipt with no second event. Same key + different payload fails. Failed candidates never change graph state or event history.

## Event / replay integrity

`cos.graph/event/v1alpha1` binds graph/operation/idempotency identity, base/resulting revisions, canonical request hash, previous event hash, before/after state hashes, monotonic recorded time and canonical event SHA-256.

`replayGraphEvents()` verifies every boundary before accepting replay output. `store.verify()` proves the live projection equals deterministic replay of accepted history.

This is tamper evidence under a trusted storage/authorization boundary, not authenticity against an authorized malicious writer that can replace and re-hash the entire history.

## Framework runtime module

`cos.graph.state.memory` exposes:

- `cos.graph.state.commit` — `mutate`, policy-required, idempotency-required;
- `cos.graph.state.snapshot` — immutable graph snapshot;
- `cos.graph.state.verify` — deterministic replay-equivalence proof.

GraphRuntime owns authorization/observability/routing; the store independently owns concurrency, graph invariants and idempotency.

## Existing-engine integration: CSR

`cos.graph.adapter.csr` is the first real legacy-engine adapter:

- canonical GraphDocument → existing `CSRGraph` projection;
- BFS executes the repository's actual CSR implementation;
- structural stats expose projection expansion;
- undirected canonical edges become two directed CSR arcs except undirected self-loops, which remain one arc;
- canonical shapes that would collide in legacy endpoint-keyed CSR fail closed with `CSR_PARALLEL_EDGE_UNSUPPORTED`.

This includes direct parallel edges and the less obvious collision where an undirected `a↔b` edge plus an explicit `b→a` edge would map to the same legacy directed pair.

Framework law:

> An adapter may reject an unsupported semantic shape; it may not silently degrade canonical graph truth.

## M1 acceptance gate

M1 requires all of the following on the exact compacted candidate heads:

- parent protocol suites green;
- targeted strict framework typecheck green;
- canonicalization / prototype-safety tests green;
- CAS / stale-writer tests green;
- payload-bound idempotency tests green;
- atomic failure tests green;
- event tamper tests green;
- replay equals live projection;
- side-effecting state commit blocked without runtime policy;
- state module and CSR module conform to Graph Protocol V1;
- actual repository CSR BFS exercised through GraphRuntime;
- lossy parallel/reverse-collision projection rejected.

## What M1 does not claim

M1 is not production certification and does not yet provide Postgres/RocksDB/Neo4j durable state adapters, multi-process transactions/fencing, snapshot restore/compaction, cryptographic signatures, stable protocol migrations, durable runtime checkpoints/HITL, federated query planning, language SDK parity or stable public npm subpaths.

## Next significant milestone — M2

**M2 = Durable Graph Runtime.**

```text
Graph Protocol
  → Canonical GraphDocument
  → durable EventStore / SnapshotStore
  → optimistic transaction + persistent idempotency
  → replay / restore / compaction
  → checkpointed execution
  → interrupts / human approval
  → crash-safe resume
```

M2 should define driver-neutral persistence contracts first, then prove semantic parity with at least two genuinely independent adapters. Postgres/Supabase is the preferred first durable implementation; SQLite/RocksDB is the preferred second implementation for parity testing.
