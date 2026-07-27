# Changelog

## [2.1.0] — 2026-07-27

### Added — Performance (Fase 1)

#### CSR Storage (T-1.1)
- `CSRGraph<N,E>` — compressed sparse row adjacency storage
- Bidirectional BFS, BFS, DFS with trace hooks
- Serialization to/from JSON, lazy rebuild
- 77 tests, 0 failures

#### Bidirectional Pruning (T-1.2)
- 7 pruning strategies: MaxDepth, Visited, TargetDirection, CostBound, Beam, Landmark, EarlyExit
- `PruningExecutor` — composable pipeline
- 70 tests, 0 failures

#### Benchmark Suite (T-1.3)
- `GraphGenerator` — 6 synthetic generators (chain, grid, social, random, tree, knowledge)
- `Measurer` — time, memory, warmup
- `BenchmarkRunner` — define, run, runAll, compare (7 benchmarks B1-B7)
- `ReportExporter` — toJSON, toMarkdown, toHTML
- 64 tests, 0 failures

### Added — WASM Acceleration (Fase 2)

#### AssemblyScript Pipeline (T-2.1)
- 4 WASM modules: CSR BFS, PageRank, Shortest Path, Betweenness Centrality
- `build/optimized.wasm` — 6.3KB
- `--exportRuntime` for memory management

#### WASM Loader (T-2.2)
- `createWASMModule`, `createJSFallback`, `WASMLoader`
- Pre-grow 64MB, 32MB user buffer
- Pure-JS fallback for all 4 functions

#### WASM Benchmarks (T-2.3)
- BFS Chain 10K: **2.34x** | BFS Grid: **1.60x**
- PageRank 5K: **2.65x** | Shortest Path 10K: **10.49x**
- Betweenness 1K: **5.94x**
- 23 tests, 0 failures

### Added — Telemetry & Observability (Fase 3)

#### Per-Hop Tracing (T-3.1)
- `TraceSession`, `TraceSessionImpl`, `NoopTraceSession` (zero-overhead singleton)
- `TraceHop`, `TraceSummary`, `formatTraceSummary`
- CSR hooks in bfs(), dfs(), bidirectionalBFS()
- 52 assertions, 0 failures

#### Trace Collector (T-3.2)
- `CircularBuffer`, `TraceCollectorImpl`, `NoopTraceCollector`
- `StoredTrace`, `mergeCollectorsExport`
- JSON compact/pretty/summary export
- 107 assertions, 0 failures

#### ProfilingHook (T-3.2b)
- `Profiler` class with Prometheus metrics export
- `ProfilingHook` interface + integration in CSRGraph + PruningExecutor
- 48 assertions, 0 failures

#### Telemetry Dashboard (T-3.3)
- `TelemetryDashboard` — built-in HTTP server (8 routes)
- `ExportService` — JSON, CSV, hops.csv export
- `OTLPExporter` — OpenTelemetry format
- 21 assertions, 0 failures

### Added — Web Visualization (Fase 4)

#### SVG Renderer (T-4.1)
- `ForceLayout` — Coulomb repulsion + Hooke attraction + cooling
- `SVGGraphRenderer` — 3 layouts: force, tree, radial
- Customizable: colors, size, labels, arrowheads, glow filter
- 49 assertions, 0 failures

#### Canvas Renderer (T-4.2)
- `QuadTree` — spatial index with auto-split, query culling
- `CanvasGraphRenderer` — zoom (0.1x-10x), pan, resize
- `RenderCommand` — serializable draw instructions
- 25 assertions, 0 failures

#### Web Component (T-4.3)
- `<cos-graph>` custom element with shadow DOM
- Observed attributes: layout, theme, interactive, width, height
- Interactive: zoom (wheel), pan (drag), focusNode, highlightPath
- exportSVG / exportPNG methods
- 16 assertions, 0 failures

### Added — Deployment & Operations (Fase 5)

#### Docker (T-5.1)
- Multi-stage Dockerfile (builder → runner)
- docker-compose.yml: cos-engine + Prometheus + Grafana
- `.dockerignore`, `config/prometheus.yml`, Grafana dashboards

#### Kubernetes (T-5.2)
- 9 manifests: namespace, SA/RBAC, configmap, deployment, service, HPA, ingress, kustomize
- 2-10 replicas, rolling update, liveness/readiness probes, anti-affinity

#### CI/CD (T-5.3)
- 12 parallel CI jobs, Docker build on main, GHA cache
- Deploy pipeline: docker → kubectl → rollout → smoke test
- Release pipeline: test → version bump → GitHub release

### Added — Ecosystem & DX (Fase 6)

