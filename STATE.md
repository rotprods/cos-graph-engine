# STATE — COS Graph Engine

Updated: 2026-08-28  
Mode: **HARDENING_CONTRACTS_COMPATIBILITY**  
Authority status: **SHADOW_ONLY**  
Current phase: **02 / 09 — CONTRACTS / COMPATIBILITY / DELETION GOVERNANCE**  
Phase 01 draft PR: **#40**  
Automatic CI/CD: **OFF**  
Merge authorization: **DENIED UNTIL HARDENING + EVIDENCE**

## North Star

Bring COS Graph Engine to `10.0 Authority` in all 20 audited engineering verticals, then qualify it as the zero-cost graph compute/projection and agent-runtime substrate of AGENTIC_SYSTEMS_OS.

Scoring law: `Authority = min(Build, Assurance)`.

Current calibrated baseline remains:

- Build: **7.6/10**;
- Assurance: **2.6/10**;
- Authority: **2.6/10**.

No score is promoted merely because Phase 01 code exists. Static implementation and reconciliation have improved the candidate, but executed evidence remains pending.

## Phase 01 closure

Status: `COMPLETE_STATIC / IMPLEMENTED_UNVERIFIED`.

Frozen code checkpoint:

- ref: `checkpoint/phase-01-reconciled-76dfdc7`;
- exact SHA: `76dfdc737c231b2637f122125f7acf98b735ff1f`;
- source base: #33 @ `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`;
- source siblings preserved: #34 @ `af4973561b5f7d7a7415fa8f88a12a7d8d678a66`, #35 @ `8b7e197f35e6fc114cd90ec0907db4c2f5b625f4`.

Closure artifacts:

- `docs/hardening/PHASE_01_CLOSURE.md`;
- `docs/hardening/PHASE_01_SOURCE_COVERAGE.md`;
- `docs/hardening/AUTHORITY_SURFACE_MANIFEST.json`;
- `docs/hardening/API_BEHAVIOR_DIFF_PHASE01.md`;
- `docs/hardening/DELETION_LEDGER.md` + addendum;
- `docs/hardening/LOCKFILE_TRUTH_PHASE01.md`.

All material source files in #34/#35 have an explicit disposition. No source capability remains accidentally unclassified.

## Canonical authority candidates after Phase 01

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
```

Legacy counterparts remain shadow/deprecated compatibility and are not deleted.

## Defects found and corrected during Phase 01 static work

- divergent #34/#35 sibling lineages and incomplete W13 lineage;
- GraphRAG identity/sensitivity ordering;
- implicit wall-clock timestamps in replay/context identity;
- Hub semantic hash coupled to event cursor;
- incomplete duplicate outcome verification;
- reserved Hub metadata overwrite risk;
- state restore identity mismatch risk;
- current-row memory unable to answer truthful `knownAt`;
- late retry misclassified as stale after later revisions;
- relation retry depending on future endpoint state;
- future successor timestamp leaking through memory queries;
- sensitivity propagation capable of leaking restricted endpoint information.

## Phase 02 objective

Turn the reconciled code into an explicit compatibility contract before deeper mutation hardening.

Phase 02 must provide:

1. immutable legacy-test evidence manifest;
2. additive authority-test manifest;
3. ADR index covering authority ownership, temporal semantics, replay semantics and intentional behavior breaks;
4. compatibility matrix for every public legacy→authority surface;
5. rollback map for code, schema/data and operational controls;
6. deletion-ledger closure/enforcement rules;
7. migration adapters only where they cannot become alternate authority writers;
8. package public-API stability/deprecation policy;
9. linear descendant branch discipline through Phase 07.

## Remaining P0/P1 after contracts

Phase 03+:

- deep immutability in CAS/PropertyGraph/legacy memory surfaces;
- graph traversal/index invariants;
- Unicode/provider canonical identity normalization;
- KnowledgeGraph transaction/saga boundaries;
- durable side-effect operation ledger;
- resource-level fencing and lease recovery;
- durable goal aggregate/restart semantics;
- deployment-level HTTP/FS isolation;
- full Postgres/Supabase semantic fixtures;
- gold queries, near-miss wiring and authority telemetry integration;
- lockfile regeneration/toolchain pinning;
- full manual CI/evidence qualification.

## W13 timing

W13 #36 remains non-authoritative and paused.

The replacement W13 is created only after Phase 07 freezes the exact final candidate SHA. This prevents qualification lineage drift.

## Cost posture

- recurring incremental infrastructure cost: `EUR 0/month`;
- GitHub Actions manual-only;
- CD/deploy/release off;
- no remote qualification run in Phase 02;
- Codex optional, not mandatory.

## Next exact action

Create a single linear Phase 02 descendant branch from the Phase 01 closure head. Materialize the compatibility/ADR/rollback/test-preservation contract and only then begin Phase 03 core-correctness mutations.
