---
authority: PROJECTION
scope: successor acceleration packet for COS V2
owner: Agentic Systems Architect
last_updated: 2026-08-30T17:30:00.000Z
source_revision: 1bc137eb6e635f55db293b402f561e420dc83c4f
supersedes: null
status: IMPLEMENTED_UNVERIFIED
---

# NEXT_ITERATION_METAPROMPT — COS V2

> **VERIFY LIVE TRUTH BEFORE EXECUTION.** This packet accelerates recovery; it is not authority.

## Role

Operate as Principal Systems Architect, Graph Systems Architect, Distributed Systems Architect, Security Architect, Event-Sourcing Architect, Memory/Knowledge Engineer, Test Architect, Recovery Engineer, Migration Architect and Documentation Architect.

Do not produce another plan unless a missing executable contract genuinely requires one. Advance the exact safe frontier, persist every material discovery and keep authority claims below available evidence.

## Project identity

```text
project_id: COS_GRAPH_ENGINE
repository: rotprods/cos-graph-engine
north_star: D01–D20 each at Authority 10.0
score_law: Authority = min(Build, Assurance)
cost_constraint: EUR 0 recurring incremental cost
automatic_actions: OFF
cd_deploy_release: OFF
production_db_mutation: NONE
```

## Mandatory reconstruction

Before mutation, determine from live GitHub and durable project state:

```text
main_sha
PR #49–#55 state, base and head SHAs
issue #39 state
current V2 model manifest
latest event watermark
latest live-truth and active-claims revision
current session and claim
ContextPack revision
proof boundary
active blockers and overlapping scopes
```

Never trust the SHAs in this packet without checking them.

## Durable read order

1. `README_FIRST.md`
2. `control-plane/v2/model/MODEL_MANIFEST.json`
3. `control-plane/v2/state/live-truth.r2.json` or latest revision
4. `control-plane/v2/events/manifest.json`
5. latest `control-plane/v2/state/active-claims*.json`
6. `STATE.md`
7. `HANDOFF.md`
8. `TASKS.md`
9. `ARCHITECTURE.md`
10. `LEXICON.md`
11. `SECURITY.md`
12. `RECOVERY.md`
13. `TEST_STRATEGY.md`
14. `MIGRATION.md`
15. `control-plane/v2/model/gaps.json`
16. `control-plane/v2/model/decisions.json`
17. `control-plane/v2/model/program.mjs`
18. `control-plane/v2/model/checkpoints.json`
19. `control-plane/v2/model/history.json`
20. `control-plane/v2/model/bug-escape-graph.json`

## Known lineage at packet generation

```text
main: 3ae197ebe6024b68ea2cc33a4c54c76fbc8d1e83
PR #49: 3e79488a3ca5013812ab3f64d18b2a55b8050333
PR #50: 45a565ac945363ab45f0f6b1ddb6a2795843084d
PR #51: a4122eb80ad319a0cbf6497b2cc618c2f99d27a9
PR #52: 22191dd12080bec79ae86817cf38c610b11a8f1b
PR #53: 50e809fee99f50a34f0e82b92af02e0ea11552ac
PR #54: 789edef87549d4f173de03f73e54f5b6193c2e98
PR #55 branch: refactor/v2-hypergraph-control-plane
PR #46: archive/provenance only
PR #36: invalid old W13 lineage
PR #37: manual CI draft requiring breadth restoration
issue #39: stop-the-line governance
```

## Current V2 control-plane state

A machine-readable V2 model exists with:

```text
46 nodes
48 edges
6 hyperedges
20 ranked gaps
12 decisions
34 tasks
15 checkpoints
3 operational events at the r2 snapshot
```

Canonical selected sources are declared in:

`control-plane/v2/model/MODEL_MANIFEST.json`

Do not use the superseded malformed `control-plane/v2/model/program.json` or the first-generation validator/compiler scripts.

Canonical scripts:

```text
node scripts/validate-v2-control-plane-v2.mjs --self-test --write
node scripts/compile-v2-control-plane-v2.mjs
```

The scripts passed locally once, but the evidence remains `EXECUTED_LOCAL_UNBOUND_EXACT_SHA` until rerun and committed against an exact current head.

## Current authority ceiling

```text
architecture/model: IMPLEMENTED and locally validated
runtime: IMPLEMENTED_UNVERIFIED
assurance: unchanged
product authority: SHADOW_ONLY
merge authorization: DENIED
```

Never say V2_FINAL, VERIFIED, EMPIRICALLY_QUALIFIED or AUTHORITY_READY without the required checkpoint evidence.

## Highest-priority gaps

```text
G001 no clean Phase 05 install/typecheck/test
G003 stale root continuity documents
G005 provider evidence hash not independently recomputed
G006 native atomic filesystem broker missing
G007 controlled TLS pinning proof absent
G008 provider-specific reconciliation adapters incomplete
G011 manual CI may lose verification breadth
G012 old W13 lineage invalid
G015 no independent exact-head review
G016 no five-minute cold-agent proof
G018 no enforced single authority writer after root promotion
G020 model/document drift risk
```

## Exact safe frontier

### Lane A — Control plane

```text
T0006 bind validator/compiler evidence to exact head
→ T0007 regenerate root continuity surfaces
→ T0008 synchronize GitHub / Drive / Todoist
```

Scope:

```text
control-plane/v2/**
README_FIRST.md
STATE.md
TASKS.md
HANDOFF.md
GRAPH.md
AGENTS.md canonical current-status section
```

### Lane B — Provider evidence integrity

Create a new unique session, claim and branch from the exact current PR #54 head before editing runtime.

```text
T0501 canonicalize provider evidence
→ recompute evidence hash
→ bind provider/resource/operation/observation time
→ reject tamper, swap and replay
```

Exclusive scope:

`packages/execution/src/authority-observed-outcome-recorder.ts` plus additive tests only.

Do not edit this runtime path on the control-plane branch.

## Execution law

For each task:

```text
verify live truth
→ create/renew unique session and claim
→ state falsifiable guarantee
→ inspect upstream/downstream/lateral/security/recovery impact
→ implement smallest reversible slice
→ execute available checks
→ adversarially attack it
→ generalize any failure family
→ add permanent regression
→ persist evidence, event, state, graph and handoff
```

Maximum repeated identical failed strategy attempts: 3. Then change strategy or record `STUCK_LOOP`.

## Hard prohibitions

- Do not merge any hardening PR.
- Do not enable automatic Actions or CD.
- Do not mutate production/Supabase state.
- Do not treat PR #46 as a qualification source.
- Do not recreate W13 from an unfrozen or incomplete lineage.
- Do not call current-row overwrite bi-temporal history.
- Do not claim exactly-once provider effects.
- Do not blind-retry after execution begins.
- Do not reopen filesystem paths after authority authorization.
- Do not perform a second DNS resolution after pinning.
- Do not allow telemetry/evidence failures to replace protected outcomes.
- Do not raise Assurance based on code volume or written tests.
- Do not modify unrelated Todoist projects.

## Required checkpoint output

Before ending a material session, persist:

```text
session / claim state
event ledger append
exact refs and proof boundary
implementation and test result
new risks/unknowns/decisions
current executable frontier
STATE / TASKS / HANDOFF / graph delta
Drive Acta and AGENTIC state delta
Todoist task state
```

A no-change session still appends a heartbeat or explicit blocked event.
