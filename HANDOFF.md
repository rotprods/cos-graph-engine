# COS Graph Engine — HANDOFF

Updated: 2026-08-25

## Mission

Bring COS Graph Engine to evidence-backed 10/10 across all 20 engineering dimensions before promotion from `SHADOW_ONLY` to `AUTHORITY_READY` for AGENTIC_SYSTEMS_OS.

## Read first

`README_FIRST.md` → `GOAL.md` → `STATE.md` → `SCORECARD_20D.md` → `EXECUTION_PLAN.md` → `GRAPH.md` → `docs/hardening/FULL_STACK_ADVERSARIAL_REVIEW.md` → `AGENTS.md`.

## Current execution point

The program has stopped feature expansion and is in **reconciliation**.

Key finding: #34 and #35 are divergent sibling W12.4 implementations from #33. W13 #36 was based on #35 only. Certification is paused until a canonical branch reconciles both.

Independent review:
- PR #38 — full-stack adversarial review
- Issue #39 — remediation/reconciliation gate

PR #37 was converted back to draft because its manual-only Actions strategy is correct in intent but removed too much verification breadth.

## Current scores

Build mean 7.6 / Assurance mean 2.6 / Authority mean 2.6.

Authority is defined as `min(Build, Assurance)` per vertical. See `SCORECARD_20D.md`.

## Exact next execution sequence

1. Inventory capabilities unique to #34.
2. Inventory capabilities unique to #35.
3. Build a capability reconciliation matrix.
4. Create canonical reconciliation branch from #33.
5. Port the strongest compatible primitive for each duplicated area.
6. Add deletion/API/compatibility ledgers before large replacements.
7. Fix P0s: mutable CAS, true bi-temporal history, durable side-effect protocol, complete authority lineage.
8. Fix P1s in graph/memory/runtime/security/replay/test governance.
9. Recreate W13 from the reconciled branch.
10. Restore full manual verification matrix with zero automatic spend.
11. Run security, contention, replay, restore, benchmark and cold-agent campaigns.
12. Re-score D01–D20 only from linked evidence.
13. Obtain independent review.
14. Merge with expected SHA and rollback checkpoint only if all authority gates are green.

## Todoist

Dedicated project: `COS GRAPH ENGINE · 10/10 AUTHORITY PROGRAM`.

It contains 10 phase sections and the complete live tasklist. It is a child of `Ecosistema rotprods Perfeccion`; do not modify tasks in other projects as part of COS maintenance.

## Cost policy

Recurring incremental infrastructure cost target: 0 EUR/month.
GitHub Actions: manual-only during convergence.
CD/release: OFF until a separate explicit release decision.

## Preservation rules

- Do not delete historical branches/PRs/docs until supersession is recorded.
- Do not weaken branch protection.
- Do not merge #34 or #35 independently as the canonical W12.4 candidate.
- Do not run W13 #36 as final qualification.
- Do not conflate test count with system assurance.
- Do not modify old tests solely to fit new semantics; preserve legacy coverage or document the break through ADR/migration tests.

## Synchronization rule

After every material checkpoint update:

1. GitHub executable/control docs;
2. Drive COS Acta + AGENTIC_SYSTEMS_OS STATE;
3. Todoist task status.

If one surface cannot be updated, record the desynchronization explicitly before handoff.