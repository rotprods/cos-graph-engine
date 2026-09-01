# Fiscal / Financial Intelligence — COS 20D Application Audit

Status: **PARTIALLY APPLIED — NOT YET A TRUE COS 20D RUNTIME**

## Executive conclusion

The current fiscal/financial system already has strong **L8 Knowledge Graph** characteristics: typed entities, evidence links, tax facts, invoices, obligations, risk nodes, source precedence, GraphML/JSON/SQLite projections, and durable recovery artifacts.

However, it is not yet correct to say that COS Graph Engine is being applied end-to-end. The system is currently closer to an **evidence-backed property graph + control plane** than to a live multiplex 20D cognitive/runtime graph.

The gap is not the absence of GraphQL or GraphRAG in COS itself. Both already exist in the kernel. The gap is that the fiscal/financial graph has not been **mounted into the kernel as a domain profile and projected through all required levels**.

## What COS already provides

The kernel already contains:

- L0–L19 graph modules.
- GraphQL API across the 20 levels.
- L11 GraphRAG engine.
- L12 Memory Graph.
- L13 Agent Graph.
- L14 Tool Graph.
- L15 Workflow Graph.
- L16 Network Graph.
- Runtime package with EventBus / Scheduler / State Manager / CellHost.
- Shared Memory Bus integration modules.
- query, streaming, sharding, cache, replication, WASM and observability modules.

Therefore **we should integrate, not rebuild** these capabilities in the fiscal repository.

## Important correction: LangChain and CrewAI

A full COS implementation does **not** require LangChain or CrewAI to be the internal orchestrator.

COS explicitly positions its native L13 Agent Graph + L14 Tool Graph + L15 Workflow Graph as the zero-dependency alternative to heavy external agent frameworks.

Correct design:

```text
COS kernel = authority/runtime/orchestration core

optional adapters:
  LangChain -> adapter
  LangGraph -> adapter
  CrewAI -> adapter
  OpenAI Agents SDK -> adapter
  MCP tools -> adapter

never:
  fiscal source-of-truth -> framework-specific memory
```

External frameworks are interoperability surfaces, not canonical state.

## Current application by dimension

| Level | Dimension | Current fiscal state | Required next state |
|---|---|---|---|
| L0 | Visual | Dashboards/Sheets/Mermaid exist | Derive all views from graph queries |
| L1 | Execution | Recovery backlog exists | Compile tasks into COS ExecutionGraph |
| L2 | State | Status taxonomy exists | Enforce as StateMachine transitions |
| L3 | Dependency | blockers are tabular/graph edges | Mount into DependencyGraph + critical path |
| L4 | Call | tool calls are mostly chat/runtime traces | Persist tool/agent call graph |
| L5 | CFG | decision logic documented | Compile tax/remediation decision trees into CFG |
| L6 | DataFlow | lineage exists in CSV/SQLite | First-class evidence→fact→calc→return DataFlowGraph |
| L7 | Compute | calculations exist in spreadsheets/Python | Deterministic compute graph with replay/hash |
| L8 | Knowledge | **strongest current layer** | Make kernel KnowledgeGraph canonical projection |
| L9 | Semantic | ontology implicit/partial | Canonical fiscal ontology + alias resolution |
| L10 | Embedding | not canonical | Evidence embeddings as derived index |
| L11 | GraphRAG | not connected to fiscal corpus | Authority-aware evidence GraphRAG |
| L12 | Memory | STATE/HANDOFF exist | Event-sourced MemoryGraph with checkpoint/replay |
| L13 | Agent | roles conceptual | Live specialist agent registry/delegation/approval graph |
| L14 | Tool | connectors used ad hoc | Tool capability/schema/policy/fallback graph |
| L15 | Workflow | recovery playbooks exist | Executable idempotent workflows |
| L16 | Network | providers/infrastructure listed | Provider/infrastructure topology + SPOF analysis |
| L17 | Domain projection | counterparties in KG | Counterparty/institution/adviser projection |
| L18 | Domain projection | tax rules/obligations in KG | Regulatory/obligation/jurisdiction projection |
| L19 | Domain projection | invoices/lots/assets exist | Atomic financial-instrument/tax-lot projection |

## GraphQL audit

COS already has a GraphQL engine with schema, queries, mutations, pagination and multi-level access.

What is missing in the fiscal system:

1. A `FiscalGraphRepositoryAdapter` that maps durable fiscal data to COS graph IDs.
2. Domain-safe mutations.
3. authority-aware resolvers.
4. temporal filters (`valid_at`, `observed_at`, `filed_at`, `paid_at`).
5. provenance filters.
6. sensitivity/RBAC gates.
7. graph-level federation across financial, fiscal and XRP projections.

The fiscal GraphQL surface must be **read-mostly**. Mutations that promote legal truth must be policy-gated.

Example target query:

