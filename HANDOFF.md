# HANDOFF — COS Graph Engine

## Recovery point
W2→W12.4 architecture/code hardening is **FROZEN**. Read `README_FIRST.md`, `GOAL.md`, `STATE.md`, this file, `docs/hardening/W12_4_AUTHORITY_CLOSURE_PLAN.md`, and `docs/hardening/20D_AUTHORITY_MATRIX.md` before mutation.

Frozen implementation branch: `hardening/w12-4-authority-closure`
Draft PR: #35
Authority state: SHADOW_ONLY
Next phase: W13 AUTHORITY QUALIFICATION
Automatic CI/CD: OFF

## What exists in code
Graph mutation invariants, deterministic identity, bi-temporal/provenance contracts, durable events, recovery, policy enforcement, autonomous execution, CAS/leases/idempotency, resilience, scientific benchmark contracts, scoped GraphRAG, memory integrity, cold-start governance, authority CSR, real capability routing, Postgres event/memory adapters, Agentic Hub, deterministic/verified context projection, temporal-memory envelopes, strict Hub recovery and serialized state transitions.

Latest preflight additions:
- `VerifiedAuthorityGraphRAGEngine` — derived sensitivity before relation identity + mandatory source recordedAt;
- `VerifiedAgenticContextProjector` — authority-only project→context path;
- `CanonicalTemporalMemoryIndex` — ISO/SQL-null normalization before persistence hashing;
- `StrictHubRecoveryCoordinator` — unresolved definitions fail closed by default;
- root build graph now includes `@cos/hub`;
- `tsconfig.authority.json` provides a strict authority-surface typecheck.

## W13 exact mission
W13 may fix evidence-backed defects only. It may not add new graph levels, product breadth, speculative frameworks or paid infrastructure.

Run, in order:
1. clean checkout / dependency install / lockfile reconciliation;
2. legacy build typecheck + strict authority typecheck;
3. build all affected workspaces;
4. canonical suites + orphan-test inventory;
5. reconcile intentional L2 compatibility changes without restoring mutable canonical state;
6. negative/property/security tests;
7. concurrency/fencing/idempotency contention;
8. event/graph/context deterministic replay;
9. Postgres adapter contract fixtures;
10. corrupted snapshot + empty-database restore;
11. scientific benchmarks with seeded fixtures/distribution evidence;
12. observability/near-miss evidence;
13. blind cold-agent resume from repository files only;
14. 20D re-audit with evidence links.

A failure is useful evidence. Do not suppress it with `|| true`, `|| echo`, skipped required suites or relaxed authority contracts.

## Known compatibility item
Historical L2 tests and `scripts/graph-benchmark.ts` mutated `fsm.contextData.data` directly. `contextData` is intentionally copy-safe now. W13 must migrate those callers to an explicit supported setup mechanism or change fixtures; do not re-expose mutable canonical state merely to make old tests green.

## Merge discipline
All hardening PRs are stacked. Do not merge independently before W13 proves the canonical chain. Final merges must use expected head SHA and dependency order. CD remains OFF after merge until a separate release decision.
