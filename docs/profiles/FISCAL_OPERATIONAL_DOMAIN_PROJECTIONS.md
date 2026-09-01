# Fiscal Operational + Domain Projections — PR-F

This slice closes most remaining dimensions after the execution/state/knowledge/GraphRAG/agent-tool-workflow stack.

## Native operational projections

### L4 — Call Graph
`FiscalCallTraceProjection`
- agent → tool → operation topology;
- call ID, outcome, duration, schema hash, evidence IDs and sensitivity retained;
- duplicate call observations rejected.

### L5 — CFG
`buildFiscalDecisionCFG()` supplies explicit decision guards for:
- filed status;
- payment status;
- invoice validity;
- foreign-service VAT;
- historical regularization.

The CFG describes decision paths and guards. It does not itself establish a legal conclusion.

### L6 — DataFlow
`buildFiscalDataFlow()` maps:
`source -> parse -> normalize -> resolve -> calculate -> review -> filing/projection`.

Fiscal lineage relation is preserved on the data-flow edge partition key.

### L7 — Compute
`computeFiscalMoney()` builds deterministic `ComputationalGraph` calculations in integer cents for:
- invoice total;
- realized P/L;
- debt total;
- reconciliation gap.

The graph emits replay material and separates working calculations from filed truth.

### L10 — Embedding
`FiscalEmbeddingIndex` wraps native `EmbeddingGraph` while marking embeddings as derived retrieval indexes. Semantic similarity can retrieve evidence but cannot create authority.

### L12 — Memory
`FiscalMemoryProjection` stores durable session/checkpoint nodes and `evolves_to` links, including evidence/task/risk deltas and next execution frontier.

## L16 — Provider / infrastructure network
`FiscalProviderNetwork` uses native `NetworkGraphEngine` and a fiscal relation sidecar to model:
- bank/broker/exchange/wallet/storage/database/authority/runtime providers;
- health and canonical status;
- dependency/fallback topology;
- single-point-of-failure analysis.

## L17 — Counterparty / institution network
`FiscalCounterpartyProjection` uses native `SocialGraphEngine` for topology only. Domain relations such as `REGULATES`, `CLIENT_OF`, `ADVISES`, `CUSTODIES_FOR` remain in an explicit sidecar.

We deliberately do **not** pretend fiscal relationships are `friend_of` or `follows`.

## L18/L19 — no semantic coercion
The native COS L18/L19 kernels are biologically/molecularly specialized. A production fiscal profile must not encode:

```text
TaxRule -> gene
Invoice -> atom
Payment -> chemical bond
```

That would make a nominal 20D implementation while corrupting semantics.

Therefore `FiscalDomainProjectionGraph` provides an explicit domain-semantic adapter with:
- `kernelLevel: 18 | 19`;
- `kernelFamily: biological | molecular`;
- `projectionMode: DOMAIN_SEMANTIC_ADAPTER`;
- domain-native types and relations;
- graph invariants / validation.

Fiscal projections:
- L18: jurisdictions, rules, tax models, obligations, deadlines, professional-review gates.
- L19: invoices, invoice lines, payments, debts, assets, tax lots, disposals and return-line items.

This is intentionally honest: these projections participate in the COS multiplex profile without lying about biological or molecular ontology.

## Test coverage
`test-fiscal-operational-projections.ts` covers:
- call trace and duplicate rejection;
- all decision CFG builders;
- evidence lineage;
- integer-cent invoice/P&L/debt/reconciliation calculations;
- embedding nearest-neighbour retrieval;
- checkpoint chain;
- provider SPOF/fallback;
- counterparty sidecar semantics;
- L18/L19 domain-semantic adapter invariants.

## Stack
This PR is stacked on PR #75.

## Remaining architecture before `COS_20D_MOUNTED`
1. Integrated multi-level projector/status registry.
2. Persistence adapter + event replay equivalence.
3. GraphQL/GraphRAG integration against the unified projector.
4. zero-context recovery benchmark.
5. security/RBAC/sensitivity policy across queries/tools.
6. full CI + adversarial gauntlet.

Repository CI infrastructure is being repaired separately in PR #76 / issue #71.
