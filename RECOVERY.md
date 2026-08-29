---
authority: PROJECTION
scope: COS V2 continuity, replay, restore and disaster-recovery architecture
owner: Recovery Engineer
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: conceptual-only recovery descriptions
status: PROPOSED
---

# COS Graph Engine V2 — Recovery Model

## 1. Recovery objective

COS must recover from loss of:

- chat history;
- agent memory;
- a session;
- a local checkout;
- cached ContextPacks;
- graph and search projections;
- local databases;
- a worker during an external side effect;
- observation, telemetry or repair workers;
- documentation projections.

Recovery must reconstruct the same canonical project state, important graph topology, blockers, ownership and next-safe action within documented tolerance.

## 2. Recovery authority hierarchy

```text
1. exact Git commit / qualified release artifact
2. append-only operational and domain events
3. append-only canonical revisions
4. integrity-verified snapshots at known source positions
5. rebuildable graph/index/document projections
6. bounded ContextPack for the recovery objective
```

A cache, generated document or ContextPack cannot repair authority. It can only point to it.

## 3. Recovery classes

### R1 — Conversation/context loss

**Lost:** chat context, model memory, local scratchpad.

**Recover from:** `README_FIRST.md`, live-truth projection, event ledger, session/claim state, `STATE.md`, `HANDOFF.md`, implementation program and exact GitHub refs.

**Success criterion:** a zero-context agent identifies North Star, current branch/head, open barriers, verified/unverified work, active claim and next-safe task in under five minutes.

### R2 — Agent/session death

**Lost:** active worker or session after claiming work.

**Recover from:** session and claim events, claim expiry/heartbeat, branch/PR, task state and durable side-effect/repair aggregates.

**Success criterion:** successor either resumes from durable state or safely waits for/invalidates the stale claim without duplicate mutation.

### R3 — Local checkout loss

**Lost:** all local files and package caches.

**Recover from:** exact repository commits and lock/toolchain manifests.

**Success criterion:** clean checkout reproduces source and dependencies; no unstaged local state was required for continuity.

### R4 — Projection loss

**Lost:** temporal graph, indexes, generated docs, dashboards or ContextPacks.

**Recover from:** model, canonical revisions and event watermarks.

**Success criterion:** rebuilt projection has the same schema, source position, important topology, orphan count and deterministic hash.

### R5 — Local database loss

**Lost:** PostgreSQL/Supabase schema and data in a recovery drill.

**Recover from:** migrations, trusted snapshot, event tail and source archives.

**Success criterion:** empty database becomes query-equivalent to pre-loss state, including negative scope queries.

### R6 — Provider timeout or worker crash

**Lost:** certainty about whether an external side effect was accepted.

**Recover from:** durable operation state, lease/fence history, provider idempotency identity and read-only provider/resource inspection.

**Success criterion:** classify `applied`, `not_applied`, `partial` or `unknown` without blindly re-executing.

### R7 — Observation/repair subsystem loss

**Lost:** signals, telemetry delivery or a repair worker after provider outcome is known.

**Recover from:** protected operation truth plus append-only repair ledger.

**Success criterion:** protected outcome remains unchanged and secondary duty eventually resolves or becomes explicitly abandoned.

### R8 — Corrupt snapshot or event/projection mismatch

**Detected by:** content hash, schema, source position, replay divergence or gold-query mismatch.

**Response:** isolate corrupt artifact, fall back to earlier trusted snapshot or full replay, preserve evidence and open incident.

## 4. Canonical reconstruction procedure

```text
STEP 0 — ISOLATE
Stop affected writers and external side effects. Preserve current evidence.

STEP 1 — DISCOVER
Identify project, repository, exact main/candidate SHA, event ledger manifest,
latest trusted snapshot, active claim and recovery objective.

STEP 2 — VERIFY INPUTS
Verify signatures/hashes where available, schema versions, event sequence,
snapshot source position and project/sensitivity scope.

STEP 3 — INITIALIZE
Create empty workspace/database. Apply versioned migrations in order.

STEP 4 — RESTORE SNAPSHOT
Load only an integrity-valid, schema-compatible snapshot at a known watermark.

STEP 5 — REPLAY TAIL
Apply immutable recorded outcomes after the snapshot position. Do not re-decide historical commands.

STEP 6 — REBUILD PROJECTIONS
Recreate graph, indexes, ContextPack sources, generated documents and dashboards.

STEP 7 — VERIFY
Compare state/projection hashes, invariants, counts and gold queries. Run negative
permission/sensitivity queries.

STEP 8 — RESUME
Create a new session and claim, compile a fresh ContextPack and execute the next safe task.

STEP 9 — PERSIST
Record recovery event, evidence, RPO/RTO, residual risk and incident/regression tests.
```

## 5. Replay invariants

