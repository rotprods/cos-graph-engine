---
authority: PROJECTION
scope: zero-context entrypoint for COS V2 work
owner: Documentation Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: stale root README_FIRST until root projection is regenerated
status: IMPLEMENTED_UNVERIFIED
---

# README FIRST — COS V2

## Current truth

```text
Repository: rotprods/cos-graph-engine
Main observed at V2 snapshot: 3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83
Clean runtime lineage: PR #49 → #50 → #51 → #52 → #53 → #54
Current control-plane PR: #55
Control-plane branch: refactor/v2-hypergraph-control-plane
Runtime authority: SHADOW_ONLY / IMPLEMENTED_UNVERIFIED
Automatic Actions: OFF
CD / deploy / release: OFF
```

Verify every SHA and PR state live before mutation.

## Read in order

1. `control-plane/v2/model/MODEL_MANIFEST.json`
2. latest `control-plane/v2/state/live-truth*.json`
3. `control-plane/v2/events/manifest.json`
4. latest `control-plane/v2/state/active-claims*.json`
5. `ARCHITECTURE.md`
6. `LEXICON.md`
7. `SECURITY.md`
8. `RECOVERY.md`
9. `TEST_STRATEGY.md`
10. `MIGRATION.md`
11. `control-plane/v2/model/gaps.json`
12. `control-plane/v2/model/decisions.json`
13. `control-plane/v2/model/program.mjs`
14. `control-plane/v2/model/checkpoints.json`
15. `control-plane/v2/NEXT_ITERATION_METAPROMPT.md`

## Mandatory barrier

Before writing:

```text
reconstruct live refs
inspect event watermark
inspect sessions/claims
calculate ContextPack staleness
create unique session and bounded claim
publish HELLO / WORK_STARTED
```

## Current safe frontier

```text
Lane A: T0006 → T0007 → T0008
  exact-SHA control-plane evidence
  root continuity regeneration
  GitHub/Drive/Todoist synchronization

Lane B: T0501 on a separate branch/claim from exact PR #54
  canonicalize provider evidence
  recompute hash
  bind operation/provider/time
  reject tamper/swap/replay
```

## Hard prohibitions

- no merge;
- no automatic Actions;
- no CD/deploy/release;
- no production/Supabase mutation;
- no Assurance or Authority promotion;
- no runtime edits on PR #55;
- no use of PR #46 as qualification source;
- no blind provider retry after execution begins.
