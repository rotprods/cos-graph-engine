# COS Graph Engine — 20D Engineering Scorecard

Scoring date: 2026-08-25

## Scoring law

`Authority = min(Build, Assurance)`.

- **Build** scores code/architecture completeness from static review.
- **Assurance** scores executed evidence.
- **Authority** is the promotion score.

No model opinion can directly raise Assurance. A score rises only when linked evidence closes the declared gate.

| ID | Vertical | Build | Assurance | Authority | Primary gap to 10 |
|---|---|---:|---:|---:|---|
| D01 | Vision / graph breadth | 9.4 | 6.0 | 6.0 | ownership/duplication map + use-case traceability |
| D02 | Monorepo architecture | 7.7 | 3.0 | 3.0 | reconcile #34/#35, lockfile, package boundaries |
| D03 | Graph correctness | 8.3 | 3.0 | 3.0 | clone safety, traversal invariants, property tests |
| D04 | Algorithms / performance | 8.0 | 2.5 | 2.5 | seeded workloads, reverse CSR evidence, SLOs |
| D05 | Temporal semantics | 7.2 | 2.0 | 2.0 | append-only system-time revisions, gold temporal cases |
| D06 | Event architecture | 8.0 | 2.5 | 2.5 | ordering/partition contract, outcome replay, DLQ/retries |
| D07 | Persistence / recovery | 7.5 | 2.0 | 2.0 | durable fixtures, empty-DB restore, RPO/RTO evidence |
| D08 | GraphRAG / context | 8.2 | 2.5 | 2.5 | one authority path, gold queries, leakage tests |
| D09 | Memory architecture | 7.6 | 2.0 | 2.0 | append-only epistemic history + deep immutability |
| D10 | Agent runtime | 7.2 | 2.0 | 2.0 | durable aggregate, restart/compensation/exact outcome |
| D11 | Security / policy | 7.7 | 2.0 | 2.0 | full enforcement coverage, security scan, deployment defenses |
| D12 | Concurrency / idempotency | 6.8 | 1.5 | 1.5 | immutable CAS, durable side-effect ledger, crash tests |
| D13 | Resilience | 8.0 | 2.5 | 2.5 | failure-combination/chaos evidence + automatic near misses |
| D14 | Observability | 8.6 | 4.0 | 4.0 | authority telemetry integration + SLO/observer-failure proof |
| D15 | Testing truth | 6.5 | 1.5 | 1.5 | preserve legacy suite, all orphan tests, property/mutation coverage |
| D16 | CI/CD | 5.5 | 1.0 | 1.0 | manual full matrix, forced-failure proof, retained verification breadth |
| D17 | Infrastructure / deployment | 6.8 | 2.0 | 2.0 | reproducible isolation, rollback/migrations, zero-cost topology proof |
| D18 | DX / Agent DX | 8.7 | 5.0 | 5.0 | provider instructions + blind cold-agent resume |
| D19 | Governance | 7.0 | 2.5 | 2.5 | canonical reconciliation, deletion ledger, independent review |
| D20 | Interoperability | 8.0 | 2.5 | 2.5 | canonical provider contracts, signatures, replay-safe bridges |

**Current means:** Build **7.6**, Assurance **2.6**, Authority **2.6**.

## Promotion rule per vertical

A vertical reaches **10.0 Authority** only when all of the following are true:

1. explicit invariants exist;
2. implementation is canonical and no competing authority path is ambiguous;
3. positive and negative tests exist;
4. relevant failure modes are exercised;
5. replay/recovery is demonstrated where stateful;
6. security and permission boundaries are exercised where privileged;
7. concurrency/crash behavior is exercised where multi-writer or side-effecting;
8. observability evidence is available;
9. documentation and rollback are current;
10. evidence links are attached to the exact commit SHA.

## Score movements

Every score change must be recorded as:

`Dxx old → new | evidence | commit/PR | reviewer | residual risk`.

Scores may move down when new evidence exposes a defect. That is system learning, not project failure.

## North Star

The project is `AUTHORITY_READY` only when **all 20 Authority scores = 10.0**, not when the average equals 10.