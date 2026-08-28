# STATE — COS Graph Engine

Updated: 2026-08-28  
Mode: **PHASE_04_STATIC_CLOSURE / PHASE_05_PREFLIGHT**  
Authority status: **SHADOW_ONLY**  
Current phase: **04 COMPLETE_STATIC → 05 NEXT**  
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

No score moved during Phases 01–04 because all contracts remain unexecuted.

## Frozen checkpoints

- Phase 01 — `checkpoint/phase-01-reconciled-76dfdc7` → `76dfdc737c231b2637f122125f7acf98b735ff1f` — PR #40
- Phase 02 — `checkpoint/phase-02-contracts-06487e7` → `06487e7acbce82c5a54dbb8dd171dceae2bb67ac` — PR #43
- Phase 03 — `checkpoint/phase-03-core-ad6a93c` → `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3` — PR #44
- Phase 04 — checkpoint branch created after synchronized closure; see `docs/hardening/PHASE_04_CLOSURE.md` and PR #45

## Phase 04 result

Status: `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`.

### Event truth

- one payload-bound logical-event contract for InMemory/Postgres EventLog;
- retry identity excludes attempt-local event/trace/span IDs and recordedAt;
- same key + different semantic event fails closed;
- detached event storage/read surfaces;
- shared cursor/limit/order validation;
- transaction-aware fake Postgres parity fixture.

### Persistence wire

- canonical JSON wire version 1;
- optional object `undefined` omitted only at persistence boundary;
- unsupported JS values/cycles/accessors/sparse arrays/non-finite numbers fail closed;
- NFC normalization and normalized-key collision rejection;
- SHA-256 over exact canonical wire values.

### Knowledge truth

- `AuthorityKnowledgeGateway` is the candidate authority owner;
- immutable append-only system revisions with independent valid-time;
- historical `knownAt` does not see future correction/closure;
- provenance, epistemic type, confidence, project scope and sensitivity are first-class;
- PropertyGraph is rebuildable projection only;
- projection failure becomes explicit degraded saga state and is repairable idempotently;
- Postgres adapter uses advisory transaction locking, revision CAS and INSERT-only history.

### Recovery truth

- Hub registration/command/outcome/projection hashes are JSON-roundtrip stable;
- snapshot envelopes carry schema + serialization version;
- SHA-256 covers the exact JSONB wire payload;
- empty projection + snapshot + event tail reconstructs semantic state;
- corruption, schema/serialization mismatch, metadata tampering and event-log-behind-snapshot fail closed;
- fake Postgres snapshot fixture models real JSON serialization behavior.

## Current authority candidate ownership

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
Observability       → AuthorityTelemetry
Tools               → strict ToolRegistry path
CSR hot graph       → BidirectionalCSRGraph candidate
```

Legacy counterparts remain shadow/deprecated/read-only compatibility and may not write authority truth.

## Phase 05 objective

Make external side effects, concurrent workers and autonomous agent execution survive retries, stale ownership and process failure without false exactly-once claims.

Exact order:

1. durable side-effect operation ledger;
2. resource-bound monotonic fencing at commit boundary;
3. lease acquire/renew/expire/reacquire/crash recovery;
4. durable immutable goal/plan/result aggregate;
5. principal/project/sensitivity policy enforcement across execution paths;
6. deployment-layer HTTP/FS isolation contracts;
7. near-miss evidence for denied/stale/duplicate/uncertain operations.

## Phase 05 hard constraints

- presence of an idempotency key is not proof of durable idempotency;
- presence of a fencing token is not proof it was validated at resource commit;
- do not call a side effect exactly-once unless the provider and operation protocol prove it;
- unknown outcome after crash must be represented as `uncertain` and reconciled;
- callback/state-machine rollback cannot undo an external provider mutation;
- no alternate execution writer may bypass the operation ledger;
- no automatic Actions or CD;
- no Assurance movement without executed evidence.

## W13 timing

PR #36 remains paused/non-authoritative. A new W13 is created only after Phase 07 freezes the exact complete qualification SHA.

## Next exact action

Freeze the synchronized Phase 04 ref, create the single descendant branch `hardening/phase-05-security-concurrency-runtime`, open a draft PR against Phase 04, and implement the durable side-effect ledger as the first guarantee.