# STATE — COS Graph Engine

Updated: 2026-08-28  
Mode: **TEMPORAL_EVENT_PERSISTENCE_HARDENING**  
Authority status: **SHADOW_ONLY**  
Current phase: **04 / 09 — TEMPORAL / EVENT / PERSISTENCE**  
Active completed-static PRs: **#40 → #43 → #44**  
Automatic CI/CD: **OFF**  
Merge authorization: **DENIED UNTIL HARDENING + EVIDENCE**

## North Star

Bring COS Graph Engine to `10.0 Authority` in all 20 audited engineering verticals and qualify it as the zero-cost graph compute/projection and agent-runtime substrate of AGENTIC_SYSTEMS_OS.

`Authority = min(Build, Assurance)`.

Calibrated baseline remains:

- Build: **7.6/10**;
- Assurance: **2.6/10**;
- Authority: **2.6/10**.

Static hardening does not promote Assurance.

## Frozen checkpoints

### Phase 01 — Canonical reconciliation
- `checkpoint/phase-01-reconciled-76dfdc7`
- SHA `76dfdc737c231b2637f122125f7acf98b735ff1f`
- PR #40

### Phase 02 — Contracts / compatibility
- `checkpoint/phase-02-contracts-06487e7`
- SHA `06487e7acbce82c5a54dbb8dd171dceae2bb67ac`
- PR #43

### Phase 03 — Core correctness
- status: `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`
- checkpoint: `checkpoint/phase-03-core-ad6a93c`
- SHA `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3`
- PR #44
- closure: `docs/hardening/PHASE_03_CLOSURE.md`

## Phase 03 result

Implemented candidate guarantees:

- deep-copy CAS/idempotency boundaries;
- copy-safe PropertyGraph with atomic index updates;
- exact traversal depth/path/direction semantics;
- strict authority `canonicalSerialize/canonicalHash128` while retaining legacy deterministic hash compatibility;
- NFC/provider-aware canonical identity and alias normalization;
- SHA-256 integrity over strict canonical serialization;
- deterministic multiedge bidirectional CSR with forward/reverse projections, cursor BFS, deterministic projection hash and stronger invariants.

Additive authority contracts were written for concurrency, PropertyGraph, identity and CSR. They remain unexecuted.

## Current authority candidate ownership

```text
State             → AuthorityStateMachine
Agentic topology  → AuthorityAgenticRegistry
GraphRAG          → AuthorityGraphRAGIndex
ContextPack       → AuthorityContextPackCompiler
Hub runtime       → AuthorityHub
Hub query         → AuthorityHubQueryService
Hub context       → AuthorityHubContextProjector
Hub recovery      → AuthorityHubSnapshotManager
Memory            → AuthorityMemoryGateway + Coordinator + append-only stores
Durable history   → IEventLog / PostgresEventLog candidate
Observability     → AuthorityTelemetry
Tools             → strict ToolRegistry path
CSR hot graph     → BidirectionalCSRGraph authority candidate
```

Legacy counterparts remain shadow/deprecated/read-only compatibility and may not write authority truth.

## Phase 04 objective

Make persisted history and replay semantics truthful across adapters and projections.

### P04.1 — EventLog semantic parity

- InMemoryEventLog and PostgresEventLog must implement the same idempotency semantics;
- retries with same logical event converge;
- same idempotency key with different logical payload fails closed;
- writes/reads are copy-safe;
- cursor/order validation consistent.

### P04.2 — Canonical persisted payloads

- strict SHA/canonical serialization is authoritative for new integrity evidence;
- persisted/signed optional fields are omitted or represented canonically, never explicit `undefined`;
- snapshot schema/version makes legacy verification algorithm visible;
- round-trip through Postgres JSON/timestamps cannot create false hash divergence.

### P04.3 — KnowledgeGraph transaction/saga boundary

- statement + relation projection cannot partially apply silently;
- supersession/retraction preserves temporal/provenance history;
- projection failure either rolls back or emits explicit compensating/degraded evidence.

### P04.4 — Temporal semantics beyond memory

- valid-time and system-time semantics propagate to knowledge/authority projections;
- future knowledge never leaks into historical `knownAt` reads.

### P04.5 — Durable adapter fixtures

- driver-neutral executable fixtures for Postgres/Supabase candidates;
- semantic parity with in-memory reference adapters;
- no real production DB mutation during hardening.

### P04.6 — Replay / restore contracts

- corrupted snapshot fails closed;
- schema mismatch fails closed;
- empty projection restores from snapshot + event tail;
- deterministic final semantic hash;
- post-snapshot events replay exactly once at projection level.

## Known cross-phase risk

Phase 03 made `sha256Hex` strict. Existing persisted payloads containing explicit `undefined` or non-canonical objects must be migrated/versioned at the payload boundary; weakening canonical serialization is prohibited.

## Governance inherited

- legacy tests immutable unless waiver+ADR;
- >50 deleted lines/file require deletion governance;
- public behavior changes update compatibility/rollback;
- one authority writer per domain;
- one linear descendant branch;
- Actions manual-only; CD off;
- no Assurance movement without executed evidence.

## W13 timing

W13 #36 remains paused/non-authoritative. A new W13 is created only after Phase 07 freezes the exact complete qualification SHA.

## Next exact action

Create `hardening/phase-04-temporal-event-persistence` from the synchronized Phase 03 closure head. First slice: reconcile `InMemoryEventLog` and `PostgresEventLog` into one payload-bound, copy-safe semantic contract and add one adapter-parity authority fixture.
