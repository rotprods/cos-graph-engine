# Strict Typecheck Remediation

Checkpoint: 2026-09-02
Parent gate: PR #76 (`fix/ci-working-directory-root`)
Remediation PR: #79 (`fix/strict-typecheck-regressions`)

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
- knowledge graph initializes required `representations`
- trace-hop contract now includes timestamp
- memory query optional filters are narrowed before callbacks
- large-file exact codemod repaired:
  - research HTML client `${...}` interpolation escaping
  - research reasoning output unknown narrowing
  - advanced reasoning nullable metadata
  - OTLP exporter stale `node:http.fetch` destructure

Latest codemod commit before this checkpoint: `be295d3b5412e174bef8dd254afe7bbace19da4c`.

## Gate rules
- no `@ts-ignore`
- no `@ts-nocheck`
- no blanket `any` escape to make the compiler quiet
- no restoring `|| echo` around typecheck
- temporary remediation workflow must be deleted before merge
- parent PR #76 remains blocked until this branch is green and merged into it

## Next loop
Run `npm ci`, `npm run asbuild`, `tsc --noEmit`; group remaining errors by root cause; fix highest-leverage correctness/security groups first; repeat until zero errors.
