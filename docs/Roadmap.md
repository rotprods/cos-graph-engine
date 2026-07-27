# COS Implementation Roadmap

## Dependency Order

```
Phase 0: Foundation
    └── Phase 1: MVP Runtime
            ├── Phase 2a: Memory System
            │       └── Phase 2b: Knowledge Layer
            │               └── Phase 3: Cognition
            │                       └── Phase 4: Execution & Orchestration
            │                               └── Phase 5: Production Systems
            │                                       └── Phase 6: Self-Improvement
            └───────────────────────────────────────────────────────────────┘
                                       (everything depends on runtime)
```

## Phase 0: Foundation

**Goal:** Core types, interfaces, error system — the language of the system.

**Dependencies:** None

**Deliverables:**

| Component | Files | Lines (est.) | Verification |
|-----------|-------|-------------|--------------|
| Core types (EntityId, CogEvent, CogCell, MemoryEntry, GraphNode...) | `core/src/types.ts` | 800 | Compiles, all types exported |
| Error system (CellError, ValidationError, TimeoutError, PermissionDenied...) | `core/src/errors.ts` | 150 | All errors constructible and serializable |
| CogCell base class (lifecycle, state, process, inspect) | `core/src/cell.ts` | 350 | Can instantiate, lifecycle transitions work |
| Core index | `core/src/index.ts` | 10 | All symbols exported |

**Acceptance Criteria:**
- `BaseCell` can be instantiated with a definition
- Cell lifecycle transitions are valid (`created → initializing → ready → running → terminated`)
- `process()` returns a valid `CellOutput`
- All error types can be constructed and round-trip through JSON

**Tests:** `core/tests/types.test.ts`, `core/tests/errors.test.ts`, `core/tests/cell.test.ts`

**Duration:** 1 sprint

---

## Phase 1: MVP Runtime

**Goal:** A running system with EventBus, Scheduler, CellHost, and at least one working cell.

**Dependencies:** Phase 0

**Deliverables:**

| Component | Files | Lines (est.) | Verification |
|-----------|-------|-------------|--------------|
| EventBus (publish, subscribe, unsubscribe, history, wildcard) | `runtime/src/eventbus.ts` | 250 | Events publish and deliver to correct subscribers |
| Scheduler (queue, dequeue, complete, fail, cancel, stats, retry) | `runtime/src/scheduler.ts` | 400 | Tasks execute, retry on failure, stats are accurate |
| StateManager (get, set, update, snapshot history, versioning) | `runtime/src/state.ts` | 200 | State transitions are immutable, history replayable |
| CellHost (register, start, shutdown, health, inspect, scheduler integration) | `runtime/src/cellhost.ts` | 350 | Cells register, lifecycle works, scheduler processes tasks |
| MVP Bootstrap (creates one cognitive cell, registers it, starts host, processes input) | `deployment/src/bootstrap.ts` | 200 | System boots, processes a trivial input, produces output |
| Runtime index | `runtime/src/index.ts` | 10 | All symbols exported |

**Acceptance Criteria:**
- `cellhost.start()` and `cellhost.shutdown()` work cleanly
- Two cells can communicate via EventBus
- Scheduler processes at least 100 tasks with retries
- StateManager snapshots are recoverable
- System boots, processes an input, returns output in < 100ms
- `CellInspection` shows all fields populated

**Tests:** `runtime/tests/eventbus.test.ts`, `runtime/tests/scheduler.test.ts`, `runtime/tests/state.test.ts`, `runtime/tests/cellhost.test.ts`

**Integration Test:** Boot COS → process 5 inputs → verify all events, state transitions, and metrics

**Duration:** 2 sprints

**MVP Milestone:** End-to-end system boots and processes input through a cell.

---

## Phase 2a: Memory System

**Goal:** 12-layer memory with TTL, consolidation, forgetting, cross-linking.

**Dependencies:** Phase 1

**Deliverables:**

| Component | Files | Lines (est.) | Verification |
|-----------|-------|-------------|--------------|
| IMemoryStore interface & InMemoryStore (indexed by layer, tag, TTL sweep) | `memory/src/memory-manager.ts` | 500 | All 4 CRUD operations work, TTL sweeper deletes expired |
| MemoryManager (store with auto-importance, query, consolidate, forget, cross-link) | (same file) | 400 | Consolidation promotes high-importance entries; forgetting clears low-importance |
| Memory integration test (store → retrieve → consolidate → cross-link → forget → stats) | `memory/tests/memory.test.ts` | 200 | Full lifecycle works end-to-end |

