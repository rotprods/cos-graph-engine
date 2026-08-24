# HANDOFF — COS Graph Engine

## Recovery point

Project is in Convergence & Hardening Era. Read `README_FIRST.md`, `GOAL.md`, `STATE.md`, this file, `docs/hardening/W12_4_AUTHORITY_COMPLETION_PLAN.md` and `docs/hardening/20D_AUTHORITY_MATRIX.md` before mutation.

Current head: `hardening/w12-4-authority-completion`.
Parent: `hardening/w12-3-core-gap-closure` / PR #33.
Authority status: **SHADOW_ONLY / IMPLEMENTED_UNVERIFIED**.
Automatic CI/CD: **OFF**.

## What W12.4 contains

- deterministic authority GraphRAG projection and retrieval;
- Agentic registry-to-context bridge;
- version/hash-fenced ContextPacks;
- authority memory temporal/epistemic model plus Postgres adapter;
- Hub snapshot/query/recovery services;
- versioned serialized state machines;
- authority operation telemetry;
- semantic provider fixtures/contracts;
- manual-only W13 qualification workflow.

## Next exact actions

1. Verify/open the stacked W12.4 draft PR against `hardening/w12-3-core-gap-closure`.
2. Inspect every changed file for TypeScript/API/package-boundary defects; do not claim test success.
3. Keep package-lock drift explicit. The first W13 preflight generates `generated-package-lock.json` and fails; commit the reconciled lock before rerunning.
4. Manually dispatch W13 only when the owner chooses to spend one final CI run.
5. Triage every failure without `|| true`, `continue-on-error`, swallowed exceptions or reduced assertions.
6. Run qualification until clean, then execute 20D adversarial re-audit.
7. Only after `20/20 VERIFIED` collapse/merge the stacked chain and consider COS authoritative.

## W13 command sequence

```text
npm install --package-lock-only --ignore-scripts
lockfile diff must be clean
npm ci
npx tsc -p tsconfig.build.json --noEmit
npm run asbuild
npm run test:authority
npx tsx scripts/w13-provider-contract.ts
npm run test:all
scientific benchmark campaign
security/contention/replay/restore/fresh-agent drills
```

## Known residual risks

- legacy graph/retrieval APIs coexist with authority paths until cutover evidence;
- arbitrary external side effects inside legacy state callbacks are not transactionally reversible;
- process-local adapters are reference implementations, not crash-durable;
- DNS rebinding/egress requires deployment-layer controls beyond URL validation;
- Hub agent/workflow definitions are not yet importable from snapshots and restore fails closed when present;
- no current score is VERIFIED 10/10.

## Closure discipline

Any future run must update STATE, TASK/issue/PR status, evidence references and this HANDOFF. Hidden model/chat context is never required for recovery.
