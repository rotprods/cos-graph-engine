# COS Graph Engine — 20 Graph Entity Map

> Recovery note: this document preserves the useful architecture map from historical donor `4e938da718fe26007b25e7317836b6c06ebe7242` after reconciling it against executable W3 authority. It is descriptive documentation, not a second source of runtime truth.

## Authority

Executable source outranks this document.

Reconciliation inputs:

- W3.2 source authority: `e3e198ce01e576d30ac89b3760a52f2d8461d781`
- qualified recovery lineage used for this documentation slice: `581aaf187a66a42984447eb1cfda6d28c6fcfd80`
- historical donor: `4e938da718fe26007b25e7317836b6c06ebe7242`

`CURRENT` means the donor description remains materially faithful to current source. `UPDATE` means the level/capability exists, but the donor's topology, pseudo-schema, examples, or scope were too specific or stale and are replaced below by a source-derived description. `REJECT` would mean the historical level description has no supported current counterpart.

## Reconciled L0–L19 map

| Level | Current entity | Classification | Source-derived responsibility |
|---|---|---|---|
| L0 | Visual Graph | UPDATE | Visual graph model plus Mermaid, Graphviz, ASCII and JSON rendering/serialization. Historical dimensional/style claims are not runtime contracts. |
| L1 | Execution Graph | CURRENT | Executable DAG planning/running with node results, conditions, retries, concurrency and execution context. |
| L2 | State Graph | CURRENT | Finite-state-machine model with states, transitions, guards, actions, history and timeout handling. |
| L3 | Dependency Graph | CURRENT | Dependency representation and resolution with explicit `source -> target` = `source depends on target`, topological ordering and cycle analysis. |
| L4 | Call Graph | CURRENT | Call relationships for dynamic/static call analysis, tracing/profiling-oriented metadata and graph mutation. |
| L5 | Control Flow Graph | CURRENT | Basic blocks, branches, loops, merge points, dominator/control-flow analysis and explicit CFG edges. |
| L6 | Data Flow Graph | CURRENT | Sources/transforms/sinks, data-shape and throughput/latency metadata, pipeline modeling and bottleneck-oriented analysis. |
| L7 | Computational Graph | CURRENT | Mathematical operation graph with forward/backward execution, gradients, tensor-shape metadata and model/expression construction. |
| L8 | Knowledge Graph | CURRENT | Entities/relations, ontology-style relations, SPARQL-shaped queries, graph metrics and transitive/inference-oriented operations. |
| L9 | Semantic Graph | UPDATE | Taxonomies, semantic relations, hypernym/LCA-style structure and semantic similarity. Historical WordNet-style topology/property sketches are illustrative only. |
| L10 | Embedding Graph | UPDATE | Vector nodes with distance/cosine similarity, KNN/epsilon graph construction and K-means-style clustering. The historical `complete weighted` topology is not the canonical behavior. |
| L11 | GraphRAG | UPDATE | Hybrid retrieval combining vector similarity, graph/KG traversal and reranking over chunks/entities/relations. Historical pseudo-schema is non-contractual. |
| L12 | Memory Graph | UPDATE | Persistent/associative memory graph, conversation structures, recall, forgetting/consolidation, serialization and graph validation. It is broader than the donor's episodic-buffer sketch. |
| L13 | Agent Graph | UPDATE | Multi-agent roles, delegation chains, capabilities and capability search. Historical agent-message properties are not the canonical schema. |
| L14 | Tool Graph | UPDATE | Tool ecosystem graph for capability discovery, routing and fallback relationships. Historical cost/rate pseudo-fields are not guaranteed by this level contract. |
| L15 | Workflow Graph | UPDATE | Automation graph with triggers, actions, conditions and retry behavior. It is not defined merely as a generic state-machine DAG. |
| L16 | Network Graph | UPDATE | Infrastructure/network topology with routing/shortest-path and health-monitoring-oriented behavior. Historical `scale-free` topology is not a required invariant. |
| L17 | Social Graph | CURRENT | Social relations, influence/recommendation structure and mutual-friend/community-style analysis. |
| L18 | Biological Graph | UPDATE | Biological networks including neural circuits, protein relationships and synaptic-firing-oriented simulation. Historical PPI-only framing was incomplete. |
| L19 | Molecular Graph | UPDATE | Molecular atoms/bonds with drug-discovery-oriented fingerprints, bond/ring analysis and 3D conformer-related behavior. Historical property sketches are illustrative only. |

