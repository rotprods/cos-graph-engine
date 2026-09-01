# Fiscal / Financial COS 20D — Implementation Compiler

## Goal

Mount the existing fiscal/financial digital twin into COS Graph Engine as a live, replayable, authority-aware 20D profile without duplicating source-of-truth or coupling it to any single agent framework.

## Architecture target

```text
GOOGLE DRIVE /FISCAL + BANK/BROKER + GMAIL + GITHUB + AUTHORITY ARTIFACTS
                         |
                         v
                  Evidence Ingestion
                         |
                         v
                Immutable Event Ledger
                         |
       +-----------------+------------------+
       |                 |                  |
       v                 v                  v
  Identity Registry   Claim/Fact Store   Task/Decision Store
       |                 |                  |
       +-----------------+------------------+
                         |
                         v
                 COS Projection Kernel
                         |
        +----------------+----------------+
        |                |                |
      L0-L7            L8-L12           L13-L19
 execution/compute   knowledge/memory   agent/tool/domain
        |                |                |
        +----------------+----------------+
                         |
                         v
       GraphQL + GraphRAG + Context Compiler
                         |
                         v
          Agents / Humans / Dashboards / APIs
```

## Non-negotiable authority model

Git authority, event authority, evidence authority, data authority and secret authority are distinct.

- Git: schemas, code, migrations, policies.
- Events: mutation history and replay.
- Evidence: Drive/raw originals, official filings, bank/broker statements.
- Data: derived operational projections.
- Secrets: external secret manager / connector auth; never graph content.

## Wave 0 — Authority & contracts

### T0.1 Canonical ID registry
Define stable IDs for:
- person/legal entity;
- account/provider;
- invoice/payment;
- tax obligation/return;
- evidence artifact/page;
- tax lot/asset;
- agent/tool/workflow/event.

DoD:
- IDs survive source re-imports.
- alias table supports renames and duplicate resolution.
- no Drive filename becomes canonical identity by itself.

### T0.2 Temporal contract
Add `event_time`, `observed_at`, `valid_from`, `valid_to`, `filed_at`, `paid_at`, `superseded_at`.

Tests:
- late-arriving evidence does not rewrite historical state silently;
- corrected invoice supersedes but does not delete prior artifact.

### T0.3 Certainty contract
Enums:
`CONFIRMED`, `RECONSTRUCTED`, `PRELIMINARY`, `REVIEW`, `SCENARIO`, `BLOCKED`.

State semantics must be separate from tax filing lifecycle.

## Wave 1 — Fiscal 20D projection compiler

Implement `FiscalFinancialProjector`:

```ts
project(eventStore, identityRegistry): {
  L0, L1, L2, L3, L4, L5, L6, L7,
  L8, L9, L10, L11, L12,
  L13, L14, L15, L16, L17, L18, L19
}
```

Rules:
- one event may affect multiple projections;
- projections are idempotent;
- rebuild-from-zero must reproduce hashes;
- unsupported dimensions explicitly report `NOT_APPLICABLE`, never fake nodes.

## Wave 2 — L1/L2/L3 recovery runtime

Compile Fiscal Recovery War Room into:
- L1 task DAG;
- L2 state machines;
- L3 blockers/dependencies.

Primary state machines:

### Filing
`UNKNOWN -> PREPARED -> FILED -> LIQUIDATED -> PAID/CLOSED`

Alternate:
`UNKNOWN -> NOT_FILED -> REGULARIZATION_REQUIRED`

### Evidence
`DISCOVERED -> INGESTED -> PARSED -> NORMALIZED -> VALIDATED -> AUTHORITATIVE/REJECTED`

### Invoice
`DRAFT -> ISSUED -> COLLECTED -> RECTIFIED/ANNULLED`

No direct illegal transitions.

## Wave 3 — L4/L5/L6 observability & lineage

### Call Graph
Every agent/tool operation records:
- caller;
- tool;
- input schema hash;
- target resources;
- duration;
- result class;
- evidence produced;
- retry/fallback.

### CFG
Encode remediation decisions:
- filed vs unfiled;
- paid vs unpaid;
- prior request vs voluntary regularization;
- invoice valid vs rectify;
- reverse-charge applicable vs not.

### DataFlow
Canonical paths:

```text
Invoice PDF -> Parsed invoice -> VAT fact -> 303 period -> Filed return
Bank row -> Payment match -> Invoice collection status
Broker transaction -> FIFO lots -> Realized P/L -> Tax year -> Modelo100
```

