# STATE — COS Graph Engine

Updated: 2026-08-28  
Mode: **CANONICAL_AUTHORITY_RECONCILIATION**  
Authority status: **SHADOW_ONLY**  
Current phase: **01 / 09 — RECONCILIATION #34 + #35**  
Active draft PR: **#40**  
Automatic CI/CD: **OFF**  
Merge authorization: **DENIED UNTIL HARDENING + EVIDENCE**

## North Star

Bring COS Graph Engine to `10.0 Authority` in all 20 audited engineering verticals, then qualify it as the zero-cost graph compute/projection and agent-runtime substrate of AGENTIC_SYSTEMS_OS.

Scoring law: `Authority = min(Build, Assurance)`.

Current calibrated baseline remains:

- Build: **7.6/10**;
- Assurance: **2.6/10**;
- Authority: **2.6/10**.

The current branch contains substantially more implementation than the baseline, but no score is promoted before static review and executed evidence.

## Current branch truth

Active branch: `hardening/canonical-authority-reconciliation`  
Base: #33 / `hardening/w12-3-core-gap-closure` @ `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`.

Divergent source evidence:

- #34 @ `af4973561b5f7d7a7415fa8f88a12a7d8d678a66`;
- #35 @ `8b7e197f35e6fc114cd90ec0907db4c2f5b625f4`.

PR #40 is the single canonical reconciliation line. PR #36 remains paused and must never certify this candidate. PR #37 remains draft/rework. Audit PR #38 and issue #39 remain governance controls.

## Phase 01 implementation state

### Completed control/governance

- source topology and #34/#35 capability inventory;
- C01–C13 canonical ownership decisions;
- 20D Build/Assurance/Authority scorecard;
- semantic deletion ledger + Phase 01 replacement addendum;
- machine-readable `AUTHORITY_SURFACE_MANIFEST.json`;
- `API_BEHAVIOR_DIFF_PHASE01.md`;
- `LOCKFILE_TRUTH_PHASE01.md`;
- strict `tsconfig.authority.json` and `typecheck:authority` command;
- isolated Todoist project and Drive synchronization contract.

### Canonical authority candidates implemented

- strict tool runtime and false-success removal;
- `AuthorityTelemetry`;
- immutable EventBus delivery-failure observation;
- semantic GitHub provider fixtures;
- `AuthorityStateMachine`;
- `AuthorityAgenticRegistry`;
- `AuthorityGraphRAGIndex`;
- `AuthorityContextPackCompiler`;
- `AuthorityHub` outcome-sourced repository runtime;
- `AuthorityHubQueryService`;
- `AuthorityHubContextProjector`;
- `AuthorityHubSnapshotManager` + in-memory/Postgres snapshot stores;
- `AuthorityMemoryGateway` + `AuthorityMemoryCoordinator`;
- append-only `InMemoryAuthorityMemoryStore` + `PostgresAuthorityMemoryStore`.

### Authority contracts written, not executed

- state machine;
- agentic registry;
- ContextPack;
- Hub command/outcome/replay/recovery/query/context;
- memory bitemporal/idempotency/non-leakage.

Root `test:authority:reconciliation` now includes all five contract groups. They remain unexecuted.

## Important defects discovered and corrected during static implementation

- #34/#35 sibling divergence and incomplete W13 lineage;
- GraphRAG relation identity/sensitivity ordering;
- wall-clock timestamps in replay/context identity;
- Hub semantic state hash accidentally coupled to event cursor;
- Hub outcome duplicate path lacking full logical-hash verification;
- reserved Hub metadata overwrite risk;
- state-machine identity validation on restore;
- memory current-row history incapable of truthful `knownAt`;
- late retry falsely classified as stale after newer revisions;
- relation retry semantics depending on future endpoint state;
- memory query leaking future successor timestamp via `systemUntil`;
- relation sensitivity potentially leaking restricted endpoint state.

The canonical memory authority read path is therefore `AuthorityMemoryGateway`, not the lower-level `AuthorityMemoryService`.

## Current surface ownership

See `docs/hardening/AUTHORITY_SURFACE_MANIFEST.json`.

Authority candidate owners:

```text
State             → AuthorityStateMachine
Agentic topology  → AuthorityAgenticRegistry
GraphRAG          → AuthorityGraphRAGIndex
ContextPack       → AuthorityContextPackCompiler
Hub runtime       → AuthorityHub
Hub query/context → AuthorityHubQueryService / AuthorityHubContextProjector
Hub recovery      → AuthorityHubSnapshotManager
Memory            → AuthorityMemoryGateway
Durable history   → IEventLog / PostgresEventLog candidate
Observability     → AuthorityTelemetry
```

Legacy counterparts remain shadow/deprecated compatibility. They are not deleted in Phase 01.

## Remaining P0/P1 engineering after reconciliation

The following are intentionally downstream hardening, not reasons to create more sibling reconciliation branches:

- deep immutability in legacy CAS/PropertyGraph/Memory surfaces;
- canonical identity Unicode/provider normalization;
- KnowledgeGraph transaction/saga boundaries;
- durable side-effect operation ledger;
- resource-level fencing + lease renewal/crash recovery;
- durable goal aggregate and restart semantics;
- deployment-level HTTP/FS isolation;
- gold-query evaluation and near-miss wiring;
- full Postgres/Supabase semantic fixtures;
- package-lock regeneration and explicit `typescript`/`tsx` pinning from a clean environment;
- legacy + authority test separation and full manual CI matrix.

## Lockfile truth

`package-lock.json` is stale: root version is `0.1.0` and its workspace list stops at `packages/graph`, while current `package.json` is `2.1.0` and includes Hub/visualization/WASM. Do not hand-edit the lock. W13/Q0 will regenerate and review it from a clean registry-enabled environment.

## Process correction — W13 timing

Do **not** recreate W13 at the end of Phase 01. That would risk another qualification branch drifting while Phases 02–07 continue changing the candidate.

Correct sequence:

```text
Phase 01 reconciliation freeze
→ Phase 02 contracts/governance
→ Phase 03 core correctness
→ Phase 04 temporal/event/persistence
→ Phase 05 security/concurrency/runtime
→ Phase 06 Hub/memory/GraphRAG/observability hardening
→ Phase 07 test truth/manual CI substrate
→ freeze exact candidate SHA
→ recreate W13 from that SHA
→ Phase 08 evidence campaign
→ Phase 09 20D qualification/merge
```

## Cost posture

- recurring incremental infrastructure cost: `EUR 0/month`;
- GitHub Actions manual-only;
- CD/deploy/release off;
- no remote qualification run during current reconciliation;
- Codex optional, not mandatory.

## Next exact action

Finish Phase 01 governance closure, then begin Phase 02 on a **single linear descendant** of PR #40. Do not create a sibling branch. Phase 02 starts with ADR/compatibility index + rollback map + preservation of legacy tests as independent evidence.
