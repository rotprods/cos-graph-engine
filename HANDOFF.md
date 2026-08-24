# HANDOFF — COS Graph Engine

## Recovery point
Project is in Convergence & Hardening Era. Read `README_FIRST.md` before continuing.

Latest implemented layer in the stacked chain before this branch: W12.1 Memory Integrity (#31). This branch adds the cold-start/governance layer.

## Next exact actions
1. Create/finish W12.3 zero-cost infra/release posture.
2. Reconcile the existing `@cos/hub` work conceptually with W3/W4/W5/W7/W12 contracts; do not blindly merge historical PR #13.
3. Create `docs/hardening/20D_10_10_CONVERGENCE_MATRIX.md` mapping every audited dimension to code/PRs and unresolved gaps.
4. Complete remaining high-value code gaps, especially W2 CSR and W8/W9 runtime wiring.
5. Perform cross-stack compile/adversarial review.
6. Only at W13 run consolidated tests, manual CI, replay, restore, security and benchmark qualification.

## Branch discipline
PRs are intentionally stacked. Before editing, verify the parent branch/PR. Do not retarget or merge them independently until convergence ordering is reviewed.

## Safety/cost
Do not enable automatic GitHub Actions, release, Docker push or deployment while Convergence Era is active. Any required remote verification is explicit/manual.

## Definition of handoff completeness
A future agent must be able to identify the North Star, mode, PR stack, blocker/gaps and next exact action from repository files alone without relying on prior chat context.