No L0–L19 level is classified `REJECT`: all twenty level identities have executable counterparts in `packages/graph/src/level*.ts`. The reconciliation rejects stale *claims inside descriptions*, not the levels themselves.

## Navigation clusters

The historical grouping remains useful as a non-contractual navigation aid:

- **Foundation — L0–L5:** visual, execution, state, dependency, call and control-flow graphs.
- **Compute — L6–L7:** data-flow and computational graphs.
- **Knowledge — L8–L11:** knowledge, semantic, embedding and GraphRAG graphs.
- **Agency — L12–L15:** memory, agent, tool and workflow graphs.
- **Natural / networked systems — L16–L19:** network, social, biological and molecular graphs.

These clusters do not imply inheritance, mandatory data flow, shared persistence, or automatic cross-level connectivity.

## Shared Memory Bus — current supported boundary

A Shared Memory Bus **does exist** in current source at `packages/graph/src/smb.ts`.

Its current implementation combines:

- `@cos/runtime` `EventBus` for publish/subscribe;
- `@cos/memory` `MemoryManager` for graph-state persistence/retrieval;
- a private in-process `graphIndex: Map<string, Set<EntityId>>` used to track saved graph snapshot IDs by key.

Explicit adapters currently present in the graph package are:

- `packages/graph/src/level7-smb.ts` — `SMBComputeGraph`, wrapping L7 computational graphs with SMB events and save/load;
- `packages/graph/src/level12-smb.ts` — `SMBMemoryGraph`, wrapping L12 memory graphs with SMB events and save/load.

### Claims preserved

- SMB can publish and subscribe to events.
- SMB can persist and retrieve graph snapshots through `MemoryManager`.
- SMB maintains an internal key-to-snapshot-ID index for states saved through `saveGraph`.
- L7 and L12 have explicit SMB integration wrappers.

### Historical claims rejected or narrowed

The donor stated that all twenty entities connect through one SMB and described `GraphIndex` and `Cross-entity queries` as universal services. Current source does **not** support those claims at that strength.

Therefore:

- **REJECT:** "L0–L19 are all connected through SMB" as a current architectural guarantee.
- **NARROW:** `GraphIndex` means the private saved-snapshot index implemented inside `SMB`; it is not demonstrated to be a global registry of every active graph instance.
- **REJECT:** a generic cross-entity-query API spanning all levels; no such universal API is established by the reconciled source.
- **REJECT:** automatic persistence/event publication for every graph level; only explicit adapters or callers that invoke SMB can claim that behavior.

For concrete SMB API usage and the implemented L7/L12 adapters, see `docs/SMB-INTEGRATION.md`; executable source remains authoritative if that document diverges.

## Recovery disposition

Historical donor `feature/20-graph-entities` is a documentation-only delta. Its useful unique value is preserved here without cherry-picking the donor commit or modifying `AGENTS.md`.

Disposition:

- twenty-level architecture identity: `PRESENT_EQUIVALENT`, documented here from current source;
- historical topology/property pseudo-schemas: `SUPERSEDED_BY_CURRENT_SOURCE` where marked `UPDATE`;
- navigation clusters: `EVIDENCE_ONLY / DOCUMENTATION_AID`;
- universal SMB claim: `CHANGED_INTENTIONALLY / NARROWED_TO_IMPLEMENTED_BOUNDARY`;
- donor `AGENTS.md` document-index mutation: `SUPERSEDED_CONTROL_PLANE`, not ported.

This recovery slice changes no product/runtime behavior.