# STATE — COS Graph Engine

Updated: 2026-08-28  
Mode: **PHASE_04_COMPLETE_STATIC / PHASE_05_ACTIVE_NEXT**  
Authority status: **SHADOW_ONLY**  
Current phase: **04 COMPLETE_STATIC → 05 SECURITY / CONCURRENCY / AGENT RUNTIME**  
Draft PR chain: **#40 → #43 → #44 → #45**  
Automatic CI/CD: **OFF**  
Merge authorization: **DENIED UNTIL HARDENING + EVIDENCE**

## North Star

Bring COS Graph Engine to `10.0 Authority` in all 20 audited engineering verticals and qualify it as the zero-cost graph compute/projection and agent-runtime substrate of AGENTIC_SYSTEMS_OS.

`Authority = min(Build, Assurance)`.

Calibrated baseline remains:

- Build: **7.6/10**;
- Assurance: **2.6/10**;
- Authority: **2.6/10**.

No score has moved during Phases 01–04 because their contracts remain unexecuted.

## Frozen checkpoints

- Phase 01 — `checkpoint/phase-01-reconciled-76dfdc7` → `76dfdc737c231b2637f122125f7acf98b735ff1f` — PR #40
- Phase 02 — `checkpoint/phase-02-contracts-06487e7` → `06487e7acbce82c5a54dbb8dd171dceae2bb67ac` — PR #43
- Phase 03 code — `checkpoint/phase-03-core-ad6a93c` → `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3` — PR #44; synchronized Phase 03 descendant/base used for Phase 04 = `64dbdd85323d563ceb10af9b5b0182338dbcceb4`
- Phase 04 — `checkpoint/phase-04-temporal-event-bedfec6` → `bedfec6b8ea147c91ac7d50a888c38b0439d53ff` — PR #45

## Phase 04 closure

Status: **COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED**.

Closure artifact: `docs/hardening/PHASE_04_CLOSURE.md`.

### Durable event truth

- one payload-bound logical-event contract for InMemory/Postgres EventLog;
- attempt-local event ID / trace / span / `recordedAt` do not redefine an accepted logical retry;
- same key + different semantic content fails closed;
- event-ID reuse under another key fails closed;
- reads/writes are detached;
- driver-neutral Postgres parity fixture exists.

### Canonical persistence wire

- `CANONICAL_JSON_WIRE_VERSION = 1`;
- persistence/signing uses explicit canonical JSON wire values;
- optional object `undefined` is omitted only at the wire boundary;
- undefined arrays/root values, sparse arrays, accessors, cycles, symbol keys, bigint, functions and non-plain objects fail closed;
- NFC normalization and normalized-key collision rejection;
- SHA-256 covers the exact persisted wire value.

### Knowledge authority

- `AuthorityKnowledgeGateway` is the single knowledge authority candidate;
- immutable append-only system revisions;
- independent valid-time vs system-time semantics;
- historical `knownAt` cannot see future corrections/closures;
- provenance, epistemic type, confidence, scope and sensitivity are first-class;
- PropertyGraph is rebuildable projection only;
- projection failure is explicit degraded saga state and can be repaired idempotently;
- Postgres adapter is advisory-lock + revision-CAS + INSERT-only history.

### Hub recovery

- Hub registration/command/outcome/projection hashes use canonical wire v1;
- successful outcomes omit absent `error` before hashing/persistence;
- `recordedAt` remains transaction-time evidence, not producer retry identity;
- JSON/JSONB round trips preserve semantic hash;
- snapshot envelopes carry schema + serialization version;
- snapshot SHA-256 covers exactly what JSONB stores;
- snapshot-only and snapshot+tail replay contracts are written;
- corruption, schema/serialization mismatch, metadata tampering and event-log-behind-snapshot fail closed.

## Authority candidate ownership

```text
State               → AuthorityStateMachine
Agentic topology    → AuthorityAgenticRegistry
GraphRAG            → AuthorityGraphRAGIndex
ContextPack         → AuthorityContextPackCompiler
Hub runtime         → AuthorityHub
Hub query           → AuthorityHubQueryService
Hub context         → AuthorityHubContextProjector
Hub recovery        → AuthorityHubSnapshotManager
Memory              → AuthorityMemoryGateway + append-only stores
Knowledge           → AuthorityKnowledgeGateway + append-only stores
Durable events      → IEventLog / PostgresEventLog candidate
Canonical wire      → CANONICAL_JSON_WIRE_VERSION 1
CSR hot graph       → BidirectionalCSRGraph candidate
Observability       → AuthorityTelemetry
Tools               → strict ToolRegistry candidate
```

Legacy counterparts remain shadow/deprecated/read-only compatibility and may not write authority truth.

## Static Phase 04 defect ledger

Phase 04 discovered and addressed:

1. InMemory/Postgres EventLog idempotency divergence;
2. mutable EventLog read leakage;
3. producer-event-ID/JSON representation coupling in Postgres retries;
4. persisted/signed `undefined` optional-field ambiguity;
5. Hub successful-outcome `error: undefined` hash drift;
6. Hub global `projectId: undefined` JSONB round-trip drift;
7. KnowledgeGraph valid/system-time conflation;
8. knowledge-ledger vs graph-projection partial-failure ambiguity.

No item is marked VERIFIED until execution.

## Phase 05 objective

Make external side effects and autonomous concurrent execution safe across retries, stale ownership, crash windows and uncertain provider outcomes.

Exact order:

1. durable side-effect operation ledger;
2. resource commit-boundary monotonic fencing;
3. lease acquire / renew / expire / reacquire / crash recovery;
4. immutable durable goal-plan-result aggregate;
5. principal / project / sensitivity policy enforcement on real execution paths;
6. deployment HTTP/FS isolation contract;
7. near-miss evidence for denied, stale, duplicate and uncertain operations.

## Phase 05 hard constraints

- idempotency-key presence is not durable idempotency;
- fencing-token presence is not proof of commit-boundary validation;
- do not claim exactly-once external effects unless provider + protocol prove it;
- crash after provider effect but before local commit becomes `uncertain`, never guessed success/failure;
- state-machine rollback cannot undo an external provider mutation;
- all authority side effects must route through one operation-ledger owner;
- no automatic Actions/CD;
- no Assurance promotion without executed evidence.

## W13 timing

PR #36 remains paused/non-authoritative. A replacement W13 is created only after Phase 07 freezes the exact complete qualification SHA.

## Next exact action

Create the single descendant branch `hardening/phase-05-security-concurrency-runtime` from the synchronized Phase 04 head and implement the durable side-effect ledger first.