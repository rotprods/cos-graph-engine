# CGEV2 HANDOFF — T0502F Provider Truth Recovery

Status: `HANDOFF_READY / CLAIM_RELEASED / SHADOW_ONLY`

Recorded: `2026-09-10T13:47:00Z`

Handoff ID: `hof_c4f149c9-87d5-44cc-88b9-db5f028dace9`

## Authority snapshot

- project: `COS_GRAPH_ENGINE`
- repository: `rotprods/cos-graph-engine`
- PR: `#89`
- branch: `hardening/t0502f-provider-truth-recovery-milestone`
- verified checkpoint head before this handoff: `4ffe141e9a8f85a39e14218d405c6cc2184c0b4e`
- base PR: `#83`
- base SHA: `5e512f5016fb922bca304d772052d4abeb5579ca`
- previous session: `ses_0c612378-627c-4a83-8cfb-add377b3df33`
- previous claim: `claim_d3ce9138-4070-4f09-9981-5e5787ad6717`
- previous claim status: `RELEASED`
- checkpoint: `CP-T0502_PROVIDER_TRUTH_RECOVERY_PROTOCOL_VERIFIED`
- authority ceiling: `IMPLEMENTED_UNVERIFIED`

The previous session and claim MUST NOT be reused. A successor creates a fresh globally unique session, claim and correlation ID after re-reading live GitHub state.

## What is actually verified

The exact published bounded protocol model was executed with Node `v22.16.0` and produced:

- 19 targeted recovery assertions PASS;
- 2,747 reachable states explored at depth 11;
- 6,697 transitions explored;
- 0 model safety violations;
- 11/11 adversarial mutation families rejected.

The verified model protects these properties:

1. `unknown` cannot authorize retry or commit;
2. an applied provider effect cannot be repeated after response loss;
3. committed state requires applied provider truth plus applied evidence;
4. stale fencing cannot authorize a transition after takeover;
5. one absence observation is insufficient;
6. repeated absence must span the configured consistency window;
7. retry fencing is strictly monotonic;
8. provider idempotency key rotates on retry;
9. an active lease cannot be stolen implicitly;
10. partial application routes to compensation;
11. duplicate same-time absence cannot game the proof window.

Evidence:

- `control-plane/v2/runtime-qualification/t0502f/evidence.json`
- `control-plane/v2/runtime-qualification/t0502f/composition-map.json`
- `control-plane/v2/runtime-qualification/t0502f/checkpoint.json`

## What is NOT verified

Do not promote these claims:

- full T0502F TypeScript runtime integration in a clean monorepo checkout;
- live GitHub/Drive timeout-after-acceptance mutation behavior;
- real isolated PostgreSQL/Supabase transaction/restart semantics;
- OS multi-process process-kill/takeover/contention;
- full repository security/replay/restore qualification;
- production authority, deployment or main-branch convergence.

`main` remains outside this hardening lineage and product authority remains `SHADOW_ONLY`.

## Exact next resume point

Next checkpoint to pursue:

`CP-T0502-RUNTIME-INTEGRATION-EXECUTED`

Successor sequence:

1. VERIFY LIVE TRUTH before execution: `main`, PR #89, PR #83, issue #39, current PR #89 head, open overlapping PRs/claims.
2. Create a new session + claim. Never reuse the released T0502F claim.
3. Fork a bounded child lane from the immutable handoff checkpoint ref named in `resume.json`, unless live truth proves that a newer compatible checkpoint supersedes it.
4. Scope the claim to the integration contract, a dedicated T0502F strict typegraph if needed, and new evidence files only. Shared runtime owners are read-only unless a reproduced defect requires a new bounded repair lane.
5. Obtain a clean monorepo checkout locally. Do not trigger GitHub Actions merely to overcome local checkout failure.
6. Run clean dependency install according to the current reproducible toolchain contract.
7. Execute strict T0502F TypeScript closure. If no dedicated typegraph exists, add one rather than weakening `tsconfig` globally.
8. Execute `scripts/test-authority-provider-truth-recovery.ts`.
9. On failure: persist FAIL evidence, construct Bug → Root Cause → Broken Invariant → Failure Family → Permanent Regression, and repair only that bounded family.
10. On PASS: persist exact source SHA, blob hashes, toolchain, command logs and evidence hashes; release the claim; promote only the targeted integration checkpoint.

Acceptance for `CP-T0502-RUNTIME-INTEGRATION-EXECUTED`:

- clean checkout/install succeeds;
- strict T0502F closure PASS;
- `scripts/test-authority-provider-truth-recovery.ts` PASS;
- no `@ts-ignore`, `@ts-nocheck`, blanket `any`, failure suppression or package-root authority bypass introduced;
- evidence bound to exact implementation SHA;
- PR remains draft/unmerged;
- Actions/CD/deploy/production remain off;
- global D01–D20 scores remain unchanged until broader evidence gates justify promotion.

## After that checkpoint

Ordered frontier:

1. `T0502G` — authorized read-only GitHub/Drive provider qualification;
2. `T0502H` — isolated zero-cost PostgreSQL/Supabase transaction/restart qualification;
3. `T0502I` — OS multi-process timeout-after-acceptance + process-kill + fencing takeover campaign;
4. Phase 08 replay/restore/security/empirical qualification;
5. independent exact-head review;
6. clean main convergence only after every required authority gate passes.

## Safety / rollback

- Do not merge PR #89 as part of resume.
- Do not run provider mutations to prove reconciliation.
- Do not use automatic Actions/CD.
- Do not change production data.
- If live state conflicts with this packet, this packet becomes `STALE_CONTEXT`; live GitHub exact refs win.
- Rollback is to close the successor child without merge and retain PR #89 / checkpoint as historical evidence.

## Resume law

This handoff is acceleration, not authority.

`VERIFY LIVE TRUTH BEFORE EXECUTION.`
