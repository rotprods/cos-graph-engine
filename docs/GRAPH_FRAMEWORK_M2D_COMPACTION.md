# COS Graph Framework M2D — Snapshot Anchors and Event Compaction

Status: **candidate until exact-head CI is green**.

M2D bounds retained event-envelope growth while preserving deterministic recovery, hash-chain continuity, semantic graph revision, monotonic event time, and exact idempotent retries for transactions whose original event envelopes have been physically deleted.

## North Star

Compaction must be a storage optimization only. It must never masquerade as a graph mutation.

Before M2D, three values happened to advance together:

```text
storageVersion == eventCount == graph.revision
```

That equality is no longer valid once a storage-only compaction exists.

M2D makes the clocks explicit:

- `graph.revision`: semantic graph mutation count
- `eventCount`: semantic event count represented by the current graph head
- `storageVersion`: durable storage CAS clock; graph commits and compactions both advance it

Required invariant:

```text
graph.revision == eventCount
storageVersion >= eventCount
```

A compaction advances only `storageVersion`.

## Persistence image v1alpha2

M2D advances:

- legacy: `cos.graph/persistence-image/v1alpha1`
- current: `cos.graph/persistence-image/v1alpha2`

The current image contains:

```text
graphId
storageVersion
snapshot              current canonical head
anchor | null         verified compacted prefix
retained events[]     only events strictly after the anchor
idempotency[]         complete authority across compacted + retained history
```

The parser accepts legacy v1alpha1 only after proving all legacy invariants. It then normalizes the image to v1alpha2 with `anchor = null`.

## Snapshot anchor

Schema: `cos.graph/persistence-anchor/v1alpha1`.

An anchor binds:

- canonical `GraphSnapshot` at the compacted revision
- `lastEventHash` through that snapshot
- finite `lastRecordedAt`
- number of compacted idempotency records
- canonical hash of the complete idempotency prefix
- canonical `anchorHash` over the whole anchor payload

The anchor is therefore not merely a cached graph object. It is the cryptographic/tamper-evident continuity boundary from which retained history resumes.

## Anchored replay law

For an anchor at revision `A` and a retained tail of `N` events:

```text
head.eventCount == A + N
head.graph.revision == A + N
```

Replay starts from the canonical anchor graph, not revision zero.

The first retained event must satisfy:

```text
baseRevision == A
revision == A + 1
previousEventHash == anchor.snapshot.lastEventHash
recordedAt >= anchor.lastRecordedAt
beforeStateHash == hash(anchor.graph)
```

Every later event follows the ordinary M1 event-chain laws.

The final replay state, event hash and total event count must equal the durable head snapshot.

## Idempotency survives event deletion

M2D deliberately compacts event envelopes, **not idempotency authority**.

There remains exactly one persisted idempotency record per semantic graph revision. Receipt revisions must form a complete unique sequence from `1..eventCount`.

For retained tail events, the record must exactly reproduce that event's canonical receipt.

For the compacted prefix, the anchor stores:

```text
idempotencyCount
idempotencyHash
```

The digest is recomputed from retained idempotency rows ordered by semantic revision. Losing or changing an old idempotency row therefore invalidates the anchor even though its original event envelope is gone.

Consequence: a transaction from before the anchor can be retried after restart with its original stale `expectedRevision`; the key/payload is matched first and the original receipt is returned without recreating an event.

## Shared graph state kernel

M2D refactors the M1 state machine without duplicating mutation semantics.

Reusable pure kernels now include:

- `prepareGraphTransaction()`
- `materializeGraphCommit()`
- `applyCanonicalGraphMutations()`
- `replayGraphEventsFromAnchor()`
- `graphEventPayload()`

`InMemoryGraphStore` continues to use the same functions and retains its original non-compacted semantics. `DurableGraphStore` uses them against its validated durable head/anchor.

This prevents the in-memory and durable implementations from drifting into two subtly different graph state machines.

