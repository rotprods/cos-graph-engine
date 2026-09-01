# Fiscal L13/L14/L15 Runtime + External Adapter Contract — PR-E

## Native COS ownership
The canonical orchestration runtime is COS:
- L13 Agent Graph owns roles/delegation/review/approval topology.
- L14 Tool Graph owns capabilities/routing/fallbacks.
- L15 Workflow Graph owns executable recovery/close flow structure.

LangChain, LangGraph, CrewAI, OpenAI Agents SDK and MCP are interoperability adapters only.

## L13 Fiscal organization
The runtime projects specialist roles:
- Mission Commander
- Evidence Collector
- Entity Resolver
- Accountant Reconciler
- Tax Researcher
- Crypto Tax-Lot Analyst
- Independent QA Reviewer
- Human Tax Adviser Gate
- Owner Approval Gate

Human-only gates are explicit nodes with `HUMAN_ONLY` capability and may not be bypassed by framework adapters.

## L14 Tool fabric
`FiscalToolFabric` wraps native `ToolGraphEngine` with domain policy:
- capability;
- read/write class;
- sensitivity;
- authority class;
- health;
- schema hash/permission scope metadata;
- latency/cost/rate limit;
- fallback.

Write operations require explicit human write approval. Unavailable authority tools cannot be selected. Restricted tools cannot be used under a lower-sensitivity context.

Seed tools:
- Gmail
- Google Drive
- GitHub
- Local Fiscal DB
- Web Research
- future AEAT Authority Source (disabled/unavailable until actually connected)
- future TGSS Authority Source (disabled/unavailable until actually connected)

## L15 Workflows
Four source-agnostic workflow graphs are defined:

### Authority Truth
request/arrival -> ingest -> classify -> authority validation -> append event -> rebuild projections -> checkpoint / quarantine.

### Invoice Close
invoice/charge observed -> identity resolution -> tax classification -> bank match -> evidence gate -> quarter/fact event or missing-evidence task.

### Quarterly Close
internal close trigger -> freeze -> reconcile -> deterministic compute -> independent QA -> human adviser -> owner approval -> filing action -> receipt ingest -> checkpoint.

### Global Crypto FIFO
provider inventory -> completeness gate -> ingest -> transfer/disposal classification -> global FIFO compute -> balance reconciliation -> persist or block final result.

## External framework adapters
Dependency-free adapters normalize external definitions/runs without importing those frameworks into COS core.

Supported adapter identities:
- LangChain
- LangGraph
- CrewAI
- OpenAI Agents SDK
- MCP

Every external run becomes:

```ts
{
  sourceClass: 'EXTERNAL_RUNTIME_OBSERVATION',
  canonicalTruth: false,
  requiresValidation: true
}
```

Therefore external framework memory/task/output can be useful execution context but can never directly become fiscal truth.

## Tests
The runtime test suite asserts:
- all agent/tool/workflow graphs validate;
- human gates exist;
- write without human approval is denied;
- unavailable authority tools are denied;
- sensitivity limits are enforced;
- CrewAI definitions can be imported without dependency;
- external run result stays non-canonical;
- one adapter cannot ingest another framework's run envelope.

## Stack
This PR is stacked on PR-D / `feat/fiscal-authority-graphrag`.

## CI
Keep draft while issue #71 prevents repository CI from reaching tests.
