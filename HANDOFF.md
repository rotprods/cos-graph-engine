# HANDOFF — COS Graph Engine

## Recovery point

COS is closing Phase 01 of the evidence-backed 10/10 Authority Program.

Active branch: `hardening/canonical-authority-reconciliation`  
Active draft PR: **#40**  
Base: #33 @ `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`  
Source evidence: #34 @ `af497356...`, #35 @ `8b7e197...`.

Authority remains `SHADOW_ONLY`. No merge, remote W13 run, deploy or automatic Actions are authorized.

## Mandatory read order

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `TASKS.md`
6. `GRAPH.md`
7. `docs/hardening/AUTHORITY_SURFACE_MANIFEST.json`
8. `docs/hardening/API_BEHAVIOR_DIFF_PHASE01.md`
9. `docs/hardening/DELETION_LEDGER.md`
10. `docs/hardening/DELETION_LEDGER_PHASE01_ADDENDUM.md`
11. `docs/hardening/LOCKFILE_TRUTH_PHASE01.md`
12. `docs/hardening/PHASE_01_RECONCILIATION_34_35.md`
13. audit PR #38 / issue #39
14. `AGENTS.md`

## Phase 01 materialized architecture

```text
strict tool execution
        │
        ├── AuthorityTelemetry
        └── immutable delivery-failure evidence

AuthorityStateMachine
        ↓
AuthorityHub
 command → accepted/rejected outcome
        ├── AuthorityHubQueryService
        ├── AuthorityHubSnapshotManager
        └── AuthorityHubContextProjector
                      │
AuthorityAgenticRegistry
        ↓
AuthorityGraphRAGIndex
        ↓
AuthorityContextPackCompiler

AuthorityMemoryGateway
        ├── AuthorityMemoryCoordinator
        ├── InMemoryAuthorityMemoryStore
        └── PostgresAuthorityMemoryStore
```

## Implemented authority semantics

### State
- one serialized mutation queue;
- staged callbacks;
- expected-state/revision fencing;
- deterministic definition/snapshot hashes;
- timer fencing and copy-safe reads.

### Agentic topology
- canonical IDs;
- object + projection CAS;
- append-only transaction-time revisions;
- project/sensitivity/validAt/knownAt filtering;
- deterministic relation history.

### Retrieval/context
- atomic complete GraphRAG projection replacement;
- projection version/hash CAS;
- deterministic relation IDs;
- endpoint sensitivity propagation;
- explicit valid/system knowledge cutoffs;
- authority-only ContextPack compiler with explicit timestamps, evidence hash and SHA-256 integrity.

### Hub
- repository registration is event-sourced;
- command and outcome are distinct durable facts;
- command→transition→outcome serialized per repository;
- command-without-outcome is incomplete/degraded and blocks clean snapshot;
- replay applies recorded outcomes and never re-decides historical commands;
- semantic state hash is independent from event cursor;
- sealed in-memory/Postgres snapshot stores;
- snapshot+tail replay coordinator;
- authority query/context bridge.

### Memory
- append-only immutable revisions;
- `systemUntil` is derived, never back-written;
- `AuthorityMemoryCoordinator` handles late retries against original accepted operation;
- `AuthorityMemoryGateway` prevents future-revision timestamp leakage at `knownAt`;
- relation visibility dynamically propagates endpoint sensitivity at the cutoff;
- Postgres adapter serializes revision allocation with per-memory advisory transaction lock and CAS;
- supersession/contradiction are append-only relations.

## Contract code written but NOT executed

Root scripts now include:

```text
typecheck:authority
test:authority:state
test:authority:registry
test:authority:context
test:authority:hub
test:authority:memory
test:authority:reconciliation
```

No one may describe these as passing until they are executed in Phase 07/08.

## Important remaining hardening

These are downstream phases, not reasons to fork reconciliation again:

- deep immutability for legacy CAS/PropertyGraph/Memory surfaces;
- identity Unicode/provider normalization;
- transactional/saga KnowledgeGraph;
- durable side-effect ledger + resource fencing + lease lifecycle;
- durable agent goal aggregate/restart semantics;
- principal/scope/policy enforcement across all side effects;
- deployment-level HTTP/FS isolation;
- complete AuthorityTelemetry/near-miss wiring;
- gold-query evaluation;
- Postgres/Supabase executable parity fixtures;
- legacy + authority suite manifest;
- manual full CI matrix;
- clean lockfile/toolchain pinning.

## Lockfile blocker

Current `package-lock.json` is stale (`0.1.0`, workspace list stops at `packages/graph`). Do not edit by hand. Phase 07/W13 Q0 will regenerate it from a clean registry-enabled environment and explicitly pin qualification `typescript` + `tsx`.

## Process correction

Do **not** recreate W13 now.

Correct sequence:

```text
Phase 01 reconciliation freeze
→ Phase 02 contracts/governance
→ Phase 03 core correctness
→ Phase 04 temporal/event/persistence
→ Phase 05 security/concurrency/runtime
→ Phase 06 operational context/observability hardening
→ Phase 07 full test/manual-CI substrate
→ freeze exact SHA
→ recreate W13
→ Phase 08 evidence
→ Phase 09 20D qualification + merge
```

Creating W13 earlier would recreate the branch-drift failure we already observed.

## Next exact action

1. perform final Phase 01 static overlap review;
2. record Phase 01 freeze SHA as architecture/reconciliation baseline — not merge/production certification;
3. create **one linear descendant** for Phase 02, never a sibling authority branch;
4. Phase 02: ADR index, compatibility matrix, rollback map and explicit legacy-test preservation contract.

## Hard safety rules

- #34/#35 remain evidence sources, never merge targets;
- #36 is invalid as final qualification lineage;
- #37 cannot merge until full verification breadth is restored;
- legacy tests are not rewritten to fit new code;
- current-row overwrite is not bi-temporal history;
- presence-only idempotency/fencing is not exact-once;
- EventBus is not durable accepted history;
- no Assurance increase without executed evidence;
- no automatic Actions or CD.

## Cross-plane persistence

```text
GitHub = executable/evidence truth
Drive = Acta + global STATE
Todoist = live execution state
```

Any failed synchronization must be recorded here.

## Rollback

Phase 01 reconciliation rollback root remains #33 SHA `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`. No production data or `main` state has been changed by this branch.