#### npm Packages (T-6.1)
- `@cos/graph` — v2.1.0, CSR + pruning + benchmarks
- `@cos/observability` — v2.1.0, tracing + collector + profiler + dashboard
- `@cos/wasm` — v2.1.0, AssemblyScript WASM modules
- `@cos/visualization` — v2.1.0, SVG + Canvas + Web Component
- All packages: README, LICENSE, npm-ready package.json

#### API Docs (T-6.2)
- TypeDoc entry points for all 4 packages
- Landing page: `docs/API-REFERENCE.md`
- API docs at `docs/api/`

#### Release Automation (T-6.3)
- `npm run publish:all` — publish all 4 packages
- `npm run version:patch` — patch version bump
- Updated release workflow with multi-package support

### Tests
- **552 tests total** (77 CSR + 70 Pruning + 64 Benchmark + 23 WASM + 52 Tracing + 107 Collector + 48 Profiler + 21 Dashboard + 49 SVG + 25 Canvas + 16 Web Component)
- **0 failures** across all test suites
- Full regression: `npm run test:all`

### Package
- Name: `@cos/graph`, `@cos/observability`, `@cos/wasm`, `@cos/visualization`
- Version: `2.1.0`
- License: MIT
- Zero external dependencies
- Stack: Node 18+, TypeScript, AssemblyScript, tsx

## [2.0.0] — 2026-07-26

### Added — 20-level Architecture

#### Level 0: Visual Graph
- `VisualGraphEngine` — multi-renderer graph engine (Mermaid, Graphviz, ASCII, JSON)
- `MermaidRenderer` — flowchart rendering for Mermaid.js
- `GraphvizRenderer` — DOT-language rendering
- `ASCIITreeRenderer` — terminal-friendly tree visualization

#### Level 1: Execution Graph
- `ExecutionGraphEngine` — sequential and parallel node execution
- `ExecNode`, `ExecEdge` — typed graph elements with async execution
- Max concurrency control, error propagation, result tracking

#### Level 2: State Machine
- `StateMachine` — finite state machine with transitions, guards, and actions
- `Transition`, `Guard`, `Action` — declarative state management
- Entry/exit actions, state validation, cycle detection

#### Level 3: Dependency Resolver
- `DependencyResolver` — topological sort and dependency resolution
- Cycle detection, dependency graph building, tiered resolution

#### Level 4: Call Graph
- `CallGraphBuilder` — function call analysis with call sites
- `CallNode`, `CallEdge` — typed call graph with depth tracking

#### Level 5: Control Flow Graph
- `CFGBuilder` — control flow analysis with branches and merges
- `BasicBlock`, `CFGEdge` — structured CFG with conditional paths

#### Level 6: Data Flow Graph
- `DataFlowGraph` — data flow analysis with variable definitions and uses
- `DataFlowNode`, `DataFlowEdge` — typed data flow with context

#### Level 7: Computational Graph
- `ComputationalGraph` — neural network computation graph
- `MLP` — multi-layer perceptron with forward/backward propagation
- Matrix operations, activation functions, gradient computation

#### Level 8: Knowledge Graph
- `KnowledgeGraphEngine` — entity-relationship knowledge graph
- `KGEntity`, `KGRelation` — typed entities and relations
- SPARQL-like query support, transitive inference, similarity search

#### Level 9: Semantic Graph
- `SemanticGraph` — semantic analysis with cosine similarity
- `SemanticNode`, `SemanticEdge` — typed semantic relationships

#### Level 10: Embedding Graph
- `EmbeddingGraph` — vector embedding storage and retrieval
- Cosine distance, nearest neighbor search, embedding operations

#### Level 11: GraphRAG
- `GraphRAGEngine` — retrieval-augmented generation with graph indices
- Chunk-based indexing, semantic search, context retrieval

#### Level 12: Memory Graph
- `MemoryGraphEngine` — multi-layer memory with consolidation
- Working, short-term, long-term memory layers
- Consolidation, decay, and retrieval operations

#### Level 13: Agent Graph
- `AgentGraphEngine` — autonomous agent orchestration
- Agent planning, execution, and monitoring
- Tool-calling, sub-agent delegation, state management

#### Level 14: Tool Graph
- `ToolGraphEngine` — executable tool registry
- Parameterized tools with type validation
- Execution pipeline, error handling, result caching

#### Level 15: Workflow Graph
- `WorkflowGraphEngine` — multi-step workflow execution
- Sequential and parallel step execution
- Conditional branching, retry policies, timeout control

#### Level 16: Network Graph
- `NetworkGraphEngine` — network topology with metrics
- Centrality, clustering coefficient, path analysis
- Network flow, diameter, and connectivity metrics