## Wave 4 — L7 deterministic compute plane

Move calculations from ad hoc spreadsheets/Python into replayable compute nodes.

Engines:
- VAT output/input;
- reverse charge;
- withholding;
- quarterly IRPF;
- FIFO;
- debt/recargo;
- revenue reconciliation;
- bank/invoice matching;
- capital-loss carryforward.

Hard rule: async agents can propose inputs, but deterministic calculation graph produces working numbers.

Tests:
- golden fixtures;
- rounding fixtures;
- duplicate invoice fixture;
- transfer-vs-disposal crypto fixture;
- replay hash equality.

## Wave 5 — L8/L9 ontology & knowledge

Create canonical ontology modules:

### Evidence
Artifact, Page, Email, Statement, FilingReceipt, PaymentReceipt.

### Fiscal
TaxYear, TaxModel, TaxObligation, TaxReturn, TaxRule, CensusActivity, Withholding.

### Financial
Account, Transaction, Asset, TaxLot, Debt, Payment, Provider.

### Business
Invoice, InvoiceLine, Client, Supplier, Adviser, LegalEntity.

### Governance
Claim, Fact, Hypothesis, Decision, Risk, Incident, Gate.

Entity resolution rules:
- person != business;
- client brand != legal customer;
- invoice number scoped by series/year/entity;
- exchange transfer != sale;
- template != filed return.

## Wave 6 — L10/L11 Authority-Aware GraphRAG

### Index
Embed:
- evidence chunks;
- filings;
- adviser correspondence;
- law/rule snippets;
- graph neighborhoods.

### Retrieval stages
1. lexical retrieval;
2. semantic retrieval;
3. entity expansion;
4. multi-hop graph traversal;
5. temporal filtering;
6. source-authority ranking;
7. contradiction expansion;
8. sensitivity filtering;
9. context compaction.

### Required response object

```ts
{
  answer,
  claims: [{ text, truthConfidence }],
  evidence: [{ id, authority, validAt }],
  graphPaths,
  contradictions,
  unresolvedGaps,
  retrievalTrace
}
```

No unsupported claim is emitted as certain.

## Wave 7 — GraphQL federation

Use existing COS GraphQL kernel as access layer.

Add domain resolver package:

```text
FiscalQuery
FinancialQuery
EvidenceQuery
RecoveryQuery
PortfolioQuery
AgentRuntimeQuery
```

Required filters:
- tax year;
- period;
- authority level;
- state;
- certainty;
- jurisdiction;
- valid_at;
- observed_at;
- sensitivity.

Mutation classes:

### Safe automatic
- add observation;
- append event;
- attach evidence;
- update derived task status.

### Policy-gated
- promote claim to fact;
- mark FILED;
- mark PAID;
- supersede invoice;
- close risk;
- authorize filing workflow.

## Wave 8 — L12 memory & zero-context recovery

Mount STATE/HANDOFF/CHANGELOG as projections of MemoryGraph + EventGraph.

Every session ends with:
- checkpoint event;
- task delta;
- risk delta;
- evidence delta;
- next frontier;
- hash/manifest.

Recovery benchmark:
A clean agent must answer in <5 minutes:
1. project North Star;
2. current tax status;
3. latest authoritative evidence;
4. open critical risks;
5. current execution frontier;
6. what must NOT be treated as truth.

## Wave 9 — L13 agent organization

Fiscal agent roster:
- Mission Commander;
- Evidence Collector;
- Entity Resolver;
- Accountant/Reconciler;
- Tax Researcher;
- Crypto Tax-Lot Analyst;
- Risk Reviewer;
- Independent QA;
- Human Adviser Gate;
- Owner Approval Gate.

Do not hard-code generic developer-team roles for fiscal execution.

Adapters may import/export LangChain/LangGraph/CrewAI runs, but COS owns state.

## Wave 10 — L14 Tool Fabric

Tool node fields:
- provider;
- capability;
- schema version/hash;
- read/write;
- permission;
- sensitivity class;
- latency;
- health;
- last success;
- fallback;
- data authority class.

Examples:
Gmail, Google Drive, GitHub, SQLite/Postgres, web, local runtime, future AEAT/TGSS source.

Tool routing must use graph state, not hard-coded chat intuition.

## Wave 11 — L15 workflow compiler

Executable workflows:

