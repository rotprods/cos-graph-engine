# Phase 04 Closure — Temporal / Event / Persistence

Status: `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`  
Authority status: `SHADOW_ONLY`  
Phase PR: `#45`  
Parent checkpoint: `checkpoint/phase-03-core-ad6a93c`  
Parent SHA: `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3`  
Implementation head before control-plane closure: `bedfec6b8ea147c91ac7d50a888c38b0439d53ff`

## Goal

Make accepted history, temporal queries, persistent adapters, snapshots and replay answer the same semantic questions across in-memory and Postgres/Supabase candidates without rewriting past knowledge or hiding partial projection failure.

## Closed static guarantees

### P04.1 — EventLog semantic parity

The in-memory and Postgres implementations now share one canonical logical-event contract:

- producer retries are bound to domain-semantic content, not attempt-local event/trace/span IDs;
- equal idempotency key plus equal logical event converges;
- equal key plus different payload, metadata, domain time, correlation or causation fails closed;
- event-ID reuse under a different operation is rejected;
- accepted events are detached on write and every read;
- cursor/limit/order validation is shared;
- the Postgres conflict path resolves the idempotency key before classifying an event-ID collision;
- transaction-aware fake Postgres evidence exists.

Primary files:

- `packages/runtime/src/event-log.ts`
- `packages/runtime/src/postgres-event-log.ts`
- `scripts/fixtures/fake-event-log-postgres.ts`
- `scripts/test-authority-event-log-parity.ts`

### P04.2 — Canonical persistence wire v1

A persistence/signing boundary now exists separately from the strict canonical serializer:

- `CANONICAL_JSON_WIRE_VERSION = 1`;
- strings and object keys normalize to NFC;
- `-0` normalizes to `0`;
- non-finite numbers, bigint, functions, symbols, cycles, accessors, sparse arrays, symbol keys and non-plain objects fail closed;
- optional object properties with `undefined` are omitted at the wire boundary;
- root/array `undefined` remains invalid;
- normalized-key collisions fail closed;
- payloads can survive JSON/JSONB round trips without changing their canonical hash.

Primary files:

- `packages/core/src/canonical-json.ts`
- `packages/core/src/integrity.ts`
- `scripts/test-authority-canonical-wire.ts`

### P04.3 / P04.4 — Append-only authority knowledge

A new authority candidate was added without deleting the legacy KnowledgeGraph:

- immutable append-only system revisions;
- independent valid-time and system-time axes;
- explicit provenance, epistemic type, confidence, project scope and sensitivity;
- `knownAt` resolves only revisions visible at that system time;
- late corrections cannot leak into earlier historical knowledge;
- domain closure creates a new revision rather than rewriting the prior row;
- `systemUntil` is derived from the next revision and never back-written;
- old retries resolve to the historical accepted operation;
- conflicting retries and stale writers fail closed;
- the PropertyGraph is a rebuildable projection, not the authority ledger;
- projection failure is retained as `KNOWLEDGE_PROJECTION_DEGRADED` and can be repaired idempotently without duplicating truth.

Primary files:

- `packages/knowledge/src/authority-knowledge.ts`
- `packages/knowledge/src/postgres-authority-knowledge.ts`
- `scripts/fixtures/fake-authority-knowledge-postgres.ts`
- `scripts/test-authority-knowledge.ts`
- `scripts/test-authority-knowledge-postgres.ts`

### P04.5 / P04.6 — Wire-stable Hub snapshot and recovery

The authority Hub snapshot path now has an explicit persistence wire contract:

- snapshot envelope schema and serialization version are first-class;
- SHA-256 covers the exact canonical wire value persisted to JSONB;
- runtime hydration restores optional TypeScript fields without changing semantic or integrity hashes;
- Hub command/outcome/projection hashes are JSON-roundtrip stable;
- successful outcomes omit absent errors before persistence;
- raw JSON roundtrip, exact snapshot restore and command/outcome tail replay have additive contracts;
- corrupt payload/hash, schema mismatch, serialization mismatch, metadata tampering and event-log-behind-snapshot fail closed;
- a fake Postgres snapshot store models actual JSON stringify/parse loss of JavaScript-only `undefined`.

Primary files:

- `packages/hub/src/authority-hub.ts`
- `packages/hub/src/authority-store.ts`
- `scripts/fixtures/fake-authority-hub-snapshot-postgres.ts`
- `scripts/test-authority-hub-recovery-wire.ts`

## Authority ownership after Phase 04

```text
Durable event history  → IEventLog / PostgresEventLog candidate
Knowledge truth        → AuthorityKnowledgeGateway + append-only stores
Knowledge projection   → AuthorityKnowledgeProjector (rebuildable)
Hub runtime history    → AuthorityHub command + recorded outcome events
Hub snapshot/recovery  → AuthorityHubSnapshotManager
Persistence encoding   → canonical JSON wire v1
Integrity evidence     → SHA-256 over canonical wire values
```

Legacy `KnowledgeGraph`, `EventBus` and earlier snapshot paths remain compatibility/shadow surfaces and cannot be treated as authority writers.

## Contracts written, not executed

The authority runner includes additive contracts for:

- event-log adapter parity;
- canonical wire behavior;
- in-memory authority knowledge;
- Postgres authority knowledge;
- Hub recovery/wire integrity.

These contracts are source artifacts only at this checkpoint. No clean install, strict typecheck, runtime test, real Postgres/Supabase fixture, replay drill or restore drill has been executed. Therefore:

```text
Build may improve after review.
Assurance remains 2.6/10 baseline.
Authority remains 2.6/10 baseline.
```

## Governance and blast radius

- no legacy test was modified;
- material replacements are registered in `DELETION_GOVERNANCE.json`;
- authority suites are additive in `TEST_EVIDENCE_MANIFEST.json`;
- `AUTHORITY_SURFACE_MANIFEST.json` names one authority candidate per capability;
- no production database, Supabase project, deployment, release or automatic Action was touched;
- PR #45 remains draft and unmerged.

## Rollback

Restore the entire phase to the Phase 03 checkpoint:

`checkpoint/phase-03-core-ad6a93c`

Exact SHA:

`ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3`

Do not selectively retain persisted data created under a newer wire/schema contract without an explicit migration decision.

## Next phase

Phase 05 is the single linear descendant and must proceed in this order:

```text
durable side-effect ledger
→ resource-bound fencing
→ lease renewal / expiry / crash recovery
→ durable goal-plan-result aggregate
→ principal / scope / sensitivity enforcement
→ deployment HTTP/FS isolation
→ operational near-miss evidence
```

Phase 05 may not claim exactly-once external effects. Its target is a durable, observable operation protocol with idempotent acceptance, fencing, explicit uncertain outcomes and compensation/reconciliation paths.