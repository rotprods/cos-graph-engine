# COS Graph Engine — 20D Authority Matrix

> This matrix prevents feature-count or model confidence from being confused with engineering proof.
>
> **IMPLEMENTED** means the architecture/code exists in the convergence stack.
> **VERIFIED** means W13 has compiled, exercised, attacked, replayed/restored and evidenced the guarantee.
> COS may not be called 10/10 or promoted to AGENTIC_SYSTEMS_OS authority until every critical row is VERIFIED.

| # | Dimension | Implementation state | Primary evidence | W13 verification required |
|---:|---|---|---|---|
| 1 | Vision / graph breadth | IMPLEMENTED | L0–L19 + hub/context/resilience layers | architecture re-audit, no redundant authority layers |
| 2 | Monorepo architecture | IMPLEMENTED / convergence pending | workspace packages + W0/W1 + hub workspace | clean install, build graph, dependency-cycle audit |
| 3 | Graph correctness | IMPLEMENTED / migration pending | `property-graph.ts`, `bidirectional-csr.ts` | invariant/property/mutation tests; migrate authority consumers |
| 4 | Algorithms / performance | IMPLEMENTED | CSR/WASM/pruning + scientific benchmark harness | deterministic benchmark campaign against explicit SLOs |
| 5 | Temporal semantics | IMPLEMENTED core | bi-temporal primitives + KnowledgeGraph temporal revisions | late-arrival/supersession/as-of property tests across domains |
| 6 | Event architecture | IMPLEMENTED | `event-log.ts`, `transactional-event-log.ts`, `postgres-event-log.ts` | concurrent append, duplicate delivery, ordering, restart/replay tests |
| 7 | Persistence / recovery | IMPLEMENTED contracts/adapters | recovery coordinator, snapshots, Postgres adapter | empty-DB restore, corruption, snapshot+replay equivalence |
| 8 | GraphRAG / context | IMPLEMENTED | scoped temporal GraphRAG + `ContextPackCompiler` | retrieval gold set, permission leak negatives, stale-pack tests |
| 9 | Memory architecture | IMPLEMENTED hardening | W12.1 MemoryManager + canonical consolidation | durable adapter, expiry/index/property/contradiction tests |
| 10 | Agent runtime | IMPLEMENTED authority path | AutonomousLoop + CapabilityRouter + GoalExecutionCoordinator | interruption/restart, acceptance, compensation/side-effect tests |
| 11 | Security / policy | IMPLEMENTED enforcement primitives | PolicyEngine, CapabilityRouter guard, StrictToolRegistry | enforce-mode negative tests, filesystem/SSRF/scope/secret review |
| 12 | Concurrency | IMPLEMENTED reference semantics | CAS, hash-CAS, fencing leases, idempotency registry | contention, TTL expiry, stale worker, durable transaction tests |
| 13 | Resilience | IMPLEMENTED model + signals | ResilienceRegistry + ResilienceObserver | failure injection, coupled failure scenarios, near-miss evidence audit |
| 14 | Observability | STRONG BASE / integration incomplete | tracing/profiling/telemetry + policy/resilience evidence | end-to-end trace coverage, cardinality/SLO/error-path checks |
| 15 | Testing truth | CONTRACT DEFINED / deferred | W0/W1 guarantee catalog | orphan inventory, negative/property/integration suites, no false green |
| 16 | CI/CD | COST-SAFE / deferred | manual-only CI/Deploy/Release | one explicit final CI qualification; CD remains off unless needed |
| 17 | Infra / deployment | IMPLEMENTED optional targets | Docker/K8s/Grafana + Postgres driver-neutral adapter | zero-cost target validation, config/secrets/deployment review |
| 18 | Developer + Agent DX | IMPLEMENTED cold-start | README_FIRST/GOAL/STATE/HANDOFF/AGENTS + context packs | blind fresh-agent resume and contributor cold-start drill |
| 19 | Governance | IMPLEMENTED convergence protocol | stacked W0–W12.3 PRs, issue #19, scorecards | collapse stack safely, branch/PR truth, protected authoritative main |
| 20 | Ecosystem interoperability | IMPLEMENTED v0.2 substrate | `@cos/hub`, canonical GitHub IDs, semantic webhooks, event replay | provider fixtures, hub replay/hash, AGENTIC shadow integration |

## Critical no-claim rule

The current branch is **not 10/10 yet**. It is a high-density implementation candidate awaiting W13 evidence.

A dimension can transition to VERIFIED only when:

1. its falsifiable guarantee catalog is complete;
2. positive and negative tests execute from a clean environment;
3. relevant concurrency/failure/replay/security scenarios execute;
4. evidence is linked to the PR/commit/run/artifact;
5. no known P0/P1 defect is open;
6. `/complexsystems` review records new couplings and residual risk;
7. a fresh agent can reconstruct the decision and evidence without chat memory.

## W13 exit condition

`20 / 20 VERIFIED` **and** all cross-dimensional authority gates pass:

- deterministic identity and replay;
- no silent false success;
- no fail-open security path;
- no stale-writer acceptance;
- no unscoped context retrieval;
- recovery from empty persistent state;
- scientific benchmark claims reproduce;
- manual CI is genuinely fail-closed;
- cold-agent resume succeeds;
- incremental recurring infrastructure cost remains EUR 0 by default.
