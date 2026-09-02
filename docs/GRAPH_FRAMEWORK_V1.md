# COS Graph Framework — Protocol & Runtime V1

Status: architecture slice 1 / pre-public API
Protocol: `cos.graph/v1alpha1`

## North Star

`@cos/graph` becomes a graph-engineering framework rather than a barrel of unrelated graph subsystems.
The framework must make heterogeneous graph algorithms, stores, projections, GraphRAG systems,
agent runtimes, distributed backends and external graph products interoperable through one explicit,
inspectable and testable protocol.

The design target is not “more features than every graph library.” The target is a stable control plane
that lets specialized implementations compete underneath common contracts without creating another
source of truth.

## Design principles

1. **Protocol before implementation.** Algorithms and adapters implement a small stable contract.
2. **Schemas at every boundary.** Capability inputs and outputs are runtime-validated through the tiny
   `GraphSchema<T>` interface. Zod, Valibot, JSON Schema adapters or custom validators can satisfy it
   without becoming kernel dependencies.
3. **Explicit capability metadata.** Every operation declares maturity, supported execution modes,
   determinism, side effects and idempotency semantics.
4. **Fail-closed side effects.** `mutate`, `write`, graph-mutating and external operations require an
   execution policy. Read-only operations remain low-friction.
5. **Typed and dynamic invocation.** Code that owns a capability object gets typed invocation; remote,
   plugin and configuration-driven systems can use capability IDs with runtime validation.
6. **Transactional registration.** A module cannot partially enter the registry. Missing dependencies,
   duplicate capabilities and invalid manifests fail before registration.
7. **No hidden global state.** Each `GraphRuntime` owns an explicit registry and policy surface.
8. **Receipts over claims.** Successful execution emits a structured receipt containing module,
   capability, protocol, mode, graph reference, determinism, side-effect class and timing.
9. **Observability must not corrupt side effects.** Observer failures become diagnostics; they do not
   turn an already-successful write into a false application failure that could be retried blindly.
10. **Conformance is executable.** Third-party modules can be mechanically checked before installation.

## Initial public concepts

```text
GraphRuntime
  ├─ GraphRegistry
  │   ├─ GraphModuleManifest
  │   └─ GraphCapabilityDescriptor
  ├─ GraphExecutionPolicy
  ├─ GraphRuntimeObserver[]
  └─ invoke(...)
       ├─ schema validation
       ├─ execution-mode gate
       ├─ cancellation gate
       ├─ idempotency declaration gate
       ├─ policy authorization
       ├─ capability execution
       ├─ receipt
       └─ diagnostics
```

A module is a deployable unit of graph behavior. A capability is the smallest invokable graph behavior.
This lets CSR/WASM algorithms, GraphRAG, a Neo4j adapter, a temporal store, an agent graph and a future
Rust kernel all coexist without being coupled to one monolithic class hierarchy.

## Execution modes

COS standardizes four execution intents:

- `stream` — return/stream computed data without mutation.
- `stats` — return aggregate or diagnostic results without mutation.
- `mutate` — mutate a projected/in-memory graph or graph workspace.
- `write` — persist or emit a side effect outside the current graph workspace.

The semantic distinction is part of the protocol, not just naming. Capability descriptors must state
which modes they support and the runtime rejects undeclared modes.

## Maturity tiers

Every module and capability declares one of:

- `experimental` — API may change; no compatibility promise.
- `preview` — intended shape is stabilizing; migration notes required on breaking changes.
- `stable` — production API; semantic compatibility and conformance tests are release gates.

Nothing reaches `stable` because a README says so. Promotion requires evidence.

## Intended package surface

The current `packages/graph/src/index.ts` exports nearly every internal subsystem. That is not a stable
framework boundary. The target package layout is explicit subpath APIs:

```text
@cos/graph                 high-level framework facade
@cos/graph/protocol        stable contracts and conformance
@cos/graph/runtime         registry, policy, execution, receipts
@cos/graph/algorithms      portable algorithm capabilities
@cos/graph/query           query operators and planners
@cos/graph/rag             GraphRAG contracts
@cos/graph/agents          agent/workflow graph contracts
@cos/graph/distributed     sharding, replication, streaming
@cos/graph/observability   traces, metrics, graph execution evidence
@cos/graph/adapters/*      Neo4j, NetworkX, LangGraph, GraphQL, MCP, etc.
```

This slice intentionally does **not** modify the legacy root barrel yet. The strict-typecheck remediation
lane is active in parallel. Public export migration happens only after that lane converges, avoiding an
unreviewable cross-cutting merge.

## Interoperability strategy

External frameworks are adapters, never the canonical state model.

- LangGraph-compatible runtimes can map nodes/edges/checkpoints onto COS capabilities and receipts.
- LangChain-style provider integrations can map tools/models without owning graph state.
- Neo4j can serve as a graph store/compute backend through capability modules while COS retains the
  protocol, execution evidence and policy boundary.
- NetworkX/rustworkx/petgraph/GraphBLAS implementations can compete as algorithm backends behind the
  same capability descriptors and conformance tests.
- MCP/OpenAI Agents/CrewAI integrations remain edge adapters.

## Enterprise trajectory

A framework capable of unifying decisions across multiple companies or large organizations needs more
than graph traversal. The subsequent architecture layers are:

1. canonical typed graph schema and schema evolution;
2. bitemporal/event-sourced graph state and deterministic replay;
3. graph transactions, optimistic concurrency and idempotency providers;
4. provenance/evidence/authority as first-class edge and artifact metadata;
5. policy/RBAC/ABAC and tenant/organization isolation;
6. durable execution, checkpoints, resumability and human approval interrupts;
7. federated graph catalogs and cross-graph query planning;
8. distributed compute backends and resource budgets;
9. GraphRAG/reasoning/decision modules with evidence-linked outputs;
10. language-neutral protocol and conformance suites, followed by Rust/Python/TS SDK parity.

## Certification gates for Protocol V1

This protocol slice may move from `v1alpha1` only when:

- targeted strict typecheck is green;
- conformance/runtime suite is green;
- no capability can bypass declared execution modes;
- side-effecting operations fail closed without policy;
- invalid module registration is atomic;
- typed and ID-based invocation produce equivalent validated outputs;
- observer failure semantics are regression-tested;
- lifecycle/dependency behavior is regression-tested;
- public API review eliminates unnecessary abstractions;
- adapters prove at least two heterogeneous backends can satisfy the same capability contract.

## Anti-overengineering boundary

This slice deliberately does not add a DI container, reflection system, decorator DSL, custom schema
language, semver solver, distributed registry, network protocol, persistent idempotency store or new
runtime dependency. Those enter only when a production use case proves the need.
