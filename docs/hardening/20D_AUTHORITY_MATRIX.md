# COS Graph Engine — 20D Authority Matrix

> This matrix prevents feature-count or model confidence from being confused with engineering proof.
>
> **IMPLEMENTED** means the architecture/code exists in the convergence stack.
> **VERIFIED** means W13 has compiled, exercised, attacked, replayed/restored and evidenced the guarantee.
> COS may not be called 10/10 or promoted to AGENTIC_SYSTEMS_OS authority until every critical row is VERIFIED.

Current implementation head: `hardening/w12-4-authority-completion`.
Current proof state: **IMPLEMENTED / UNVERIFIED**.

| # | Dimension | Implementation state | Primary evidence now in stack | W13 verification required |
|---:|---|---|---|---|
| 1 | Vision / graph breadth | IMPLEMENTED | L0–L19 + Hub + authority context + resilience + memory authority | architecture re-audit; prove one authority kernel per concern |
| 2 | Monorepo architecture | IMPLEMENTED / lock reconciliation pending | root workspace/tsconfig includes `@cos/hub`; authority packages exported | regenerate/commit lock, clean `npm ci`, build graph, dependency-cycle audit |
| 3 | Graph correctness | IMPLEMENTED authority path | invariant-safe PropertyGraph + `BidirectionalCSRGraph` + deterministic authority projections | property/mutation/parallel-edge/reverse-projection tests; authority-consumer cutover audit |
| 4 | Algorithms / performance | IMPLEMENTED | CSR/WASM/pruning + scientific benchmark harness + deterministic projections | controlled benchmark campaign against explicit objective/SLOs |
| 5 | Temporal semantics | IMPLEMENTED cross-domain core | temporal primitives, KnowledgeGraph revisions, authority memory, temporal context/index filtering | late-arrival/supersession/as-of/known-at property tests across knowledge/memory/context |
| 6 | Event architecture | IMPLEMENTED | in-memory, transactional and Postgres event logs; event-first Hub projection | concurrent append, semantic idempotency conflict, ordering, restart/replay tests |
| 7 | Persistence / recovery | IMPLEMENTED | RecoveryCoordinator, Postgres event/memory adapters, Hub SHA-256 snapshot manager | empty-state restore, corrupt snapshot, post-snapshot replay and equivalence tests |
| 8 | GraphRAG / context | IMPLEMENTED authority path | `AuthorityGraphRAGIndex`, `AgenticContextProjector`, `ContextPackCompiler` version/hash fencing | retrieval gold set, cross-project/sensitivity negatives, stale-pack/hash tests |
| 9 | Memory architecture | IMPLEMENTED authority path | index-safe MemoryManager, PostgresMemoryStore, bi-temporal `AuthorityMemoryStore` | Postgres transaction tests, contradiction/supersession/retraction, expiry/index rebuild |
| 10 | Agent runtime | IMPLEMENTED authority path | fail-closed AutonomousLoop + StrictToolRegistry + CapabilityRouter + coordinator | interruption/restart, acceptance, idempotent side effect, compensation tests |
| 11 | Security / policy | IMPLEMENTED enforcement path | PolicyEngine, input guards, StrictToolRegistry, context scope filter | enforce-mode negatives, filesystem traversal, SSRF/egress, secret/scope review |
| 12 | Concurrency | IMPLEMENTED | hash-CAS, monotonic fencing leases, payload-bound idempotency, VersionedStateMachine | contention, stale revision, lease expiry/transfer, durable transaction tests |
| 13 | Resilience | IMPLEMENTED + live signals | ResilienceRegistry/Observer, policy and goal conflict signals | coupled-failure injection, defense effectiveness and near-miss evidence audit |
| 14 | Observability | IMPLEMENTED authority bridge | existing tracing/profiling + `AuthorityTelemetry` terminal event/metrics | end-to-end event→projection→query→agent traces, cardinality and sink-failure tests |
| 15 | Testing truth | W13 substrate IMPLEMENTED | authority/provider contract harnesses; fail-closed manual workflow | execute orphan inventory, negative/property/integration suites from clean checkout |
| 16 | CI/CD | MANUAL-ONLY QUALIFICATION IMPLEMENTED | `w13-authority-qualification.yml`; no CD trigger | one explicit final run; lockfile truth; required failure proves red; CD remains off |
| 17 | Infra / deployment | IMPLEMENTED optional targets | driver-neutral Postgres/Supabase DDL + existing Docker/K8s/Grafana | zero-cost target validation, migrations, config/secrets/egress review |
| 18 | Developer + Agent DX | IMPLEMENTED cold-start | README_FIRST/GOAL/STATE/HANDOFF/AGENTS + exact W12.4 plan/context packs | blind fresh-agent resume and contributor cold-start drill |
| 19 | Governance | IMPLEMENTED convergence protocol | stacked PRs, issue #19, explicit implementation/proof boundary | collapse stack safely; close obsolete PRs; protect authoritative main |
| 20 | Ecosystem interoperability | IMPLEMENTED authority substrate | canonical AgenticResourceRegistry, Hub queries/store/webhooks/context bridge | provider fixture execution, Hub restore, AGENTIC shadow workload |

## W12.4 exact implementation evidence

- `docs/hardening/W12_4_AUTHORITY_COMPLETION_PLAN.md`
- `packages/graph/src/authority-graphrag.ts`
- `packages/graph/src/context-pack.ts`
- `packages/graph/src/versioned-state-machine.ts`
- `packages/hub/src/agentic-context.ts`
- `packages/hub/src/query.ts`
- `packages/hub/src/store.ts`
- `packages/hub/src/hub.ts`
- `packages/hub/fixtures/github-webhook-contracts.json`
- `packages/core/src/memory-authority.ts`
- `packages/memory/src/authority-memory-store.ts`
- `packages/observability/src/authority.ts`
- `packages/api/src/server.ts`
- `scripts/w13-authority-contract.ts`
- `scripts/w13-provider-contract.ts`
- `.github/workflows/w13-authority-qualification.yml`

## Critical no-claim rule

The current branch is **not 10/10 yet**. It is the W13 qualification candidate.

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
