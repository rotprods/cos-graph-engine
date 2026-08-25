# HANDOFF — COS Graph Engine

## Recovery point

COS is in Phase 01 of the evidence-backed 10/10 Authority Program.

Active branch:

`hardening/canonical-authority-reconciliation`

Active draft PR:

`#40 — hardening(reconciliation): unify W12.4 authority lineages from PRs #34 and #35`

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

### Governance and lineage

- canonical reconciliation branch created from #33;
- exact #34/#35 divergence measured;
- exclusive/overlap inventory recorded;
- canonical decisions C01–C13 defined;
- deletion ledger created;
- 20D scorecard, phase task graph and authority graph materialized;
- GitHub, Drive and Todoist synchronized;
- draft PR #40 opened against #33.

### Implemented reconciliation slices

- strict tool runtime from #35;
- AuthorityTelemetry from #34;
- immutable EventBus delivery-failure observation from #35;
- semantic GitHub provider fixtures from #34;
- `AuthorityStateMachine` with one serialized mutation boundary, staged callback commit, state/revision fencing, deterministic snapshot/restore and timer fencing;
- `AuthorityAgenticRegistry` with canonical identity, append-only system-time revisions, object/projection CAS, scope/sensitivity filtering and deterministic history hashes;
- `AuthorityGraphRAGIndex` with atomic complete-projection replacement, version/hash CAS, deterministic relation identity and valid-time/known-time filtering;
- `AuthorityContextPackCompiler` bound only to an authority retriever, with explicit timestamps, scope/permission invariants, projection version/hash fencing, deterministic evidence and SHA-256 integrity;
- additive authority contract scripts for state-machine, registry and ContextPack behavior.

All of the above is `IMPLEMENTED_UNVERIFIED`. No compile/test/replay/security evidence has run on this branch.

## Next exact implementation slice

### R5 — Hub convergence

1. import command + accepted/rejected outcome semantics from #34;
2. preserve #35 snapshot store, strict recovery and context projection strengths;
3. bind Hub context generation to `AuthorityGraphRAGIndex` + `AuthorityContextPackCompiler`;
4. replay recorded outcomes rather than re-deciding historical commands;
5. restore required repo/agent/workflow definitions or fail closed;
6. verify deterministic state/revision/hash at the contract level.

### R6 — Memory redesign

Then implement append-only epistemic/system-time memory revisions. Do not promote either previous current-row adapter as final authority storage.

### R7 — Surface closure

After memory convergence:

- mark legacy L11/ContextPack paths shadow/deprecated;
- reconcile package/API/export/tsconfig contracts;
- complete behavior diff and deletion ledger;
- prepare lockfile regeneration inputs;
- freeze candidate and recreate W13.

## Remaining Phase 01 sequence

```text
Hub command/outcome + query + snapshot/recovery/context convergence
→ append-only authority memory
→ legacy migration + package/API/export/tsconfig reconciliation
→ complete behavior diff + deletion ledger
→ freeze candidate
→ recreate W13 from PR #40 lineage
```

## Hard safety rules

- do not merge #34 or #35;
- do not delete either source branch;
- do not treat #36 as valid qualification lineage;
- do not merge #37 until full verification breadth is restored;
- do not rewrite legacy tests in place;
- do not call current-row temporal overwrite bi-temporal history;
- do not claim exact-once side effects from presence-only idempotency/fencing fields;
- do not expose more than one authority GraphRAG/state/registry/context writer;
- do not raise Assurance without executed evidence;
- do not enable automatic Actions or CD.

## Cross-plane checkpoint rule

At every material checkpoint:

```text
GitHub = executable/evidence truth
Drive = Acta + AGENTIC_SYSTEMS_OS STATE
Todoist = live task state
```

Any failed synchronization must be recorded here.

## Rollback

Restore branch ref to #33 SHA `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`. No production data or main-branch state has been changed by this reconciliation branch.