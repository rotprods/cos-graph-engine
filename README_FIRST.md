# README FIRST — COS Graph Engine

Read this file before touching the repository.

## Mandatory cold-start order

1. `GOAL.md`
2. `STATE.md`
3. `SCORECARD_20D.md`
4. `EXECUTION_PLAN.md`
5. `GRAPH.md`
6. `HANDOFF.md`
7. `docs/hardening/FULL_STACK_ADVERSARIAL_REVIEW.md`
8. `AGENTS.md`

Then inspect GitHub PRs #34, #35, #36, #37, #38 and issue #39 before proposing or modifying code.

## Current project state

- status: `ACTIVE / STOP-THE-LINE RECONCILIATION`
- authority: `SHADOW_ONLY`
- North Star: D01–D20 Authority scores all at 10.0 with linked evidence
- current means: Build 7.6 / Assurance 2.6 / Authority 2.6
- active execution phase: Phase 01 — reconcile #34 + #35
- automatic CI/CD: OFF during convergence
- recurring incremental infra cost target: 0 EUR/month

## Most important current fact

PR #34 and PR #35 are divergent sibling W12.4 implementations from #33. W13 #36 was created only from #35 and therefore cannot certify the complete candidate. Reconcile first; certify second.

## Agent rules

- Never infer current state from old 'COMPLETE' claims in historical documents.
- Never merge a hardening stack because GitHub says it is mergeable.
- Never delete/rewrite >50 lines without a deletion ledger.
- Never modify tests only to make new code pass without preserving the previous behavioral contract or documenting an intentional break.
- Never treat Build score as Authority score.
- Never weaken branch protection to bypass review.
- Never use hidden model/chat memory as required project state.
- Apply `/leydekidlin`, `/leydegilbert`, and complex-systems failure analysis before material changes.

## Source-of-truth routing

- GitHub repository: executable truth and change history.
- `GOAL/STATE/SCORECARD/GRAPH/HANDOFF`: current project truth.
- Drive Acta/STATE: persistent cross-chat recovery memory.
- Todoist `COS GRAPH ENGINE · 10/10 AUTHORITY PROGRAM`: live execution queue only; unrelated Todoist projects are outside COS scope.

## Definition of a valid next action

A valid next action must either:

1. improve the canonical reconciliation candidate;
2. close a P0/P1 correctness, durability, security or governance defect;
3. add independent evidence for a D01–D20 gate; or
4. improve recoverability/governance without weakening existing behavior.

New product breadth is deferred until the authority substrate is reconciled and evidence-qualified.