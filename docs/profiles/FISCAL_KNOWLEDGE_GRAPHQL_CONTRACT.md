# Fiscal Knowledge + GraphQL Contract — PR-C

## Purpose
Turn the fiscal evidence model into first-class COS L8/L9 projections and expose a read-only domain gateway over the existing COS GraphQL kernel.

## L8 Knowledge projection
The domain node vocabulary includes evidence, assertions, invoices, payments, returns, obligations, rules, tax lots, accounts, counterparties, authorities, advisers, tasks, decisions, risks, incidents, agents, tools, workflow runs and events.

Every node may carry:
- truth class;
- source-authority rank;
- tax year / period;
- event/observation/validity time;
- source IDs;
- sensitivity;
- domain-specific properties.

Every edge preserves the fiscal relation in metadata even when mapped onto the smaller generic L8 relation vocabulary.

Critical fiscal relations include:
`EVIDENCED_BY`, `DERIVED_FROM`, `CONTRADICTS`, `SUPERSEDES`, `BLOCKED_BY`, `CALCULATED_FROM`, `CONSUMES_LOT`, `FILED_AS`, `PAID_BY`, `REVIEWED_BY`, `APPROVED_BY`, `CALLED_TOOL`.

## L9 Semantic projection
`buildFiscalSemanticOntology()` builds a domain class hierarchy so evidence, assertion, obligation, financial-object, actor and governance concepts are distinguishable during retrieval and validation.

## GraphQL read gateway
`FiscalGraphQLGateway` mounts fiscal nodes/edges into the existing L8 `GQLEngine` and exposes only read operations:
- `fiscalNode`
- `fiscalSearch`
- `fiscalObligations`
- `fiscalEvidence`
- `fiscalBlockers`

Filters include:
- fiscal type;
- truth class;
- authority rank;
- tax year;
- period;
- valid-at time;
- sensitivity.

Generic GraphQL mutations are deliberately not exposed by this gateway. Truth-changing mutations must go through event/policy gates rather than `addNode`/`addEdge` directly.

## Example

```graphql
query {
  fiscalObligations(taxYear: 2026, period: "Q2") {
    id
    fiscalType
    truthClass
    authorityRank
  }
}
```

Then retrieve:

```graphql
query {
  fiscalEvidence(nodeId: "obligation:303:2026Q2") {
    id
    fiscalType
    authorityRank
  }
}
```

The system can therefore answer `what do we know?` and `what evidence supports it?` without allowing a dashboard/agent to mutate legal truth through the read API.

## Boundaries
- no raw private fiscal evidence committed;
- no GraphRAG yet;
- no write mutations for legal truth;
- no external agent-framework state used as authority;
- no claim that GraphQL is the persistence database.

## Acceptance
- L8 projection rejects dangling relations;
- L9 ontology validates without dangling edges;
- GraphQL filters by tax year/period/validity;
- evidence/blocker traversal returns graph neighbours by fiscal relation;
- mutation operation through fiscal gateway is rejected;
- repository-wide CI must actually execute after #71 is repaired.