## DurableGraphStore compaction

`compact(graphId)` compacts to the current durable head.

1. load and fully validate the current authority
2. if head is already fully anchored with no retained tail, return a no-op receipt
3. construct an anchor from the current canonical snapshot, last event time and complete idempotency authority
4. submit an atomic storage CAS against current `storageVersion`
5. on conflict, reload durable truth and retry within the existing bounded attempt budget
6. require the driver to report exactly the retained event count as pruned

A successful receipt reports semantic graph revision separately from the new storage version.

## SQLite compaction transaction

The SQLite reference backend migrates `cos_graph_heads` in place by adding nullable `anchor_json` when opening a pre-M2D database.

New databases create:

```sql
cos_graph_heads(
  graph_id,
  storage_version,
  snapshot_json,
  anchor_json
)
```

Compaction executes inside `BEGIN IMMEDIATE`:

1. compare current `storage_version`
2. verify proposed anchor still binds the durable head snapshot
3. prove there are no event rows beyond the proposed head anchor
4. count current retained event rows
5. delete rows at or below the anchor revision
6. require deleted count == prior retained count
7. write `anchor_json`
8. increment `storage_version` exactly once
9. commit

`cos_graph_idempotency` is untouched by compaction.

If any invariant fails, the SQL transaction rolls back and no compaction is surfaced as successful.

## Compatibility/migration

Two migration paths are covered:

### Persistence image v1alpha1

A legacy serialized image is verified under legacy rules, then normalized in memory to v1alpha2 without an anchor.

### Existing M2A SQLite database

The driver detects the old `cos_graph_heads` schema with `PRAGMA table_info` and adds `anchor_json` without rebuilding or deleting existing graph/event/idempotency tables.

The migrated graph can be replayed and then compacted normally.

## M2D adversarial gauntlet

The dedicated suite proves:

- three real durable graph commits before compaction
- storage/revision clocks initially equal
- complete compaction removes all retained event envelopes
- graph revision and state hash remain unchanged
- storageVersion advances independently
- anchor-only restart/replay succeeds
- exact retry of a physically deleted old event returns its original receipt
- changed payload under that old idempotency key still conflicts
- new post-anchor event chains from the anchor's `lastEventHash`
- post-anchor timestamp regression fails
- compaction storage-CAS conflict retries from durable truth
- repeated compaction advances the anchor and prunes only the new tail
- already-anchored head is a storage no-op
- old idempotency keys survive repeated compaction
- anchor hash tampering fails closed
- corrupt idempotency digest fails even if outer `anchorHash` is recomputed
- missing old idempotency row fails despite event deletion
- broken first-tail chain fails against the anchor
- a real old M2A SQLite schema is migrated in place, verified and compacted
- all prior M1 + M2A + M2B + M2C tests remain in the same workflow

## Proof boundary

M2D provides tamper-evident anchored history inside the same trusted storage/authorization boundary as M1/M2A. It does not provide authenticity against an attacker that can rewrite the entire database, recompute every hash and replace application-visible authority.

M2D also does not yet claim:

- signed/transparency-log anchors
- external immutable/WORM archival of pruned event envelopes
- point-in-time historical queries before the anchor
- configurable partial-prefix compaction; this slice compacts the full retained tail to the current head
- retention/TTL deletion of idempotency records
- Postgres/Supabase parity
- distributed fencing/heartbeat ownership

Those require explicit separate contracts rather than weakening exact-retry or replay guarantees.

## Promotion gate

M2D may be marked `TARGETED_ACCEPTED` only when the exact compacted head and PR merge ref both pass:

- clean install
- targeted strict TypeScript compile
- complete M1 regression
- M2A durable restart suite
- M2B checkpoint crash-recovery suite
- M2C durable HITL suite
- M2D anchored compaction/migration suite

Whole-repository production certification remains independently gated by #76/#79.
