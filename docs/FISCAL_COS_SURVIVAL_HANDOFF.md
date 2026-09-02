# Fiscal COS — Survival Handoff

Checkpoint: 2026-09-02 07:26 Europe/Madrid

## Prime directive
This file exists so a fresh agent can recover the implementation without conversation history. Never claim `COS_20D_MOUNTED` until every gate below is evidenced by repository state and CI.

## Canonical repository
`rotprods/cos-graph-engine`

## Current integration gate
PR #76 — `fix/ci-working-directory-root` → `main`.

This branch currently carries the kernel/CI repair chain that must land before fiscal feature integration:
- workflows run from repository root (`WORKING_DIR: .`)
- orphan mode-160000 gitlink removed
- workspace dependency / package-lock mismatch repaired
- L8/L9 backward-compatibility and semantic traversal regression repaired
- CI/deploy/release runtime raised to Node 22.12.0
- WASM build is no longer silently ignored

## Latest observed CI state
Run 33527191492 reached real tests under Node 22.12.0.
Passing jobs observed: CSR, pruning, benchmark tests, observability, visualization, lint/typecheck, npm ci.
Two real kernel defects remain exposed:
1. WASM compile error in `packages/wasm/assembly/dijkstra.ts`: u32 vs i32 comparison around path reconstruction (`cur < parents.length`, `parents[cur] >= parents.length`).
2. L10 historical/current API mismatch: `scripts/test-levels-8-11.ts` constructs embedding nodes as `{source, embedding}` while `level10-embedding.ts` currently expects `{label, vector}`, causing `buildKNN()` to receive undefined vectors.

Do not merge #76 until these defects are fixed and a fresh CI run is green.

## Fiscal stacked PR chain
- #70 — fiscal source-of-truth / ingestion foundation
- #72 — fiscal schema/core slice
- #73 — L8/L9 fiscal knowledge projection + read-only GraphQL gateway
- #74 — authority-aware fiscal GraphRAG
- #75 — fiscal L13-L15 agent/tool/workflow + framework adapters
- #77 — operational/domain projections L4-L7, L10, L12, L16-L19

All remain subordinate to the kernel gate. Do not flatten or merge out of order merely to make progress look faster.

## Semantic safety rule
L18/L19 native biological/molecular semantics must not be falsified to claim 20D coverage. Fiscal projections use explicit domain semantic adapters where native semantics do not fit.

## Next executable sequence
1. Fix `dijkstra.ts` signed/unsigned compile errors without weakening WASM tests.
2. Restore L10 backward-compatible node/edge normalization while preserving current `label/vector` API.
3. Run fresh PR #76 CI; inspect every failing job, not just aggregate status.
4. Resolve any additional kernel regressions until all required jobs pass.
5. Merge #76 to `main` only when green.
6. Rebase/retarget fiscal stack onto repaired `main` in order #70 → #72 → #73 → #74 → #75 → #77.
7. Add fiscal suites to CI; no fiscal feature is considered integrated if its tests only exist as standalone scripts.
8. Add integrated 20D projector/status registry, persistence/replay equivalence, zero-context recovery benchmark, RBAC/security checks, adversarial gauntlet.
9. Only then allow `COS_20D_MOUNTED` state.

## Definition of mounted
`COS_20D_MOUNTED` requires all of:
- kernel CI green on supported Node runtime
- WASM build/test green
- fiscal suite green in CI
- all intended fiscal level projections reachable through one integrated runtime/projector
- persistence round-trip and deterministic replay tests
- zero-context agent recovery benchmark
- authority/provenance/temporal/sensitivity policy enforced
- human approval gates for write-side fiscal actions
- no personal evidence committed to the public repository
- durable handoff/status manifest updated with exact commit SHAs and remaining blockers

## Security boundary
Never commit credentials, tax IDs, private financial statements, wallet secrets, seed phrases, access tokens, or raw personal evidence to this public repository. Use synthetic fixtures and evidence IDs only.
