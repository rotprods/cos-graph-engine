# Phase 01 — Lockfile / Toolchain Truth

Status: `BLOCKED_CLEAN_INSTALL`  
Branch: `hardening/canonical-authority-reconciliation`

## Observed facts

Current root `package.json`:

- version `2.1.0`;
- workspaces include `packages/hub`, `packages/visualization`, `packages/wasm`;
- authority scripts use `npx tsx` and `npx tsc`.

Current `package-lock.json`:

- root version remains `0.1.0`;
- root workspace list ends at `packages/graph`;
- therefore it does not represent the current workspace graph.

This is enough to classify the lock as stale. It must not be hand-edited to appear current.

## Required W13/Q0 action

From a clean environment with registry access:

```bash
rm -rf node_modules
npm install --package-lock-only
npm ci
```

Then inspect the generated diff before committing it. Required checks:

1. root version/workspaces match `package.json`;
2. workspace links exist for Hub, visualization and WASM;
3. all local package dependency versions resolve coherently;
4. the exact TypeScript and tsx executors used by authority scripts are reproducible rather than environment-dependent;
5. no unexpected dependency or lifecycle-script expansion occurs;
6. `npm ci` succeeds from an empty workspace after the new lock is committed.

## Toolchain pinning decision

`typescript` and `tsx` are not currently explicit root devDependencies even though repository scripts invoke them with `npx`.

Do **not** invent versions in Phase 01. W13/Q0 must inspect the clean resolved graph and then explicitly pin the versions used for qualification in `devDependencies` + lockfile.

## Failure condition

If a qualification run uses a tool version not represented in the committed dependency graph, the run is not reproducible evidence and cannot raise Assurance.
