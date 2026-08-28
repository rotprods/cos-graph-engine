# HANDOFF — COS Graph Engine

## Recovery point

Phases 01–03 are statically complete. COS remains `SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`.

### Frozen checkpoints

- Phase 01: `checkpoint/phase-01-reconciled-76dfdc7` → `76dfdc737c231b2637f122125f7acf98b735ff1f` — PR #40
- Phase 02: `checkpoint/phase-02-contracts-06487e7` → `06487e7acbce82c5a54dbb8dd171dceae2bb67ac` — PR #43
- Phase 03: `checkpoint/phase-03-core-ad6a93c` → `ad6a93c0b2986c36efefb5cd59a4d14a9dffceb3` — PR #44

Source #34/#35 remain preserved. W13 #36 remains paused/non-authoritative. PR #37 remains draft/rework.

No merge, automatic Action, deployment or production data mutation has occurred.

## Read first

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `TASKS.md`
6. `GRAPH.md`
7. `docs/hardening/PHASE_01_CLOSURE.md`
8. `docs/hardening/PHASE_02_CLOSURE.md`
9. `docs/hardening/PHASE_03_CLOSURE.md`
10. `docs/hardening/ADR_INDEX.md`
11. `docs/hardening/COMPATIBILITY_MATRIX.md`
12. `docs/hardening/ROLLBACK_MAP.md`
13. `docs/hardening/ROLLBACK_MAP_PHASE03.md`
14. `docs/hardening/TEST_EVIDENCE_MANIFEST.json`
15. `docs/hardening/DELETION_GOVERNANCE.json`
16. `AGENTS.md`

## Phase 03 completed-static guarantees

- CAS/idempotency values no longer leak mutable nested references;
- PropertyGraph storage/reads/queries/traversals are detached and indices follow mutations;
- traversal has explicit depth/direction/path invariants;
- strict `canonicalSerialize/canonicalHash128` exists for authority data while legacy hash remains compatibility-only;
- SHA-256 integrity hashes strict canonical payloads;
- canonical identity uses NFC/provider-aware normalization and detached registry reads;
- BidirectionalCSRGraph is the single authority CSR candidate with deterministic multiedge identity, forward/reverse CSR and deterministic projection hashes;
- additive authority contracts exist for all above guarantees.

Everything remains unexecuted. Assurance did not move.

## Current phase — Phase 04 Temporal / Event / Persistence

Create exactly one descendant branch:

`hardening/phase-04-temporal-event-persistence`

from the synchronized Phase 03 closure head.

### Exact implementation order

1. EventLog semantic parity
   - inspect `packages/runtime/src/event-log.ts` and `postgres-event-log.ts`;
   - define one logical-event equality/canonicalization function;
   - make in-memory and Postgres idempotency behavior identical;
   - detach stored/read values;
   - add adapter-parity contract.
2. Strict persisted payloads
   - find `sha256Hex`/snapshot callers;
   - remove explicit undefined/non-canonical data from signed payloads;
   - version serialization/algorithm where needed;
   - normalize DB timestamp/JSON round trips.
3. KnowledgeGraph transaction/saga
   - inspect L8 KnowledgeGraph mutation sequences;
   - prevent partial statement/relation commits;
   - preserve supersession/retraction provenance;
   - add failure-injection contract.
4. Temporal semantics
   - add append-only system-time revisions for authority knowledge;
   - enforce `asOf` + `knownAt` truth without future leakage.
5. Durable adapter fixtures
   - fake driver-neutral Postgres executor;
   - verify adapter semantic parity without any real DB.
6. Replay/restore
   - corrupted snapshot/schema mismatch/empty projection/tail replay/deterministic hash contracts.

## Strict-canonicalization warning

`sha256Hex` now rejects explicit `undefined` and non-canonical objects. Persisted/signed payloads must be canonicalized or schema-versioned; do not weaken the serializer to make old payloads pass.

## Change gates

Before every material diff:

```text
legacy test touched? → waiver + ADR required
>50 deletions/file? → DELETION_GOVERNANCE entry required
public behavior changed? → compatibility + rollback update
new alternate authority writer? → prohibited
```

## Branch law

```text
Phase01 → Phase02 → Phase03 → Phase04 → Phase05 → Phase06 → Phase07
                                                      ↓
                                          exact qualification SHA
                                                      ↓
                                                   new W13
```

No sibling authority branch.

## Cost / verification

- recurring incremental cost €0/month;
- GitHub Actions manual-only;
- CD/deploy/release OFF;
- no Assurance promotion without executed evidence.

## Rollback

- Phase03: `checkpoint/phase-03-core-ad6a93c`
- Phase02: `checkpoint/phase-02-contracts-06487e7`
- Phase01: `checkpoint/phase-01-reconciled-76dfdc7`
- pre-reconciliation: #33 `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`
