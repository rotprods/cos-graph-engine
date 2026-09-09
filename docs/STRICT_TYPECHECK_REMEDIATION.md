# Strict Typecheck Remediation

Checkpoint: 2026-09-02 ~08:15 Europe/Madrid
Parent gate: PR #76 (`fix/ci-working-directory-root`)
Remediation PR: #79 (`fix/strict-typecheck-regressions`)
Current validated branch head before this checkpoint: `57d139c051618a3188febc3a73fd49a0c2d853db`.

## Why this branch exists
PR #76 converted the former swallowed typecheck into a fail-closed gate. That exposed real pre-existing cross-package API/type drift. This branch repairs those defects without weakening CI.

## Repairs already durable
- workspace typecheck includes DOM/WebAssembly platform libs
- canonical core barrel no longer emits ambiguous duplicate exports
- L10 legacy/current embedding normalization is type-safe
- L17 generated `createdAt` input contract fixed
- self-improvement imports reasoning engine type from canonical core
- configuration priority contract unified
- EventBus preserves optional trace IDs and generates distinct branded subscription IDs
- CodeSandbox applies timeout at `runInContext`, disables string/WASM code generation and bounds output
- ToolRegistry was restored after a detected accidental truncation; the incident was not hidden
- knowledge graph initializes required `representations`
- trace-hop contract now includes timestamp
- memory query optional filters are narrowed before callbacks
- L7/L12 SMB graph identities are branded at persistence boundaries
- large-file exact codemod repaired research HTML interpolation, unknown reasoning output, nullable reasoning metadata and stale OTLP exporter code

## WASM ABI hardening — VALIDATED
The historical WASM suite covered only BFS/PageRank/Shortest/Betweenness. DFS, connected-components, topo/cycle and Dijkstra were exported through incompatible managed-array signatures while the JS loader passed raw memory pointers.

The branch now uses explicit linear-memory ABI for:
- DFS + dfsHasPath
- connectedComponents
- topologicalSort + hasCycle
- Dijkstra

The loader call signatures were aligned and an extended integration suite was added at `scripts/test-wasm-extended.ts`.

Validation run `33597826019` completed successfully:
- existing WASM suite: PASS
- extended WASM↔JS parity suite: PASS
- one-shot loader codemod workflows self-deleted after committing

The resulting loader/validation commit is `57d139c051618a3188febc3a73fd49a0c2d853db`.

## Dependency security diagnostic
Read-only `npm audit` identified exactly two HIGH transitive findings, zero critical:
- `brace-expansion` — DoS advisories; fix available
- `js-yaml@3.x` — quadratic CPU in `!!omap`; fix available

No blind `npm audit fix` has been applied. Required next step is dependency-path attribution (`npm explain`) followed by the narrowest safe remediation and a zero-high recheck.

## Gate rules
- no `@ts-ignore`
- no `@ts-nocheck`
- no blanket `any` escape to make the compiler quiet
- no restoring `|| echo` around typecheck
- no blind dependency mutation
- temporary remediation/security workflows must be deleted before merge
- parent PR #76 remains blocked until this branch is green and merged into it

## Next loop
1. Attribute the two HIGH dependency paths and remediate narrowly.
2. Run `npm ci`, `npm run asbuild`, `tsc --noEmit`; regroup remaining errors by root cause.
3. Fix persistence/pipeline/core contracts before legacy CLI/visualizer debt.
4. Keep repeating until strict typecheck is zero-error.
5. Delete branch-only diagnostic workflows, run full parent CI, then merge #79 → #76 only if green.
