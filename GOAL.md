# COS Graph Engine — GOAL

## North Star

Bring COS Graph Engine to a **demonstrable 10.0/10 engineering standard across all 20 audited dimensions** and make it safe to serve as the compute/projection/reasoning substrate for AGENTIC_SYSTEMS_OS.

The objective is not maximum feature count. The objective is **maximum trustworthy capability per operation**.

COS may only move from `SHADOW_ONLY` to `AUTHORITY_READY` when all critical guarantees are supported by linked machine evidence and an independent review.

## Three-score model

Every dimension is tracked with three values:

- **Build** — how complete and well-designed the implementation appears from code/review.
- **Assurance** — how strongly it has been demonstrated by compile, tests, security, contention, replay, restore, benchmarks and operational drills.
- **Authority** — `min(Build, Assurance)`. This is the only score allowed to determine promotion.

A large implementation with weak evidence therefore remains low-authority by design.

## Current program baseline

- Build mean: **7.6/10**
- Assurance mean: **2.6/10**
- Authority mean: **2.6/10**
- Status: **SHADOW_ONLY**
- Current control state: **STOP-THE-LINE reconciliation before certification**

See `SCORECARD_20D.md` for the vertical-by-vertical baseline and target gates.

## Hard constraints

1. Recurring incremental infrastructure cost remains **0 EUR/month** unless explicitly changed by the owner.
2. GitHub Actions remain manual/owner-controlled during convergence; no automatic deploy or release.
3. No secret material in repo, Drive, prompts or issue bodies.
4. No hardening PR is merged merely because it is large, mergeable, or test-rich.
5. No 10/10 score without evidence.
6. No destructive rewrite without a deletion ledger, compatibility statement and rollback path.
7. No hidden model/chat memory is required for cold start.
8. Historical evidence is superseded/retracted, not silently erased.
9. `/leydekidlin`, `/leydegilbert`, and `how.complexsystems.fail` resilience doctrine apply to every material change.

## Definition of Done

The North Star is achieved only when:

- D01–D20 Authority scores are all **10.0**;
- no unresolved P0/P1 findings remain;
- the canonical candidate has one unambiguous authority path per capability;
- clean install and dependency graph are reproducible;
- legacy + authority typechecks pass;
- canonical, orphan, negative, property, mutation and integration suites pass;
- security review has no unresolved reportable finding;
- multi-writer contention, fencing, idempotency and crash-window tests pass;
- deterministic event/graph/context replay produces equivalent hashes;
- corrupted-snapshot and empty-database restore drills pass;
- scientific benchmarks satisfy declared SLOs without false-positive methodology;
- a blind cold agent reconstructs mission/state/blockers/next action from persisted artifacts only;
- one independent write-enabled reviewer approves the final candidate;
- merge occurs with expected SHA and a verified rollback checkpoint;
- `STATE.md`, `HANDOFF.md`, Drive Acta and Todoist are synchronized.

Until then, implementation may be strong, but authority remains blocked.