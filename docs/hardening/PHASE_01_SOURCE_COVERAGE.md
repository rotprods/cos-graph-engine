# Phase 01 — #34 / #35 Source Coverage Matrix

Purpose: prove that every material source surface from the two divergent W12.4 branches is either **ADOPTED**, **REPLACED**, **DEFERRED**, or **HISTORICAL_ONLY**. Absence from PR #40 must never be interpreted as accidental loss.

Status: `STATIC_RECONCILIATION_COMPLETE / EXECUTION_UNVERIFIED`.

## PR #34 source disposition

| #34 path | Disposition in #40 | Canonical replacement / reason |
|---|---|---|
| `.github/workflows/w13-authority-qualification.yml` | DEFERRED | W13 must be recreated only after Phase 07 freezes exact candidate SHA |
| `HANDOFF.md` | REPLACED | current canonical root `HANDOFF.md` |
| `STATE.md` | REPLACED | current canonical root `STATE.md` |
| `docs/hardening/20D_AUTHORITY_MATRIX.md` | REPLACED | `SCORECARD_20D.md` Build/Assurance/Authority model |
| `W12_4_AUTHORITY_COMPLETION_PLAN.md` | HISTORICAL_ONLY | decisions absorbed into Phase 01 matrix/state/ledger |
| `W12_4_IMPLEMENTATION_REPORT.md` | HISTORICAL_ONLY | source evidence remains in PR #34; not copied as current truth |
| `package.json` | RECONCILED | #40 scripts/workspaces + authority contract commands |
| `packages/api/src/server.ts` | DEFERRED | server enforcement/wiring belongs Phase 05/06 after authority kernels stabilize; do not copy sibling wiring blindly |
| `packages/core/src/index.ts` | RECONCILED_IN_BASE | required core identity/integrity/temporal exports already exist in #40 lineage |
| `packages/core/src/memory-authority.ts` | REPLACED | append-only `AuthorityMemoryGateway` architecture |
| `packages/graph/src/authority-graphrag.ts` | REPLACED | `AuthorityGraphRAGIndex` |
| `packages/graph/src/context-pack.ts` | SHADOW_PRESERVED | `AuthorityContextPackCompiler` is authority candidate; legacy remains compatibility |
| `packages/graph/src/index.ts` | RECONCILED | explicit authority exports added |
| `packages/graph/src/versioned-state-machine.ts` | REPLACED | `AuthorityStateMachine` combines transactional staging + revision fencing |
| `packages/hub/fixtures/github-webhook-contracts.json` | ADOPTED | additive semantic fixture |
| `packages/hub/src/agentic-context.ts` | REPLACED | `AuthorityHubContextProjector` |
| `packages/hub/src/agentic-registry.ts` | SHADOW_PRESERVED | `AuthorityAgenticRegistry` is authority candidate |
| `packages/hub/src/hub.ts` | SHADOW_PRESERVED | `AuthorityHub` is outcome-sourced authority candidate |
| `packages/hub/src/index.ts` | RECONCILED | authority surfaces exported additively |
| `packages/hub/src/query.ts` | REPLACED | `AuthorityHubQueryService` requires explicit asOf/knownAt |
| `packages/hub/src/store.ts` | REPLACED | `authority-store.ts` sealed semantic snapshot/recovery |
| `packages/memory/src/authority-memory-store.ts` | REPLACED | append-only authority memory store + gateway/coordinator |
| `packages/memory/src/index.ts` | RECONCILED | authority memory surfaces exported |
| `packages/observability/src/authority.ts` | ADOPTED | AuthorityTelemetry selected |
| `packages/observability/src/index.ts` | RECONCILED | export retained |
| `scripts/w13-authority-contract.ts` | REPLACED/DEFERRED | richer additive authority contracts now exist; W13 orchestrator deferred |
| `scripts/w13-provider-contract.ts` | PARTIAL_ADOPT | webhook fixtures adopted; provider execution evidence belongs Phase 07/08 |
| `scripts/w13-state-partial-commit-contract.ts` | REPLACED | `test-authority-state-machine.ts` targets canonical state path |
| `tsconfig.authority.json` | REBUILT | strict candidate-specific authority compile graph |
| `tsconfig.build.json` | RECONCILED | Hub included in build graph |

## PR #35 source disposition

| #35 path | Disposition in #40 | Canonical replacement / reason |
|---|---|---|
| `HANDOFF.md` | REPLACED | canonical root handoff |
| `STATE.md` | REPLACED | canonical root state |
| `W12_4_AUTHORITY_CLOSURE_PLAN.md` | HISTORICAL_ONLY | source evidence stays in PR #35 |
| `package.json` | RECONCILED | authority scripts composed in #40 |
| `packages/execution/src/tool-runtime.ts` | ADOPTED | strict runtime selected |
| `packages/graph/src/authority-graphrag-v2.ts` | REPLACED | constraints absorbed into `AuthorityGraphRAGIndex` |
| `packages/graph/src/authority-graphrag.ts` | REPLACED | one GraphRAG authority candidate only |
| `packages/graph/src/context-pack.ts` | SHADOW_PRESERVED | authority compiler added separately |
| `packages/graph/src/index.ts` | RECONCILED | explicit authority exports |
| `packages/graph/src/level2-state.ts` | SHADOW_PRESERVED | authority state path moved to additive `authority-state-machine.ts`; no legacy test rewrite |
| `packages/hub/src/context-projector.ts` | REPLACED | `AuthorityHubContextProjector` |
| `packages/hub/src/index.ts` | RECONCILED | additive authority exports |
| `packages/hub/src/store.ts` | REPLACED | `AuthorityHubSnapshotManager` and authority stores |
| `packages/hub/src/strict-recovery.ts` | REPLACED | strict fail-closed recovery semantics absorbed into authority snapshot manager/runtime |
| `packages/hub/src/verified-context-projector.ts` | REPLACED | registry→authority GraphRAG→verified ContextPack path |
| `packages/memory/src/canonical-temporal-index.ts` | REPLACED | `AuthorityMemoryGateway` knownAt semantics + append-only store |
| `packages/memory/src/index.ts` | RECONCILED | authority gateway/coordinator/Postgres adapter exports |
| `packages/memory/src/temporal-memory.ts` | REPLACED | append-only revision model; current-row temporal index rejected |
| `packages/runtime/src/eventbus.ts` | ADOPTED | immutable delivery-failure observer stream |
| `tsconfig.authority.json` | REBUILT | current exact authority surface |
| `tsconfig.build.json` | RECONCILED | current build graph |

## Result

All changed source surfaces in #34 and #35 have an explicit disposition. There is no unclassified source file in the reconciliation inventory.

This proves **coverage of design intent**, not runtime correctness. `IMPLEMENTED_UNVERIFIED` remains the correct status.

## Deferred items that become downstream tasks

1. `packages/api/src/server.ts` authority wiring → Phase 05/06.
2. provider execution fixtures beyond static webhook semantics → Phase 07/08.
3. W13 workflow/scripts → Phase 07 after exact SHA freeze.
4. package-lock regeneration/toolchain pins → Phase 07 clean environment.

## Phase 01 freeze condition

Phase 01 may be frozen when this matrix, API behavior diff, authority surface manifest, deletion ledger/addendum, root exports and current `STATE/TASKS/HANDOFF` all reference the same branch head. Freeze means **architecture/reconciliation baseline only**; it does not mean merge-ready or 10/10.