**Acceptance Criteria:**
- All 12 layers are queryable independently
- TTL sweep deletes expired entries within 60s
- Consolidation moves entries with importance ≥ 0.7 from short-term to long-term
- Forgetting removes entries with importance < 0.2 and age > 7d
- Cross-linking creates bidirectional references
- Memory stats returns accurate counts per layer

**Tests:** `memory/tests/memory-manager.test.ts`

**Duration:** 2 sprints

---

## Phase 2b: Knowledge Layer

**Goal:** Property graph, knowledge graph, embedding system, ontology.

**Dependencies:** Phase 1

**Deliverables:**

| Component | Files | Lines (est.) | Verification |
|-----------|-------|-------------|--------------|
| PropertyGraph (addNode/Edge, query, traverse, stats) | `knowledge/src/property-graph.ts` | 500 | Graphs can be built and traversed bidirectionally |
| KnowledgeGraph (addStatement, query, getRelated, ensureNode) | `knowledge/src/knowledge-graph.ts` | 200 | Statements become graph edges, relationships traversable |
| EmbeddingSystem (store, search by cosine similarity, text-to-embedding hashing) | `knowledge/src/embedding.ts` | 250 | Embeddings stored, similarity search returns ranked results |
| OntologySystem (defineClass, defineRelation, validate, hierarchy) | `knowledge/src/ontology.ts` | 300 | Classes have inheritance, validation catches type errors |
| Knowledge integration test | `knowledge/tests/knowledge.test.ts` | 200 | Full stack works: define ontology → store knowledge → traverse → validate |

**Acceptance Criteria:**
- Graph supports 10,000+ nodes and 50,000+ edges
- Bidirectional traversal works at depth 5+
- Embedding search returns results ordered by cosine similarity
- Ontology validation catches type mismatches on required properties

**Tests:** `knowledge/tests/property-graph.test.ts`, `knowledge/tests/knowledge-graph.test.ts`, `knowledge/tests/embedding.test.ts`, `knowledge/tests/ontology.test.ts`

**Duration:** 2 sprints

---

## Phase 3: Cognition

**Goal:** Working reasoning engines, planning, evaluation, and learning.

**Dependencies:** Phase 1 (standalone reasoning may not need memory/knowledge yet)

**Deliverables:**

| Component | Files | Lines (est.) | Verification |
|-----------|-------|-------------|--------------|
| ChainOfThoughtEngine (decompose problem, N steps, confidence scoring) | `cognition/src/reasoning.ts` | 300 | Produces N steps with monotonic confidence |
| TreeOfThoughtsEngine (branch, beam search, depth-limited, value scoring) | (same file) | 400 | Explores multiple paths, selects best by beam |
| ReflectionEngine (self-critique on N aspects, scores, improvement text) | (same file) | 250 | Scores N aspects, generates improvement text |
| ReasoningEngineRegistry (register, get, reason, getCapabilities) | (same file) | 100 | All engines registered, dispatch works |
| PlanningEngine (createPlan, executePlan, topological execution) | `cognition/src/planning.ts` | 350 | Plan created from goal, executed in dependency order |
| EvaluationSystem (evaluate on N criteria, overall score, strengths/weaknesses) | `cognition/src/evaluation.ts` | 200 | Produces structured evaluation from any input |
| LearningSystem (recordExample, addFeedback, getPatterns) | `cognition/src/learning.ts` | 250 | Examples recorded, patterns extracted from feedback |
| Cognition index | `cognition/src/index.ts` | 10 | All symbols exported |

**Acceptance Criteria:**
- CoT produces N=5 steps with increasing confidence
- ToT explores at least 3 branches at depth 3 with beam width 2
- Reflection scores at least 5 quality aspects
- Planning creates a plan from a goal string and executes all steps
- Evaluation produces scores for any criteria list
- Learning patterns are extractable after 10+ feedback examples

**Tests:** `cognition/tests/reasoning.test.ts`, `cognition/tests/planning.test.ts`, `cognition/tests/evaluation.test.ts`, `cognition/tests/learning.test.ts`

**Duration:** 3 sprints

---

