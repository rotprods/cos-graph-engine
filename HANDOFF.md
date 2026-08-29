# HANDOFF — COS Graph Engine

## Recovery point

Phase 05 has been extracted from the 26k-line exploratory PR into a clean stacked review chain. COS remains:

`SHADOW_ONLY / IMPLEMENTED_UNVERIFIED`

No merge, automatic Action, deployment, release, production database or Supabase mutation has occurred.

## Canonical source and contract stack

```text
Phase04 exact base
  2e15b88388836b94b97a93753cb4db347e275e7e
        ↓
PR #49 / Phase05A
  3e79488a3ca5013812ab3f64d18b2a55b8050333
        ↓
PR #50 / Phase05B
  45a565ac945363ab45f0f6b1ddb6a2795843084d
        ↓
PR #51 / Phase05C
  a4122eb80ad319a0cbf6497b2cc618c2f99d27a9
        ↓
PR #52 / Phase05D clean contracts
  008734a20afb78bebddf8420b2ac8e74a861216a
  + later control-plane sync commit
```

PR #46 @ `ea5023caab7741aa72d7b9cfdfbcdab28e47f6fe` is an archive/provenance source only. Do not base qualification or new implementation work on it.

## Read first

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `TASKS.md`
6. `GRAPH.md`
7. `docs/hardening/PHASE_05_CLEANROOM_PORT.md`
8. `docs/hardening/PHASE_05_CLEANROOM_MANIFEST.json`
9. `docs/hardening/PHASE_05_CLEAN_CONTRACTS.md`
10. `docs/hardening/PHASE_05_CLEAN_CONTRACTS_MANIFEST.json`
11. `docs/hardening/adrs/ADR-009-AUTHORITY-ISOLATION-BOUNDARIES.md`
12. `AGENTS.md`

## Selected source owner

`packages/execution/src/authority-phase05-clean.ts`

It is deliberately not exported from `packages/execution/src/index.ts`.

The clean branch contains one selected generation of each Phase 05 capability and excludes all known V1/V2 duplicate implementations from PR #46.

## Current contracts

`tsconfig.phase05.clean.json` starts from the clean barrel and therefore typechecks the complete selected source closure.

PR #52 currently carries only tests with dependency-pure imports:

- lease and Postgres lease;
- execution runtime;
- policy and policy-bound runtime;
- agent-run;
- isolation decisions;
- capability evidence V2;
- repair ledger.

No command has run.

## Next exact slice — Phase 05E

Create one child branch from the current PR #52 head and add normalized adapter contracts only.

Required work:

1. replace old barrel imports with direct selected imports or `authority-phase05-clean`;
2. add agent-run Postgres contract and fixture;
3. add capability runtime end-to-end contract;
4. add provider reconciliation and lease retry contracts;
5. add JSON status/idempotency inspector contract;
6. add FileHandle V2 contract;
7. add capability signal store V2 and Postgres contracts;
8. add repair Postgres and capability repair contracts;
9. write new side-effect runtime/Postgres tests that use `AuthorityLeaseService` rather than the excluded `InMemoryAuthorityFencingValidator`;
10. extend the one clean tsconfig and evidence manifest.

## Hard rules

- never copy an archive test blindly when its imports point at excluded code;
- no V1/V2 coexistence in the clean lineage;
- no package-root export during Phase 05;
- no exactly-once provider claim;
- no blind retry after execution begins;
- no HTTP hostname re-resolution after pinning;
- no filesystem path reopen after broker authorization;
- no automatic Actions/CD;
- no Assurance movement before execution;
- do not merge stacked PRs until the clean chain is compiled, tested and independently reviewed.

## Verification commands prepared, not run

```text
npx tsc -p tsconfig.phase05.clean.json --noEmit
npx tsx scripts/test-authority-lease.ts
npx tsx scripts/test-authority-lease-postgres.ts
npx tsx scripts/test-authority-execution-runtime.ts
npx tsx scripts/test-authority-policy.ts
npx tsx scripts/test-authority-policy-bound-runtime.ts
npx tsx scripts/test-authority-agent-run.ts
npx tsx scripts/test-authority-isolation.ts
npx tsx scripts/test-authority-capability-evidence-v2.ts
npx tsx scripts/test-authority-repair-ledger.ts
```

## Rollback

- clean source rollback: `a4122eb80ad319a0cbf6497b2cc618c2f99d27a9`;
- Phase 05B: `45a565ac945363ab45f0f6b1ddb6a2795843084d`;
- Phase 05A: `3e79488a3ca5013812ab3f64d18b2a55b8050333`;
- Phase 04 base: `2e15b88388836b94b97a93753cb4db347e275e7e`;
- archive source: PR #46, never merge as qualification candidate.