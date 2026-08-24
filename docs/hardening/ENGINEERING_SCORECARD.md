# COS Graph Engine — Engineering Scorecard

Scores are not subjective maturity labels. A score >=9 requires automated evidence for the listed guarantees.

| Dimension | Current audit | 9/10 evidence target |
|---|---:|---|
| Vision / graph breadth | 9.0 | Architecture remains coherent under convergence; no duplicate runtime kernels |
| Monorepo architecture | 7.0 | clean install, workspace graph consistent, package boundaries enforced |
| Graph correctness | 5.0 | invariant suite, atomic indexes, parallel edges, deterministic graph hash |
| Algorithms/performance | 7.0 | seeded scientific benchmarks, reverse CSR, regression thresholds by objective |
| Temporal semantics | 2.0 | bi-temporal queries, supersession, correction, historical reconstruction |
| Event architecture | 3.0 | durable append-only log, replay, ordering, idempotency, cursors |
| Persistence/recovery | 3.0 | restart, snapshot, replay, restore drill, external recovery artifact |
| GraphRAG | 5.0 | provenance, scope, hybrid retrieval, gold queries, precision/recall evidence |
| Memory | 5.0 | epistemic typing, temporal validity, durable indexes, contradiction handling |
| Agent runtime | 5.0 | real tools, leases, acceptance gates, compensation, durable run trace |
| Security/policy | 3.0 | fail-closed enforcement on actual execution path + audit |
| Concurrency | 2.0 | CAS, task leases, ordering, duplicate-safe retries, multi-writer tests |
| Resilience | 3.0 | degraded states, near misses, failure injection, defenses, recovery paths |
| Observability | 8.0 | end-to-end traces + SLOs across event/projector/query/agent/context |
| Testing | 5.0 | one canonical test command, orphan-test inventory zero, mutation/failure evidence |
| CI/CD | 3.0 | no swallowed required failures, required checks, deterministic clean checkout pass |
| Infra/deployment | 6.0 | zero-cost reference deploy + reproducible local/container recovery |
| DX / Agent DX | 7.0 | cold-start under 5 min, README_FIRST, deterministic handoff, canonical commands |
| Governance | 3.0 | main is current truth, bounded open PR stack, dependency-aware merge discipline |
| Ecosystem interoperability | 8.0 | hub supports canonical IDs and typed adapters across repos/projects/chats/tools |

## Score policy
- `0–3`: prototype / missing guarantees
- `4–6`: functional but unsafe as authority
- `7–8`: strong engineering with known assurance gaps
- `9`: production-authoritative within declared scope; automated recovery/failure evidence exists
- `10`: reserved; requires sustained operational evidence, not code review alone

## Mandatory evidence bundle per dimension
Every >=9 claim links to:
- invariant specification
- tests
- negative/failure test
- benchmark or SLO where relevant
- recovery/replay evidence where relevant
- security/privacy evidence where relevant
- commit/PR SHA

## Global authority block
AGENTIC_SYSTEMS_OS must not treat COS Graph Engine as authoritative until Gate A in `MASTER_PLAN.md` passes.
