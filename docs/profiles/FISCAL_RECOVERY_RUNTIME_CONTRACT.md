# Fiscal Recovery Runtime Contract — PR-B

This slice turns the fiscal recovery backlog from documentation into COS runtime primitives without migrating private evidence.

## Added

### Append-only fiscal events
`FiscalEventStore` provides:
- sequence numbers;
- SHA-256 event hashes;
- previous-event hash chaining;
- temporal context (`eventTime`, `observedAt`, `validFrom`, `filedAt`, `paidAt`, ...);
- source authority;
- certainty;
- evidence IDs;
- checkpoint hash;
- replay/verification from JSON.

This is the first event-sourcing primitive for rebuilding fiscal projections deterministically.

### Canonical identity registry
`FiscalIdentityRegistry` prevents raw filenames/display labels from becoming identity. It supports namespace-scoped aliases and rejects alias collisions.

### L1/L3 recovery projection
`projectFiscalRecoveryTasks()` compiles one durable backlog into:
- L1 `ExecutionGraphEngine` where blocker → task expresses execution order;
- L3 `DependencyResolver` where task → blocker follows COS `depends_on` semantics.

Unknown blockers and dependency cycles are rejected.

### L2 fiscal lifecycle policy
State machines exist for:
- evidence;
- filing;
- payment;
- invoice.

A domain policy wrapper prevents unsafe transitions.

Examples:
- `PREPARED -> FILED` requires official/filed-return evidence + filing receipt flag;
- payment cannot become `PAID` from an adviser letter alone;
- `NOT_FILED` requires authority evidence;
- rectification/annulment requires rectification evidence.

## Intentional boundaries

- This PR does not fetch AEAT/TGSS.
- It does not migrate personal evidence.
- It does not calculate tax.
- It does not add GraphQL/GraphRAG resolvers yet.
- It does not make LangChain/CrewAI canonical runtime dependencies.

## Acceptance

`test-fiscal-recovery-runtime.ts` covers:
- event hash-chain validation and replay;
- alias collision rejection;
- L1/L3 projection order;
- filing promotion rejection from derived evidence;
- payment promotion rejection from non-payment correspondence;
- successful promotion from qualifying evidence.

CI is currently blocked repository-wide by the pre-existing workflow root-path issue tracked in #71; therefore this PR must remain draft until the infrastructure gate is fixed and tests execute in Actions.
