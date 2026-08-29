---
authority: PROJECTION
scope: COS V2 control-plane model and compiler only
owner: Test Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
status: EXECUTED_LOCAL_UNBOUND_EXACT_SHA
supersedes: null
---

# COS V2 Control-Plane Validation Checkpoint

## Proof boundary

This checkpoint proves only that the selected V2 machine-readable model can be loaded, validated and compiled by the zero-dependency local scripts in the downloaded branch workspace.

It does **not** prove that the Phase 05 runtime compiles, passes tests, survives concurrency, restores a database, enforces a physical TLS/filesystem boundary, or is ready to merge. It does not move Build, Assurance or Authority scores.

## Commands executed

```text
node scripts/validate-v2-control-plane-v2.mjs --self-test --write
node scripts/compile-v2-control-plane-v2.mjs
node scripts/validate-v2-control-plane-v2.mjs --self-test --write
```

## Result

```text
validation: PASS
compiler: PASS
validator self-tests: 5/5 PASS
runtime qualification: NOT_RUN
```

Validated model counts:

```text
nodes: 46
edges: 48
hyperedges: 6
tasks: 34
gaps: 20
decisions: 12
checkpoints: 15
events: 3
```

Self-test failures correctly detected:

1. duplicate node ID;
2. task dependency cycle;
3. stale ContextPack source revision;
4. overlapping active exclusive claim;
5. product authority escalation while critical gaps remain open.

## Binding limitation

The execution was performed against a locally downloaded snapshot of `refactor/v2-hypergraph-control-plane`. The report is therefore classified `EXECUTED_LOCAL_UNBOUND_EXACT_SHA` until the same commands are rerun from a clean checkout with `COS_GIT_SHA` bound to the exact immutable Git commit and the generated fingerprints are committed.

## Promotion effect

```text
Control-plane model confidence: increased
Runtime Build score: unchanged
Runtime Assurance score: unchanged
Runtime Authority score: unchanged
Product authority: SHADOW_ONLY
```

## Required successor evidence

- exact branch head SHA;
- committed validator report and compiler manifest;
- repeat run from a clean checkout;
- generated graph-view fingerprints;
- cold-agent recovery drill using only the durable control plane.
