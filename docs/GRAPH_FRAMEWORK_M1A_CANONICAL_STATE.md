# COS Graph Framework M1A — Canonical Graph State

Status: **IMPLEMENTED / TARGETED-VALIDATED / STACKED ON PR #81**

M1A introduces the first canonical state substrate behind COS Graph Protocol V1. It is deliberately independent from the legacy 20-level implementation surface: legacy engines become adapters to this contract rather than sources of graph truth.

## Canonical document

`cos.graph/document/v1alpha1` defines graph ID, monotonic integer revision, typed nodes, labels, directed/undirected edges, JSON-like properties, graph metadata, deterministic ordering and SHA-256 state hashing.

The document contains no wall-clock timestamps. Temporal truth belongs to the append-only event envelope so the same logical graph can replay to the same state hash on another machine or implementation.

### Identity rules

Node identity is explicit. Edge identity is caller-supplied `id` when present; otherwise it is deterministic from source + target + relation type + direction + optional `identityKey`. Mutable properties do not participate in default edge identity. Intentional parallel semantic relations must provide distinct IDs or `identityKey` values.

## Property safety

Canonical properties are normalized recursively and reject non-finite numbers, functions, symbols, bigint, undefined, cyclic structures, accessors, non-plain objects and excessive nesting. Normalized property objects use a null prototype, so an own key such as `__proto__` remains data rather than mutating the resulting object's prototype.

## Transaction contract

The reference `InMemoryGraphStore` accepts:

```text
graphId
expectedRevision
idempotencyKey
mutations[]
operationId? / recordedAt?
```

Commit order is fail-closed:

```text
normalize mutation payload
→ canonical request hash
→ prior idempotency lookup
→ expectedRevision CAS
→ build isolated candidate graph
→ validate graph invariants
→ compute before/after state hashes
→ append one hash-chained event
→ promote candidate + event + receipt
```

Exact retries converge: same idempotency key + same canonical mutation payload returns the original receipt and creates no second event. The original expected revision may now be stale because accepted-operation identity is checked before CAS. Same key + different payload fails `IDEMPOTENCY_CONFLICT`.

## Mutation invariants

Dangling edges never commit. Missing node/edge removals fail closed. Node deletion with incident edges fails unless `cascade=true`. Failed transactions do not alter projection or event history. A successful batch advances the graph revision exactly once.

## Event integrity

`cos.graph/event/v1alpha1` binds graph/operation/idempotency identity, base/resulting revisions, canonical request hash, previous event hash, before-state hash, after-state hash, monotonic `recordedAt` and canonical SHA-256 event hash.

`replayGraphEvents()` verifies each link before applying it. `store.verify()` replays the full accepted event history and requires the replayed state hash to equal the live projection hash.

This is tamper evidence inside a trusted storage/authorization boundary. Hash chains alone are not authenticity against an authorized malicious writer able to replace the whole history and recompute hashes.

## Targeted validation before publication

The implementation was compiled under TypeScript `strict` in isolation. A focused executable suite passed 31 assertions covering canonicalization, prototype-safe properties, deterministic identity, CAS, exact retries, idempotency conflict, atomic rejection, cascading deletion, replay equivalence, event tamper detection and time regression.

The authoritative acceptance evidence for this PR is the GitHub Graph Framework Protocol workflow on the exact published head.

## Non-goals

M1A does not yet add a public stable package export, persistent Postgres/SQLite/RocksDB storage, multi-process locks/fencing, snapshot restore/compaction, durable runtime checkpoints or CSR/GraphRAG/backend adapters. Those remain separate stacked changes so each semantic boundary is independently reviewable and reversible.