### Authority Truth
search -> retrieve -> classify -> verify -> mutate state -> emit checkpoint.

### Invoice Close
capture -> entity resolve -> tax classify -> bank match -> QA -> quarter assignment.

### Quarterly Close
freeze -> reconcile -> calculate -> independent QA -> owner approve -> adviser/file -> receipt ingest.

### Crypto FIFO
provider inventory -> import -> classify transfer/disposal -> global FIFO -> reconcile -> tax year.

Each workflow has retry, timeout, compensation and human gates.

## Wave 12 — L16 provider/network graph

Represent:
- banks;
- brokers;
- exchanges;
- wallets;
- Drive/GitHub/local DB;
- adviser systems;
- external tax authority sources;
- runtime nodes.

Outputs:
- concentration risk;
- evidence SPOF;
- unavailable connector fallback;
- stale mirror detection.

## Wave 13 — L17/L18/L19 fiscal domain projections

### L17 Counterparty / Institution
Clients, suppliers, advisers, banks, AEAT, TGSS, brokers, exchanges, legal entities.

### L18 Regulatory / Obligation
Tax laws, models, deadlines, jurisdiction, applicability, professional review requirements.

### L19 Atomic Financial Objects
Invoice lines, payments, debts, asset lots, realized disposals, tax-return line items.

These are domain projections over the generic L17-L19 graph substrate; they do not alter kernel algorithms.

## Wave 14 — Interop adapters

Create optional adapters:
- `@cos/adapter-langchain`;
- `@cos/adapter-langgraph`;
- `@cos/adapter-crewai`;
- `@cos/adapter-mcp`.

Adapter contract:

```ts
interface ExternalAgentRuntimeAdapter {
  importDefinition(input: unknown): COSAgentWorkflow;
  execute(contextPack: COSContextPack): Promise<Observation[]>;
  exportTrace(): RuntimeTrace;
}
```

No adapter owns canonical memory or facts.

## Wave 15 — Persistence

Backend-neutral repository interface with adapters:
- in-memory for tests;
- SQLite for portable local use;
- Postgres/Supabase for production;
- JSON/GraphML for export only.

Production target:
- JSONB properties;
- pgvector embeddings;
- recursive graph queries or materialized adjacency;
- event table append-only;
- projection checkpoints;
- Realtime invalidation where useful.

GraphQL is access API, not the database.

## Wave 16 — Security / governance

- RBAC/ABAC;
- field-level sensitivity;
- audit logs;
- redaction;
- secret exclusion;
- retention policies;
- approval gates.

Portable graph must minimize PII.

## Wave 17 — Adversarial acceptance gauntlet

Questions include:
- Can a blank template become FILED through any path?
- Can a payment letter become PAID without proof?
- Can GraphRAG cite an obsolete rule as current?
- Can one provider's FIFO be mistaken for global FIFO?
- Can an agent promote a hypothesis without evidence?
- Can connector outage erase continuity?
- Can two invoice series collide?
- Can an entity alias merge the wrong taxpayer?
- Can a stale projection override raw evidence?

## Wave 18 — Performance

Benchmarks:
- 10k, 100k, 1m evidence nodes;
- graph traversal P50/P95/P99;
- GraphRAG context compile latency;
- replay throughput;
- mutation throughput;
- memory;
- incremental projector latency.

## Wave 19 — Release gate

A fiscal project may claim `COS_20D_MOUNTED` only if:

- all 20 levels have implementation status;
- N/A dimensions are explicit;
- GraphQL and GraphRAG query real fiscal state;
- runtime traces exist;
- replay is deterministic;
- source precedence is enforced;
- zero-context recovery passes;
- no unsupported framework owns truth;
- security review passes;
- independent reviewer signs the release manifest.

## First implementation slice

Do **not** build all waves at once.

PR-A:
- domain profile contract;
- 20D validator;
- audit doc;
- no data migration.

PR-B:
- fiscal identity/event schemas;
- L1/L2/L3 projector;
- fixtures.

PR-C:
- L8/L9 evidence/ontology projector;
- GraphQL read resolvers.

PR-D:
- authority-aware GraphRAG context compiler.

PR-E:
- runtime L13/L14/L15 + tool adapters.

PR-F:
- persistence adapter + replay/hash + zero-context benchmark.

Only after these are green should the existing fiscal graph be migrated from export-oriented GraphML/CSV into a live COS-mounted runtime.