```graphql
query FiscalTruth($taxYear: Int!) {
  obligations(taxYear: $taxYear) {
    model
    period
    state
    authorityEvidence { id source authorityLevel }
    blockers { id reason }
    payments { state amount evidenceId }
  }
}
```

## GraphRAG audit

COS L11 already implements vector retrieval + graph traversal + re-ranking.

For fiscal production use it needs a stricter context compiler.

Required score:

```text
score =
  semantic_similarity
+ lexical_match
+ graph_proximity
+ source_authority
+ temporal_validity
+ provenance_completeness
+ entity_resolution_confidence
+ centrality
- staleness
- sensitivity_penalty
- contradiction_penalty
```

Required constraints:

- official filed artifact outranks adviser mail;
- primary invoice outranks bank-description inference;
- PREPARED can never answer a FILED question as truth;
- PAID requires payment evidence;
- every generated answer returns evidence IDs and graph paths;
- retrieval confidence and truth confidence remain separate.

The existing L11 demo/answer method is not enough for tax decisions by itself. Fiscal use requires evidence-bound answer synthesis and policy gates.

## Runtime Graph audit

A proper runtime graph should show live operational state:

```text
Agent
  -> calls Tool
  -> reads Evidence
  -> proposes FactMutation
  -> policy evaluates
  -> reviewer approves/rejects
  -> Event appended
  -> projections rebuild
  -> GraphRAG invalidated/reindexed
  -> task state changes
```

Current system performs several of these steps procedurally but not as one persistent runtime graph.

## Knowledge Graph audit

The current fiscal graph should be split into node classes rather than one flat entity space:

- `EvidenceArtifact`
- `EvidencePage`
- `Claim`
- `Fact`
- `Hypothesis`
- `Invoice`
- `Payment`
- `TaxReturn`
- `TaxObligation`
- `TaxRule`
- `TaxLot`
- `Asset`
- `Account`
- `Counterparty`
- `Authority`
- `Adviser`
- `Task`
- `Decision`
- `Risk`
- `Incident`
- `Agent`
- `Tool`
- `WorkflowRun`
- `Event`

Critical edge classes:

- `EVIDENCED_BY`
- `DERIVED_FROM`
- `CONTRADICTS`
- `SUPERSEDES`
- `AFFECTS_TAX_YEAR`
- `FILED_AS`
- `PAID_BY`
- `BLOCKED_BY`
- `REQUIRES`
- `CALCULATED_FROM`
- `CONSUMES_LOT`
- `OWNED_BY`
- `HELD_AT`
- `REVIEWED_BY`
- `APPROVED_BY`
- `EXECUTED_BY`
- `CALLED_TOOL`
- `PRODUCED_EVENT`

## Temporal model

Fiscal truth must be bi-temporal or multi-temporal.

Minimum timestamps:

- `event_time` — when the real-world event happened;
- `observed_at` — when the system learned it;
- `valid_from` / `valid_to` — when the fact is considered valid;
- `filed_at` — official filing timestamp;
- `paid_at` — payment timestamp;
- `superseded_at` — when replaced/corrected.

This prevents a later adviser email from rewriting historical truth.

## Event-sourcing contract

Canonical mutation path:

```text
Raw Evidence
  -> ParseObservation event
  -> NormalizeEntity event
  -> ProposeClaim event
  -> ValidateClaim event
  -> PromoteFact event
  -> RecomputeProjection event
  -> UpdateTask/State event
```

All graphs are rebuildable projections from durable evidence + events + registries.

## Framework interoperability

### LangChain / LangGraph
Use adapters for:
- external chain invocation;
- structured tool wrappers;
- graph-to-state export;
- state-to-COS event import.

Do not store canonical memory inside LangChain state.

### CrewAI
Use adapter for:
- importing crew/role/task definitions into L13/L15;
- exporting COS-approved task packs to CrewAI;
- receiving run results as observations/events.

Do not let CrewAI own legal truth or authoritative fiscal state.

### MCP
MCP capabilities belong in L14 Tool Graph:
- schema hash;
- permission;
- sensitivity;
- read/write class;
- health;
- fallback;
- last successful call.

## Acceptance test for “COS applied correctly”

We can say COS is applied correctly only when all of these pass:

1. Every material fiscal fact has an L8 evidence path.
2. Every active recovery task is in L1 and dependencies in L3.
3. State transitions are enforced by L2, not prose.
4. Calculations are replayable in L7.
5. GraphQL reads the same truth as SQLite/Drive projections.
6. GraphRAG returns evidence paths and respects source precedence.
7. Agent/tool/workflow runs appear in L13/L14/L15.
8. Runtime events rebuild the graph deterministically.
9. L17-L19 domain projections are explicit or NOT_APPLICABLE.
10. A zero-context agent can recover state without chat history.

Until then the honest state is: **Graphified and evidence-bound, but not yet a fully mounted COS 20D runtime.**