#### Level 17: Social Graph
- `SocialGraphEngine` — social network influence analysis
- Influence propagation, community detection
- PageRank, betweenness centrality, recommendation

#### Level 18: Biological Graph
- `BiologicalGraphEngine` — biological pathway analysis
- Metabolic pathway tracing, protein interaction networks
- Gene ontology enrichment, pathway visualization

#### Level 19: Molecular Graph
- `MolecularGraphEngine` — molecular structure analysis
- Atomic bond graphs, substructure matching
- Molecular fingerprinting, property prediction

### Added — Cross-cutting Features

#### Security (Fase 10)
- `SecurityManager` — RBAC, encryption, audit logging, input validation
- 52 tests, 0 failures

#### i18n (Fase 11)
- `I18nManager` — 5 locales (en, es, fr, de, zh)
- Localized exceptions, level descriptions, CLI messages
- 61 tests, 0 failures

#### Plugins & Marketplace (Fase 12)
- `PluginRegistry` — 15 lifecycle hooks, 5 built-in format plugins
- `PluginMarketplace` — 21 community plugins
- 86 tests, 0 failures

#### WebAssembly (Fase 13)
- `WASMRuntime` — simulated execution with 10x speedup
- `WASMSDK` — 3 language bindings (JS, Python, Rust)
- 95 tests, 0 failures

#### GraphQL API (Fase 14)
- `GQLEngine` — zero-dependency GraphQL execution
- 26 resolvers, pagination, batch, multi-level queries
- 120 tests, 0 failures

#### ML Integration (Fase 15)
- `EmbeddingClassifier` — embedding-based classification
- `GraphRAGNeuralReRanker` — neural re-ranking
- `GCNLayer`, `GCN`, `GCNPipeline` — graph convolutional networks
- `AutoMLPipeline` — ArchitectureSearch, HyperParameterOptimizer
- 143 tests, 0 failures

#### Streaming & Real-time (Fase 16)
- `GraphStream` — WebSocket-like streaming API
- `Observable<T>` — reactive observation pattern
- `GraphObserver` — node/edge/state change events
- `SubscriptionManager` — subscription groups with topics
- 126 tests, 0 failures

#### Persistence & Scalability (Fase 17)
- `ConsistentHash`, `GraphShard`, `ShardManager` — 3 sharding strategies
- `MultiLevelCache` — L1 (LRU) → L2 (TTL) → L3 (serialized)
- `MasterSlaveReplication` — write master, read slaves
- `MultiMasterReplication` — gossip sync, 3 conflict strategies
- 185 tests, 0 failures

#### DX & Tools (Fase 18)
- `LevelPlayground` — REPL for each level (12 commands)
- `PlaygroundSession` — multi-level session with history
- `TutorialRegistry` — 20 tutorials (3 steps each)
- `TutorialRunner` — interactive step-by-step guidance
- 222 tests, 0 failures

#### Standardization (Fase 19)
- `GraphConverter` — 6 format converters (GraphML, GEXF, GDF, JSON, CSV, DOT)
- Cross-format conversion: `cos graph convert input.gml output.dot`
- `CypherEngine` — Cypher-style query execution on L8-L11
- Cypher parser with MATCH, WHERE, RETURN, LIMIT support
- 118 tests, 0 failures

### Fixed
- Cross-entropy double-exp bug: `Math.exp()` applied to already-exponentiated values
- L7 buildMLP restructured for 2 logits (single-logit cross_entropy always gives loss=0)
- 14 refactorer inconsistencies mapped to real issues
- All 20 level class names corrected for consistency

### Performance
- WASM: 10x simulated speedup over JS
- MultiLevelCache: 3-tier caching with auto-promotion
- Sharding: 3 strategies (hash, range, modulo)
- Replication: master-slave and multi-master with gossip sync

### Tests
- **1068 tests total** (154 core + 120 GraphQL + 143 ML + 126 Streaming + 185 Persistence + 222 Playground + 118 Standardization)
- **0 failures** across all test suites
- Full regression suite: `npm run test:all`

### Package
- Name: `@cos/graph`
- Version: `2.0.0`
- License: MIT
- Zero external dependencies except: none
- Stack: Node 18+, TypeScript, tsx

## [1.1.0] — 2026-06-xx

### Added
- CLI unified `cos graph` command
- Web Visualizer
- Initial pipelines L4→L19
- CI/CD pipeline
- Benchmark suite (225 measurements)

## [1.0.0] — 2026-06-xx

### Added
- Initial 3-level architecture (L0 Visual, L1 Execution, L2 State)
- SMB integration
- Basic CLI
- First 418 tests