## Phase 4: Execution & Orchestration

**Goal:** Tool system, code sandbox, multi-agent orchestration, workflow engine, policy engine.

**Dependencies:** Phase 1 (can be built in parallel with Phases 2-3)

**Deliverables:**

| Component | Files | Lines (est.) | Verification |
|-----------|-------|-------------|--------------|
| ToolRegistry (register, get, execute, getDefinitions) | `execution/src/tool-runtime.ts` | 150 | Tools are registered and callable |
| FileSystemTool (read, write, delete, list, exists) | (same file) | 200 | All 5 operations work |
| HTTPTool (GET/POST/PUT/DELETE, headers, body, timeout) | (same file) | 200 | Requests return structured responses |
| SearchTool (query, source filter, limit) | (same file) | 100 | Returns structured search results |
| CodeSandbox (execute JS, timeout, memory limits, output capture) | `execution/src/sandbox.ts` | 250 | JavaScript executes in sandbox, timeout enforced |
| AgentSystem (defineAgent, executeAgent, registerCell) | `orchestration/src/agent-system.ts` | 250 | Agent composed of cells, executes sequentially |
| WorkflowEngine (define, execute, step handlers, human approval gates) | `orchestration/src/workflow.ts` | 350 | Workflows execute in topological order, human approval pauses |
| PolicyEngine (addRule, evaluate, conditions, priority matching) | `orchestration/src/policy.ts` | 250 | Rules evaluated by priority, conditions filter context |
| Execution plus orchestration integration test | `execution/tests/tool-runtime.test.ts`, `orchestration/tests/agent.test.ts` | 300 | Full flow: tool → cell → agent → workflow |

**Acceptance Criteria:**
- All built-in tools execute and return valid ToolResult
- Code sandbox executes JavaScript and captures stdout
- Agent can compose 3+ cells and execute sequentially
- Workflow with 5+ steps executes with dependency ordering
- Human approval gate pauses workflow, external resume continues
- Policy engine evaluates allow/deny/require_approval correctly
- Policy priority determines result when multiple rules match

**Tests:** `execution/tests/tool-runtime.test.ts`, `execution/tests/sandbox.test.ts`, `orchestration/tests/agent-system.test.ts`, `orchestration/tests/workflow.test.ts`, `orchestration/tests/policy.test.ts`

**Duration:** 3 sprints

---

## Phase 5: Production Systems

**Goal:** API server, storage adapters, auth, deployment, observability dashboard.

**Dependencies:** Phases 1-4

**Deliverables:**

| Component | Files | Lines (est.) | Verification |
|-----------|-------|-------------|--------------|
| Storage adapters (PostgreSQL, Redis, Qdrant, Neo4j) | `infrastructure/src/` | 800 | Each adapter passes the IStorageAdapter contract |
| TelemetrySystem (event recording, metric recording, query, export) | `observability/src/telemetry.ts` | 200 | Events and metrics recorded and queryable |
| COSServer (all subsystems wired, process, health, stats endpoints) | `api/src/server.ts` | 350 | All subsystems initialized, process routes to correct subsystem |
| Auth middleware (JWT verification, API key validation, RBAC) | `api/src/auth.ts` | 200 | Requests authenticated, policies enforced |
| Configuration system (layered: defaults → env → file → runtime) | `infrastructure/src/config.ts` | 250 | All sources merged, runtime overrides work |
| Deployment artifacts (Dockerfile, docker-compose, Kubernetes manifests) | `deployment/` | 150 | Container builds, runs, health check passes |
| CLI (cos start, cos stop, cos status, cos process) | `deployment/src/cli.ts` | 200 | All commands work and return valid output |

**Acceptance Criteria:**
- HTTP API responds to GET /health and GET /stats
- REST endpoint for process() accepts POST and returns CellOutput
- Storage adapters connect to real databases (can be containerized)
- Telemetry exports all events and metrics
- Auth middleware rejects unauthenticated requests
- Docker image builds and starts in < 5s
- `cos process --input "hello"` returns valid output

**Tests:** `api/tests/server.test.ts`, `infrastructure/tests/*.test.ts`, `deployment/tests/*.test.ts`

**Duration:** 4 sprints

---

## Phase 6: Self-Improvement & Advanced

**Goal:** Learning feedback loops, meta-cognition, plugin system, performance optimization.

