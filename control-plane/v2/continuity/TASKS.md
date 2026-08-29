---
authority: PROJECTION
scope: current COS V2 execution frontier
owner: Technical Product Manager
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: stale root TASKS until regeneration
status: IMPLEMENTED_UNVERIFIED
---

# TASKS — COS V2 Authority Program

Machine-readable authority: `control-plane/v2/model/program.mjs`.

## Phase status

| Phase | State | Exit gate |
|---|---|---|
| P00 North Star / control plane | ACTIVE | CP4 architecture freeze and cross-plane sync |
| P01 canonical reconciliation | COMPLETE_STATIC_UNVERIFIED | lineage evidence during P07 |
| P02 contracts / compatibility | COMPLETE_STATIC_UNVERIFIED | selected-surface evidence during P07 |
| P03 core correctness | COMPLETE_STATIC_UNVERIFIED | CP6 executed invariants |
| P04 temporal / event / persistence | COMPLETE_STATIC_UNVERIFIED | CP7 replay/restore |
| P05 security / concurrency / agent runtime | ACTIVE_IMPLEMENTED_UNVERIFIED | CP9 + CP10 |
| P06 Hub / memory / GraphRAG / observability | PARTIAL_IMPLEMENTED_UNVERIFIED | CP11 |
| P07 test truth / manual CI | PROPOSED | complete full matrix |
| P08 evidence campaign | PROPOSED | CP12 |
| P09 qualification / merge | BLOCKED | CP13 + CP14 |

## Completed or implemented-unverified control-plane tasks

- [x] `T0001` reconstruct live truth projection.
- [x] `T0002` create unique session and bounded claim.
- [x] `T0003` segment operational event ledger.
- [x] `T0004` define V2 ontology and lexicon.
- [x] `T0005` materialize temporal hypergraph, gaps, decisions and checkpoints.
- [x] `T0006` implement validator/compiler and execute local self-test campaign.

`T0006` is not fully closed because its execution evidence is not yet bound to the exact current Git commit.

## Current executable frontier

### Lane A — control plane

- [ ] `T0006b` bind validation and generated fingerprints to exact PR #55 head.
- [ ] `T0007` regenerate root continuity documents from selected model.
- [ ] `T0008` synchronize GitHub, Drive and the dedicated COS Todoist project.
- [ ] append checkpoint/heartbeat event and renew or hand off claim.

### Lane B — runtime security, separate claim/branch required

- [ ] `T0501` canonicalize provider evidence and independently recompute its content hash.
- [ ] reject evidence swapped from another operation/provider/time.
- [ ] add permanent tamper/replay regression corpus.

### Lane C — after T0501 contract freeze

- [ ] `T0502` implement GitHub provider reconciliation adapter.
- [ ] `T0502` implement Drive provider reconciliation adapter.
- [ ] preserve `unknown` for ambiguous provider responses.

### Lane D — platform evidence

- [ ] `T0503` build controlled TLS/DNS fixture.
- [ ] `T0503` prove pinned address, SNI/Host and no second DNS.
- [ ] `T0503` implement and race-test native atomic filesystem broker.

## Mandatory downstream tasks

- [ ] `T0504` durable signal/telemetry repair.
- [ ] `T0505` contention, lease takeover, process kill and AgentRun recovery.
- [ ] `T0601` scoped GraphRAG/ContextPack qualification.
- [ ] `T0602` append-only bitemporal memory qualification.
- [ ] `T0603` gold-query set.
- [ ] `T0604` AuthorityTelemetry end-to-end.
- [ ] `T0701` clean toolchain/lockfile/SBOM.
- [ ] `T0702` manual-only full verification matrix.
- [ ] `T0703` legacy + authority + orphan + property + mutation suites.
- [ ] `T0801` security gauntlet.
- [ ] `T0802` replay/restore/failure/agent-death drills.
- [ ] `T0803` scientific performance campaign.
- [ ] `T0804` evidence-linked 20D scorecard.
- [ ] `T0901` independent exact-head review.
- [ ] `T0902` clean main-convergence PR with rollback checkpoint.
- [ ] `T0903` explicit owner authority promotion.

## Completion law

A checkbox means only the lifecycle state named beside it. A task is program-DONE only after implementation, applicable tests, security review, durable evidence, state/graph/docs sync, no P0/P1 regression and zero-context handoff.
