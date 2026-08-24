# STATE — COS Graph Engine

Updated: 2026-08-24
Mode: **CONVERGENCE_AND_HARDENING**
Authority status: **SHADOW_ONLY**
Final verification: **DEFERRED_TO_W13_BY_OWNER_DECISION**

## Current truth
The original audit found exceptional feature breadth but uneven system guarantees. The active program raises the existing engine to a demonstrable 10/10 standard rather than adding breadth blindly.

## Active stacked hardening chain
- #18 — W0/W1 canonical truth + manual-only CI/CD posture
- #20 — W2 graph correctness
- #21 — W3 deterministic identity
- #22 — W4 bi-temporal + provenance
- #23 — W5 durable event kernel
- #24 — W6 snapshot/recovery protocol
- #25 — W7 policy/security enforcement
- #26 — W8 durable autonomous runtime
- #27 — W9 CAS + leases
- #28 — W10 resilience/change-risk runtime
- #29 — W11 scientific benchmark harness
- #30 — W12 scope-safe temporal GraphRAG
- #31 — W12.1 memory integrity
- current branch — W12.2 DX/governance cold-start contract

All implementation PRs remain draft until convergence review and W13 verification.

## Cost state
Hardening workflows, CI, release and deploy are being converted to manual-only before anything lands on `main`. Do not merge a branch that restores automatic cost-generating triggers.

## Known remaining engineering gaps
- complete CSR parallel-edge/reverse-CSR/invariant work from W2;
- migrate durable aggregate identities onto W3 primitives;
- persistent Postgres/SQLite adapters for event log/snapshots/CAS/leases;
- wire policy + leases + real tool capability resolution into every side-effect path;
- event-source autonomous execution and memory indexes;
- automatic resilience/near-miss projection;
- migrate legacy benchmark B1–B7 to scientific harness;
- reconcile existing `@cos/hub` PR with new identity/event/temporal/security contracts;
- final monorepo convergence and W13 evidence campaign.

## Current next action
Finish remaining W12.x architecture/DX/interop slices, create 20D convergence matrix, then perform one cross-stack compile/adversarial review before deciding merge order. Full tests/CI/replay/restore are intentionally held for the final qualification campaign.
