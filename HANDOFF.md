# HANDOFF — COS Graph Engine

## Recovery point
Project is in Convergence & Hardening Era. Read `README_FIRST.md`, `GOAL.md`, `STATE.md`, this file, `docs/hardening/W12_4_AUTHORITY_CLOSURE_PLAN.md`, and `docs/hardening/20D_AUTHORITY_MATRIX.md` before mutation.

Current convergence head: `hardening/w12-4-authority-closure`
Current draft PR: #35
Parent draft PR: #33
Authority state: SHADOW_ONLY
Verification state: W13 PENDING

## What exists in code
W2→W12.4 now contains real implementations for graph mutation invariants, deterministic identity, bi-temporal/provenance contracts, durable events, recovery, policy enforcement, autonomous execution, CAS/leases/idempotency, resilience, scientific benchmark contracts, scoped GraphRAG, memory integrity, cold-start governance, authority CSR, real capability routing, Postgres event/memory adapters, Agentic Hub, deterministic context projection, temporal memory envelopes, Hub snapshot recovery and transactional state transitions.

## Next exact actions
1. Inspect PR #35 statically for TypeScript/package-boundary mismatches.
2. Reconcile obvious compatibility defects before spending on CI.
3. Freeze W12.x; create `hardening/w13-authority-qualification` from PR #35 head.
4. Run one consolidated manual campaign:
   - clean install / lockfile;
   - typecheck/build;
   - canonical and orphan-suite tests;
   - property/negative/security tests;
   - concurrency/fencing/idempotency contention;
   - deterministic event/graph/context replay;
   - corrupted snapshot and empty-database restore;
   - scientific benchmarks and observability evidence;
   - cold-agent resume.
5. Triage and fix every real failure; never suppress required checks.
6. Re-run the 20D audit and attach evidence per dimension.
7. Only after all authority gates pass: consolidate/merge the stacked chain in dependency order and keep CD off until a separate release decision.

## Known intentional compatibility break to review
L2 `StateMachine.contextData` is now copy-safe instead of exposing mutable canonical state, and invalid empty definitions are currently rejected at construction. Historical tests used both behaviors. W13 must either update callers to explicit mutation APIs or add a clearly named compatibility builder without weakening the authority path.

## Branch discipline
PRs are intentionally stacked. Do not retarget or merge them independently until W13 determines the canonical consolidation order. Use expected head SHA for every merge.

## Safety/cost
Do not enable automatic GitHub Actions, release, Docker push or deployment. Remote verification is explicit/manual and consolidated.

## Definition of handoff completeness
A fresh agent must reconstruct the North Star, current branch/PR, implemented guarantees, unresolved verification gaps and next exact action from repository files alone, without relying on prior chat context.
