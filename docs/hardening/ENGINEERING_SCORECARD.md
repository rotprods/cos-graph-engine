# COS Graph Engine — Engineering Scorecard

Scores are evidence-backed, not subjective maturity labels. The program target is now **10/10 across all 20 dimensions**.

| Dimension | Current audit | 10/10 evidence target |
|---|---:|---|
| Vision / graph breadth | 9.0 | Architecture remains coherent under convergence; no duplicate runtime kernels; authority boundaries explicit |
| Monorepo architecture | 7.0 | clean install, workspace graph consistent, package boundaries enforced, reproducible build |
| Graph correctness | 5.0 | invariant suite, atomic indexes, parallel edges, deterministic graph hash, mutation/property tests |
| Algorithms/performance | 7.0 | seeded scientific benchmarks, reverse CSR, complexity budgets, regression thresholds by objective |
| Temporal semantics | 2.0 | bi-temporal queries, supersession, correction, historical reconstruction, deterministic replay |
| Event architecture | 3.0 | durable append-only log, replay, ordering, causation/correlation, idempotency, cursors |
| Persistence/recovery | 3.0 | restart, snapshot, replay, full restore drill, external recovery artifact, hash equivalence |
| GraphRAG | 5.0 | provenance, scope, hybrid retrieval, gold queries, precision/recall evidence, stale-context detection |
| Memory | 5.0 | epistemic typing, temporal validity, durable indexes, contradiction/supersession, safe consolidation |
| Agent runtime | 5.0 | real tools, leases, acceptance gates, compensation/rollback, durable run trace, cold resume |
| Security/policy | 3.0 | fail-closed enforcement on actual execution path, scope isolation, audit, adversarial tests |
| Concurrency | 2.0 | CAS, task leases, ordering, duplicate-safe retries, multi-writer/race/failure tests |
| Resilience | 3.0 | degraded states, near misses, interacting failure modes, failure injection, defenses, recovery paths |
| Observability | 8.0 | end-to-end traces + SLOs across event/projector/query/agent/context, failure causality linked |
| Testing | 5.0 | one canonical discovery path, orphan-test inventory zero, mutation/property/failure/security evidence |
| CI/CD | 3.0 | no swallowed required failures, local-first verification, manual-only remote CI during convergence, CD off |
| Infra/deployment | 6.0 | zero-cost reference deploy, reproducible local/container recovery, optional deployment paths isolated |
| DX / Agent DX | 7.0 | cold-start under 5 min, README_FIRST, deterministic handoff, canonical commands and contracts |
| Governance | 3.0 | main is current truth, bounded PR stack, guarantee-oriented changes, evidence ledger and supersession discipline |
| Ecosystem interoperability | 8.0 | canonical IDs + typed/versioned adapters across repos/projects/chats/tools/providers |

## Score policy
- `0–3`: prototype / missing guarantees
- `4–6`: functional but unsafe as authority
- `7–8`: strong engineering with known assurance gaps
- `9`: production-grade within declared scope; automated nominal/failure evidence exists
- `10`: all declared guarantees are reproducible, adversarially validated, recoverable, observable, scope-safe, concurrency-safe and cold-start documented; no critical unknowns remain in declared scope

## Mandatory evidence bundle per 10/10 dimension
Every 10/10 claim links to:
- guarantee/invariant specification
- positive tests
- negative/failure tests
- concurrency/fault tests where relevant
- benchmark or SLO where relevant
- recovery/replay evidence where relevant
- security/privacy evidence where relevant
- clean-environment reproduction command
- commit/PR SHA
- current STATE/HANDOFF reference

## Local-first cost policy
- Local/container verification is the default executor.
- GitHub Actions are manual-only during Convergence Era except an explicitly approved release/security/restore gate.
- CD is disabled during Convergence Era.
- Codex is optional, not a dependency.

## Global authority block
AGENTIC_SYSTEMS_OS must not treat COS Graph Engine as authoritative until critical dimensions are 10/10 and W13 full re-audit passes.