**Dependencies:** Phases 1-5

**Deliverables:**

| Component | Description | Priority |
|-----------|-------------|----------|
| Learning feedback loop | Evaluation results feed into LearningSystem, patterns adjust reasoning | High |
| Meta-cognition | System reflects on its own performance and suggests improvements | High |
| Plugin system (MCP) | External plugins via MCP protocol, dynamic loading | Medium |
| Performance tuning | Profile hot paths (event dispatch, graph traversal, memory sweep) | Medium |
| Advanced reasoning | Graph of Thoughts, Debate engine, Simulation engine | Medium |
| Visualization | Runtime graph, knowledge graph, execution trace in browser | Low |
| Distributed runtime | Multi-node CellHost, distributed scheduler, remote cells | Low |
| Benchmark suite | Latency p50/p95/p99, throughput, memory, cost per operation | Low |

**Acceptance Criteria (High priority only):**
- Learning patterns measurably improve reasoning quality over 100+ iterations
- Meta-cognition identifies top 3 performance bottlenecks
- At least one external MCP plugin loads and executes

**Duration:** Ongoing

---

## Total Timeline

| Phase | Sprints | Sprint equivalent | Cumulative |
|-------|---------|------------------|------------|
| Phase 0: Foundation | 1 | 1 week | Week 1 |
| Phase 1: MVP Runtime | 2 | 2 weeks | Week 3 |
| Phase 2a: Memory | 2 | 2 weeks | Week 5 |
| Phase 2b: Knowledge | 2 | 2 weeks | Week 7 |
| Phase 3: Cognition | 3 | 3 weeks | Week 10 |
| Phase 4: Execution & Orch. | 3 | 3 weeks | Week 13 |
| Phase 5: Production | 4 | 4 weeks | Week 17 |
| Phase 6: Advanced | Ongoing | — | — |

**Working MVP delivered at end of Phase 1 (Week 3).**

---

## Risk Matrix

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Type system complexity | Medium | Low | Keep types minimal in Phase 0, refine later |
| EventBus performance (10K+ events/s) | Medium | Medium | Benchmark in Phase 1, optimize with batching in Phase 5 |
| Memory store scalability | High | Medium | Start with InMemoryStore, add persistent adapters in Phase 5 |
| Reasoning engine quality | High | Medium | Engines are pluggable — swap weak engines without changing architecture |
| Integration complexity | High | Low | Each phase produces working, testable code — no big-bang integration |
| Production storage latency | Medium | Medium | Design adapter interface from start; optimize implementations in Phase 5 |

## Parallelization Opportunities

- Phase 2a (Memory) and Phase 2b (Knowledge) can run in parallel
- Phase 3 (Cognition) can start after Phase 1, independent of Memory
- Phase 4 (Execution/Tools) can start after Phase 1, independent of Memory/Knowledge
- Phase 5 (Production) requires all systems stable

Recommended parallel track:

```
Sprint 1:     Phase 0
Sprint 2-3:   Phase 1 (MVP)
Sprint 4-5:   Phase 2a ────── Phase 2b ────── Phase 3 ────── Phase 4
                                    ↓                        ↓
Sprint 6-7:                         └───────── Phase 3 ──────┘
Sprint 8-10:                              Phase 5
Sprint 11+:                               Phase 6
```

## Verification Gates

Each phase must pass these before the next begins:

1. **Phase 0 Gate:** All core types compile, `BaseCell` passes lifecycle tests
2. **Phase 1 Gate:** System boots, processes input, EventBus delivers, Scheduler processes, all tests pass
3. **Phase 2 Gate:** 12 memory layers operational, graph supports 10K nodes, embeddings return correct similarity
4. **Phase 3 Gate:** 3 reasoning engines working, planning creates and executes, evaluation produces structured output
5. **Phase 4 Gate:** Tools execute, agent runs, workflow completes, policy evaluates correctly
6. **Phase 5 Gate:** API responds, storage persists, auth enforces, container deploys
7. **Phase 6 Gate:** Learning improves metrics, meta-cognition produces insights

## Definition of Done

Every component in every phase:
- [ ] Compiles without errors
- [ ] All unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] Documentation written
- [ ] Example usage in examples/
- [ ] No TODOs or placeholders in production code
- [ ] All interfaces are exported from package index
- [ ] CHANGELOG updated