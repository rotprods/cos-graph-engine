# README_FIRST — COS Graph Engine

This is the mandatory cold-start entrypoint for humans and agents.

## Read order
1. `GOAL.md` — immutable North Star and authority gate.
2. `STATE.md` — compact current truth only.
3. `HANDOFF.md` — deterministic next action and active branch/PR stack.
4. `docs/hardening/GOAL_10_10.md` — evidence contract for the Convergence Era.
5. `docs/hardening/ENGINEERING_SCORECARD.md` — 20D score/evidence model.
6. `docs/hardening/GUARANTEE_CATALOG.md` — guarantees, not feature-count, are the unit of work.
7. `AGENTS.md` — historical execution ledger and additional agent instructions.

## Mandatory operating laws
Every task/change follows:
`/leydekidlin → /leydegilbert → /complexsystems → blast radius → smallest reversible action → evidence → persistence`.

## Current engineering mode
COS is in **Convergence & Hardening Era**. Do not add a new graph level merely to increase feature breadth. Raise guarantees of existing capabilities first.

## Cost policy
- Incremental recurring infrastructure cost: `EUR 0/month`.
- GitHub Actions: manual-only during convergence.
- CD: off during convergence unless explicitly authorized for a release/restore drill.
- Local/offline verification is preferred; the final qualification campaign will run consolidated CI/tests/replay/restore.

## Authority rule
COS may be used in shadow/read/projection mode. It must not become authoritative infrastructure for AGENTIC_SYSTEMS_OS until W13 qualification passes.

## Before mutation
- verify branch and base SHA;
- identify active stacked PR and dependency;
- state success/failure criteria;
- identify new failure modes/couplings introduced by the change;
- preserve backwards compatibility unless the relevant ADR explicitly authorizes a break.

## After mutation
Update the PR body/guarantee evidence and, for material state changes, `STATE.md` + `HANDOFF.md`. Never leave the only recovery point inside a chat/model context.
