# HANDOFF — COS Graph Engine

## Recovery point

Phase 01 canonical reconciliation is statically complete. COS remains `SHADOW_ONLY` and `IMPLEMENTED_UNVERIFIED`.

Phase 01 code checkpoint:

`checkpoint/phase-01-reconciled-76dfdc7`

Exact code SHA:

`76dfdc737c231b2637f122125f7acf98b735ff1f`

Phase 01 PR:

`#40 — hardening(reconciliation): unify W12.4 authority lineages from PRs #34 and #35`

Source base:

`#33 @ 5806a71fd7bb11245dfe1454b7094bc9febf8ed5`

Source siblings remain preserved:

- #34 @ `af4973561b5f7d7a7415fa8f88a12a7d8d678a66`;
- #35 @ `8b7e197f35e6fc114cd90ec0907db4c2f5b625f4`.

No merge or W13 run is authorized.

## Mandatory read order

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `TASKS.md`
6. `GRAPH.md`
7. `docs/hardening/PHASE_01_CLOSURE.md`
8. `docs/hardening/PHASE_01_SOURCE_COVERAGE.md`
9. `docs/hardening/AUTHORITY_SURFACE_MANIFEST.json`
10. `docs/hardening/API_BEHAVIOR_DIFF_PHASE01.md`
11. deletion ledger + addendum
12. `AGENTS.md`

## Phase 01 result

### Reconciliation truth

- every material #34/#35 source surface classified;
- no blind branch merge;
- one candidate authority owner per reconciled capability;
- legacy surfaces preserved as explicit shadow/deprecated compatibility;
- W13 #36 rejected as complete qualification lineage;
- code checkpoint frozen before Phase 02.

### Authority candidate surfaces

- `AuthorityStateMachine`;
- `AuthorityAgenticRegistry`;
- `AuthorityGraphRAGIndex`;
- `AuthorityContextPackCompiler`;
- `AuthorityHub`, query/context/recovery surfaces;
- `AuthorityMemoryGateway`, coordinator and append-only in-memory/Postgres stores;
- `AuthorityTelemetry`;
- strict tool runtime;
- durable event-log interface/Postgres candidate.

### Written but unexecuted authority contracts

- state/revision fencing and rollback;
- agentic revision history/scope/sensitivity;
- ContextPack staleness/integrity/non-leakage;
- Hub idempotency/outcome/replay/snapshot recovery/query/context;
- memory late-correction, retry, bitemporal and sensitivity non-leakage.

## Phase 02 — ACTIVE NEXT

Create exactly one descendant branch from the Phase 01 closure head.

Implementation order:

1. `TEST_EVIDENCE_MANIFEST.md`
   - inventory existing legacy tests by exact path;
   - mark them immutable evidence during hardening;
   - map authority tests as additive, not replacements.
2. `ADR_INDEX.md` + canonical ADRs
   - single authority owner;
   - valid-time vs system-time;
   - outcome-based replay;
   - additive compatibility/deprecation;
   - exactly-once limitations for side effects.
3. `COMPATIBILITY_MATRIX.md`
   - legacy symbol/API;
   - authority replacement;
   - behavior delta;
   - compatibility status;
   - migration adapter/owner.
4. `ROLLBACK_MAP.md`
   - code ref;
   - data/schema rollback;
   - event/replay implications;
   - operational controls.
5. complete deletion-ledger enforcement and package public-API policy.
6. only where justified, implement read-only/migration adapters that cannot write authority state.
7. freeze Phase 02 checkpoint.

## Branch law

```text
Phase 01 closure
  └─ Phase 02
       └─ Phase 03
            └─ Phase 04
                 └─ Phase 05
                      └─ Phase 06
                           └─ Phase 07
                                └─ exact qualification SHA
                                     └─ new W13
```

Do not create sibling authority branches.

## Hard safety rules

- do not merge #34/#35/#36/#37;
- do not move `checkpoint/phase-01-reconciled-76dfdc7`;
- do not delete or rewrite legacy tests as part of authority-test creation;
- do not permit migration adapters to become alternate authority writers;
- do not call current-row overwrite bi-temporal history;
- do not claim exactly-once side effects from idempotency-key presence;
- do not raise Assurance without executed evidence;
- do not enable automatic Actions/CD.

## Cross-plane checkpoint

GitHub, Drive and the dedicated Todoist COS project must be synchronized on every material phase boundary. Do not mutate unrelated Todoist projects.

## Rollback

- Phase 01 code candidate: `checkpoint/phase-01-reconciled-76dfdc7`.
- Pre-reconciliation: #33 SHA `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`.
