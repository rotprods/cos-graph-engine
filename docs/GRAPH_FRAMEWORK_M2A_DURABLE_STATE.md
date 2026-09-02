# COS Graph Framework M2A — Durable State Authority

Status: **candidate until exact-head CI is green**.

M2A extends the accepted M1 canonical state semantics across process restarts without weakening CAS, idempotency, replay, or integrity rules.

## North Star

A graph mutation is authoritative only when the durable backend atomically advances all three persistence surfaces:

1. append-only event history,
2. canonical head snapshot,
3. payload-bound idempotency index.

The backend must reject stale storage versions rather than silently last-write-wins.

## Architecture

```text
GraphRuntime / future modules
        |
        v
DurableGraphStore
  - validates persisted bytes
  - reconstructs M1 state machine
  - preserves graph CAS/idempotency semantics
  - retries only storage CAS races
        |
        v
GraphDurabilityDriver
  load(graphId) -> unknown trust-boundary image
  compareAndSwap(commit) -> committed | conflict
        |
        +--> SQLiteGraphDurabilityDriver (M2A reference durable backend)
```

`load()` intentionally returns `unknown`. Persistence is not trusted simply because a TypeScript adapter produced it. `DurableGraphStore` reparses the image, replays the complete event history, verifies the head snapshot, verifies the idempotency index, and reconstructs the M1 state machine before accepting it as graph truth.

## Persistence image v1alpha1

Schema: `cos.graph/persistence-image/v1alpha1`.

Each authority contains:

- `graphId`
- monotonic `storageVersion`
- canonical `GraphSnapshot`
- ordered `GraphEvent[]`
- persisted idempotency records

For M2A (pre-compaction), these invariants are mandatory:

```text
storageVersion == eventCount == graph.revision == events.length
```

Every idempotency record must correspond to exactly one committed event and must reproduce that event's canonical receipt. Duplicate or orphan idempotency keys fail closed.

## Atomic driver law

`compareAndSwap()` is conformant only if event append + snapshot head + idempotency record are committed atomically iff `expectedStorageVersion` is still current.

A driver that persists only part of the tuple is non-conformant, even if a later repair process could reconstruct the other data.

## Two concurrency layers

M2A keeps graph and storage concurrency distinct:

- **Graph CAS**: `GraphTransaction.expectedRevision` protects semantic graph state.
- **Storage CAS**: `GraphPersistenceCommit.expectedStorageVersion` protects the durable representation against competing processes.

If storage CAS loses a race, `DurableGraphStore` reloads authority and retries from durable truth. It does not rewrite `expectedRevision`.

Consequences:

- if the winning operation used the same idempotency key + payload, the loser converges to the original receipt;
- if another operation advanced graph revision, the stale writer still receives `REVISION_CONFLICT`;
- storage retries are bounded; exhaustion raises `DURABILITY_CAS_RETRY_EXHAUSTED`.

## Crash/restart semantics

A fresh `DurableGraphStore` instance must be able to:

1. load persisted bytes,
2. validate event-chain integrity,
3. prove replay == snapshot,
4. reconstruct M1 idempotency state,
5. resume commits from the recovered revision.

An exact retry after restart may carry its original stale `expectedRevision`; idempotency is evaluated against reconstructed durable history first, preserving the M1 retry contract.

## SQLite reference backend

`SQLiteGraphDurabilityDriver` uses Node's built-in `node:sqlite` API. The repository's current framework runner is Node 22.12.0, where this API requires `--experimental-sqlite`; therefore only the SQLite test command receives that flag.

Database durability settings:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

Tables:

- `cos_graph_heads`
- `cos_graph_events`
- `cos_graph_idempotency`

Writes execute inside `BEGIN IMMEDIATE` and advance the head only after the expected storage version is confirmed. The adapter adds no npm/native addon dependency to `@cos/graph`.

## M2A adversarial suite

The dedicated suite covers:

- first durable commit,
- process-facing close/reopen recovery,
- replay equivalence after restart,
- exact retry after restart with stale graph revision,
- idempotency-key payload conflict after restart,
- stale writer rejection,
- storage CAS retry path,
- bounded CAS exhaustion,
- persisted event-hash tampering,
- no regression of all M1 protocol/state/runtime/CSR suites.

## Deliberate proof boundary

M2A is durable, but not yet the complete M2 runtime.

Not claimed in this slice:

- event compaction / snapshot anchors,
- checkpointed workflow execution,
- interrupt / human approval semantics,
- crash-safe workflow resume,
- Postgres/Supabase parity,
- cross-backend conformance equivalence,
- distributed leases/fencing for long-running workflow ownership,
- authenticity against a malicious writer with authority to rewrite the entire database and recompute hashes.

Those remain M2B/M2C work.

## Promotion gate

M2A can be marked `TARGETED_ACCEPTED` only when the exact compacted head and PR merge ref both pass:

- targeted strict TypeScript compile,
- all M1 framework suites,
- durable SQLite state suite from a clean install.

Whole-repository production certification remains governed separately by the #76/#79 convergence train.
