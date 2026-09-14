# Fiscal COS — Survival Handoff

Checkpoint: 2026-09-02 07:40 Europe/Madrid

## Prime directive
This file exists so a fresh agent can recover the implementation without conversation history. Never claim `COS_20D_MOUNTED` until every gate below is evidenced by repository state and CI.

## Canonical repository
`rotprods/cos-graph-engine`

## Current integration gate
PR #76 — `fix/ci-working-directory-root` → `main`.

The branch is the kernel/CI repair gate that must land before fiscal feature integration. It now contains:
- workflows rooted correctly at repository root (`WORKING_DIR: .`)
- orphan mode-160000 gitlink removed
- workspace dependency / package-lock mismatch repaired
- L8/L9 backward compatibility and taxonomy traversal repaired
- L10 legacy/current embedding API normalization
- L11 minimal/canonical chunk normalization
- CI/deploy/release runtime on Node 22.12.0
- WASM build enforced rather than silently skipped
- Dijkstra WASM u32/i32 path reconstruction repaired
- Docker uses frozen `npm ci` and requires WASM build
- fail-closed aggregate CI: typecheck/coverage/core/WASM/benchmarks must succeed before final green state
- invalid root TypeScript project references removed in favor of a real workspace typecheck config
- direct pinned toolchain: TypeScript 5.9.3 and tsx 4.23.13
- package lock regenerated and frozen install verified by one-shot GitHub Actions workflow; the workflow self-deleted after success

Latest branch head before this checkpoint: `bad2a13115bfea843ebc7f21ac870403938d18fa` (toolchain lock refresh). This documentation commit intentionally advances the head and triggers a clean PR CI run against the final lock.

## Validation already obtained
The following failures were reproduced first, fixed, and then observed passing in subsequent CI runs:
- root lock resolution / `npm ci`
- WASM compilation and WASM test suite
- L8 Knowledge Graph regression
- L9 Semantic Graph regression
- L10 Embedding Graph historical/current API mismatch
- L11 GraphRAG historical minimal chunk mismatch
- COS Core suite after L8-L11 repairs
- CSR, pruning, benchmark, observability and visualization jobs

The previous typecheck failure was configuration/toolchain-specific, not a discovered application type error: invalid root project references were removed and TypeScript is now pinned to 5.9.3. The next clean run must prove the strict workspace typecheck.

## Fiscal stacked PR chain
- #70 — fiscal-financial COS 20D profile contract and invariants
- #72 — fiscal recovery event runtime + L1-L3 projector
- #73 — L8/L9 fiscal knowledge projection + read-only GraphQL gateway
- #74 — authority-aware fiscal GraphRAG
- #75 — fiscal L13-L15 agent/tool/workflow + framework adapters
- #77 — operational/domain projections L4-L7, L10, L12, L16-L19

All remain subordinate to the kernel gate. Do not flatten or merge out of order merely to make progress appear faster.

## Semantic safety rule
L18/L19 native biological/molecular semantics must not be falsified to claim 20D coverage. Fiscal projections use explicit domain semantic adapters where native semantics do not fit.

## Next executable sequence
1. Observe the clean PR #76 CI run produced by this checkpoint. Inspect every failed job individually.
2. Resolve any remaining kernel/type/build/security defect without weakening or bypassing the failing gate.
3. Review the two high-severity findings currently reported by `npm ci` using `npm audit`; do not run a blind audit fix.
4. Merge #76 to `main` only after the required CI chain is green.
5. Reconcile the fiscal stack onto repaired `main` in order #70 → #72 → #73 → #74 → #75 → #77. #72 was created independently from #70, so reconcile exports/commits deliberately rather than pretending it is already stacked.
6. Add all fiscal suites to CI; a fiscal feature is not integrated if its test only exists as a standalone script.
7. Add one integrated 20D projector/status registry.
8. Add persistence round-trip and deterministic replay equivalence.
9. Add zero-context recovery benchmark from durable artifacts only.
10. Add RBAC/security/write-side human approval gauntlet and adversarial acceptance suite.
11. Only then allow `COS_20D_MOUNTED`.

## Definition of mounted
`COS_20D_MOUNTED` requires all of:
- kernel CI green on supported/pinned toolchain
- strict TypeScript workspace gate green
- WASM build/test green
- dependency security findings reviewed and dispositioned
- fiscal suite green inside CI
- all intended fiscal level projections reachable through one integrated runtime/projector
- persistence round-trip and deterministic replay tests
- zero-context agent recovery benchmark
- authority/provenance/temporal/sensitivity policy enforced
- human approval gates for write-side fiscal actions
- no personal evidence committed to the public repository
- durable handoff/status manifest updated with exact commit SHAs, CI run IDs and remaining blockers

## Security boundary
Never commit credentials, tax IDs, private financial statements, wallet secrets, seed phrases, access tokens, or raw personal evidence to this public repository. Use synthetic fixtures and evidence IDs only.
