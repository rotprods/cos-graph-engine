# HANDOFF — COS Graph Engine

## Recovery point

COS is in Phase 01 of the evidence-backed 10/10 Authority Program.

Active branch:

`hardening/canonical-authority-reconciliation`

Base:

`hardening/w12-3-core-gap-closure` @ `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`

Source siblings:

- #34 @ `af4973561b5f7d7a7415fa8f88a12a7d8d678a66`;
- #35 @ `8b7e197f35e6fc114cd90ec0907db4c2f5b625f4`.

Authority remains `SHADOW_ONLY`. No merge or W13 run is authorized.

## Read first

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `TASKS.md`
6. `GRAPH.md`
7. `docs/hardening/PHASE_01_RECONCILIATION_34_35.md`
8. `docs/hardening/DELETION_LEDGER.md`
9. `docs/hardening/FULL_STACK_ADVERSARIAL_REVIEW.md` in PR #38
10. `AGENTS.md`

## Work completed at this checkpoint

- canonical reconciliation branch created from #33;
- exact #34/#35 divergence measured;
- exclusive/overlap inventory recorded;
- canonical decisions C01–C13 defined;
- deletion ledger created;
- 20D scorecard, phase task graph and authority graph materialized;
- GitHub, Drive and Todoist synchronized.

## Next exact implementation slice

Port only low-conflict selected primitives, one source-provenance commit per capability:

1. `packages/execution/src/tool-runtime.ts` from #35, followed by static contract review;
2. `packages/observability/src/authority.ts` from #34 plus export wiring;
3. EventBus immutable delivery-failure observation from #35, reconciled with #33 event-log behavior;
4. `packages/hub/fixtures/github-webhook-contracts.json` from #34 as additive evidence.

After the slice:

- update deletion ledger if any file replacement exceeds 50 lines;
- open a draft reconciliation PR against `hardening/w12-3-core-gap-closure`;
- update issue #39 and Todoist;
- do not start GraphRAG/state/memory convergence until low-conflict exports are statically coherent.

## Subsequent sequence

```text
low-conflict primitives
→ transactional state + revision fence
→ versioned AgenticResourceRegistry
→ one atomic GraphRAG authority path
→ Hub command/outcome + snapshot/recovery convergence
→ append-only memory redesign
→ package/API/export reconciliation
→ recreate W13
→ full evidence campaign
```

## Hard safety rules

- do not merge #34 or #35;
- do not delete either source branch;
- do not treat #36 as valid qualification lineage;
- do not merge #37 until full verification breadth is restored;
- do not rewrite legacy tests in place;
- do not call current-row temporal overwrite bi-temporal history;
- do not claim exact-once side effects from presence-only idempotency/fencing fields;
- do not raise Assurance without executed evidence;
- do not enable automatic Actions or CD.

## Rollback

Restore branch ref to #33 SHA `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`. No production data or main-branch state has been changed by this reconciliation branch.