1. Events are applied in canonical sequence/partition order.
2. Duplicate logical events converge or conflict fail closed.
3. Replayed outcomes are identical to the recorded outcomes.
4. Reducer/version migrations are explicit and testable.
5. Replay never executes external provider side effects.
6. Projection hashes are deterministic for identical source state.
7. Project and sensitivity scope are preserved.
8. Missing event positions fail rather than silently skipping.
9. Unknown schema versions fail closed.
10. Replay divergence creates evidence and blocks promotion.

## 6. Snapshot contract

Every authority-grade snapshot includes:

```text
snapshot_id
schema_version
source_revision
event_watermark
projection/domain revision
created_at
hash_algorithm = sha256
content_hash
producer version
scope / sensitivity
```

Snapshots are immutable. `stableHash128` may support deterministic identity but does not replace SHA-256 integrity evidence.

## 7. Operational event-ledger recovery

The V2 control plane uses segmented NDJSON:

```text
control-plane/v2/events/manifest.json
control-plane/v2/events/events.ndjson
control-plane/v2/events/segments/*.ndjson
```

Rules:

- sealed segments are never rewritten;
- sequence is contiguous;
- event IDs are unique;
- projections declare event watermark;
- corrections append new events;
- Git exact commits bind segment contents;
- future high-concurrency migration requires a measured trigger and compatible event port.

## 8. Zero-context recovery packet

A successor reads, in order:

1. `README_FIRST.md`;
2. `control-plane/v2/model/MODEL_MANIFEST.json`;
3. `control-plane/v2/state/live-truth.r2.json` or latest revision;
4. `control-plane/v2/events/manifest.json`;
5. latest active-claims projection;
6. `STATE.md`;
7. `HANDOFF.md`;
8. `TASKS.md` and compiled frontier;
9. `ARCHITECTURE.md` and `LEXICON.md`;
10. applicable ADRs/contracts/evidence.

Before mutation, the successor verifies live GitHub truth and creates a unique session/claim.

## 9. Recovery tests

### TST-GRAPH-REBUILD

Delete generated graph views. Recompile from selected model/events. Require identical projection hashes and no new orphans.

### TST-EMPTY-DB-RESTORE

Start empty PostgreSQL. Apply migrations, restore snapshot/tail, rebuild projections and compare state/gold queries.

### TST-COLD-AGENT-5MIN

Give a fresh agent repository access but no chat history. Time its reconstruction. Compare answers to a hidden expected-state manifest.

### TST-PROCESS-KILL

Kill worker at every side-effect boundary: before claim, after claim, after lease, after prepare, after begin/provider acceptance, before commit, after commit/before evidence and during repair.

### TST-SNAPSHOT-CORRUPTION

Modify payload, hash, schema, watermark and scope independently. Every corrupt variant must fail closed.

### TST-EVENT-GAP

Remove or reorder an event. Projection rebuild must reject the sequence.

### TST-RECOVERY-SCOPE

Restore and replay under multiple projects/sensitivity levels; prove no widening.

## 10. Recovery evidence

Each drill persists:

```text
drill_id
failure injected
exact candidate SHA
toolchain/environment
pre-state hash
snapshot/event source positions
commands
post-state hash
gold-query results
RPO
RTO
PASS / FAIL / SKIPPED / NOT_RUN
operator/reviewer
artifacts and hashes
residual risk
```

## 11. RPO and RTO targets

Initial targets are hypotheses until measured:

| Recovery class | Initial RPO target | Initial RTO target |
|---|---:|---:|
| chat/context loss | 0 persisted events | 5 minutes |
| agent death | 0 accepted authority events | lease/claim expiry + 5 minutes |
| local checkout | 0 committed state | 15 minutes |
| projection loss | 0 authority state | 15 minutes |
| empty database | event-tail bounded | 60 minutes |
| provider ambiguity | 0 blind retries | provider-dependent, explicitly bounded |
| telemetry/repair | protected outcome RPO 0 | retry policy / explicit abandonment |

These values must be replaced by empirical results during Phase 08.

## 12. Rollback versus compensation

**Rollback** restores local code/configuration or a projection to a previous qualified revision.

**Compensation** records a new external operation that mitigates an already accepted side effect.

Neither deletes history. Provider compensation itself uses policy, idempotency, lease/fencing, reconciliation and evidence.

## 13. Disaster-recovery authority

- Recovery Engineer executes the documented drill.
- Security Architect reviews scope and integrity.
- Assurance Lead accepts evidence.
- Roberto authorizes production resumption or authority promotion.
- A failed or ambiguous drill keeps the system `SHADOW_ONLY` or demotes it.

## 14. Current recovery state

```text
Control-plane validator/compiler: locally executed, exact-SHA binding pending
Graph projection rebuild: NOT_RUN as a committed artifact
Empty-database restore: NOT_RUN
Cold-agent drill: NOT_RUN
Physical provider/TLS/filesystem recovery: NOT_RUN
Product authority: SHADOW_ONLY
```
