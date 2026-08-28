# README_FIRST — COS Graph Engine

This is the mandatory cold-start entrypoint for humans and agents.

## Current mode

`CANONICAL_AUTHORITY_RECONCILIATION`

Active branch:

`hardening/canonical-authority-reconciliation`

Authority:

`SHADOW_ONLY`

Do not merge or start W13 until the reconciliation and evidence gates defined below are complete.

## Mandatory read order

1. `GOAL.md` — immutable North Star and authority gate.
2. `STATE.md` — compact current truth.
3. `SCORECARD_20D.md` — Build / Assurance / Authority scores.
4. `TASKS.md` — 10-phase execution program and checkpoints.
5. `GRAPH.md` — branch, runtime, failure and dependency graph.
6. `HANDOFF.md` — exact continuation and rollback.
7. `docs/hardening/PHASE_01_RECONCILIATION_34_35.md` — active capability matrix.
8. `docs/hardening/DELETION_LEDGER.md` — semantic preservation obligations.
9. `docs/hardening/GOAL_10_10.md` — evidence contract.
10. `docs/hardening/GUARANTEE_CATALOG.md` — guarantees are the unit of work.
11. Audit PR #38 / issue #39 — independent adversarial findings and stop-the-line gates.
12. `AGENTS.md` — canonical constitution followed by historical ledger.

## Mandatory operating laws

Every material task/change follows:

```text
/leydekidlin
→ /leydegilbert
→ /complexsystems
→ dependency / blast-radius analysis
→ smallest reversible action
→ implementation
→ evidence
→ independent review
→ persistence
```

## Current source topology

```text
#33 @ 5806a71
  ├── #34 @ af49735
  ├── #35 @ 8b7e197
  │    └── #36 W13 [PAUSED]
  └── canonical reconciliation [ACTIVE]
```

#34 and #35 are divergent source branches. They are not merge candidates and neither may be discarded before capability equivalence is documented.

## Scoring rule

`Authority = min(Build, Assurance)`.

Implementation volume can raise Build only. Tests, security, contention, replay, restore, benchmarks and cold-start evidence raise Assurance. `AUTHORITY_READY` requires all 20 Authority scores to equal 10.0.

## Cost policy

- Incremental recurring infrastructure cost: `EUR 0/month`.
- GitHub Actions: manual-only.
- Manual verification must preserve the full verification surface.
- CD/deploy/release: off until a separate owner decision after qualification.
- Local/offline execution is preferred.

## Before mutation

- verify branch, base ref and exact source SHA;
- state observed facts, assumptions and unknowns;
- identify the canonical capability owner;
- inspect introduced and removed failure modes/couplings;
- update the deletion ledger for any material replacement;
- preserve legacy tests and compatibility unless an ADR authorizes otherwise;
- define rollback before writing.

## After mutation

- record source lineage in commit/PR;
- update relevant invariants/tests/evidence links;
- update `STATE.md`, `TASKS.md` and `HANDOFF.md` for material checkpoints;
- synchronize Drive and Todoist;
- never leave the only recovery point in model/chat memory.
