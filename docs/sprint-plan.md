# COS Sprint-by-Sprint Implementation Plan

17 weeks · 17 sprints · 7 phases · 142 tasks · 478 story points

## Conventions

| Abbreviation | Meaning |
|-------------|---------|
| SP | Story Points (Fibonacci: 1,2,3,5,8,13) |
| AC | Acceptance Criteria |
| 🧪 | Test deliverable |
| 📄 | Documentation deliverable |
| 🚀 | Deployment deliverable |
| 🔥 | Critical path (blocks downstream) |

**Sprint cadence:** 1 week per sprint. 17 sprints = 17 weeks.

**Component owners:** Core, Runtime, Memory, Knowledge, Cognition, Execution, Orchestration, API, Infra, DevOps, Observability.

---

# PHASE 0: FOUNDATION (Sprint 1)

## Sprint 1 — Core Types, Errors, CogCell Base

**Theme:** Establish the language of the system. Everything else depends on this.

**Total SP:** 26

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 1.1 | Define all core type primitives: EntityId, Timestamp, Version, Metadata, Confidence, Cost, Latency, HealthStatus, Severity, Permission, RepresentationType | 3 | Core | None | 🔥 All types compile, are exported from @cos/core, and are used in at least 2 other modules |
| 1.2 | Define MemoryEntry, MemoryLayer, MemoryQuery, MemoryStoreStats, IMemoryStore | 3 | Core | 1.1 | 🔥 All memory types compile, IMemoryStore has CRUD + query + clear + stats |
| 1.3 | Define GraphNode, GraphEdge, GraphQuery, GraphPath, GraphStats, IPropertyGraph | 3 | Core | 1.1 | 🔥 All graph types compile, IPropertyGraph has CRUD + query + traverse + stats |
| 1.4 | Define CogEvent, EventHandler, SubscribeOptions, IEventBus, SubscriptionId | 2 | Core | 1.1 | 🔥 Event types compile, IEventBus has publish/subscribe/unsubscribe/history |
| 1.5 | Define CogCellDefinition, CogCellState, CellLifecycle, CellContext, CellOutput, ICogCell, CellInspection | 3 | Core | 1.1 | 🔥 All cell types compile, CellLifecycle has 8 states, CellOutput has all fields |
| 1.6 | Define ToolDefinition, ToolResult, ITool | 2 | Core | 1.1 | Tool types compile, ITool has execute with ToolResult |
| 1.7 | Define PolicyRule, PolicyCondition, PolicyDecision, IPolicyEngine | 2 | Core | 1.1 | Policy types compile, IPolicyEngine has evaluate/addRule/removeRule |
| 1.8 | Define Task, TaskStatus, SchedulerStats, IScheduler | 2 | Core | 1.1 | 🔥 Task types compile, IScheduler has enqueue/dequeue/complete/fail/cancel/stats |
| 1.9 | Implement CellError, ValidationError, TimeoutError, PermissionDeniedError, ResourceExhaustedError, PolicyViolationError, generateId, generateTraceId, generateSpanId | 3 | Core | 1.1 | 🔥 All error types constructible, generateId produces unique IDs, errors serialize to JSON |
| 1.10 | Implement BaseCell with lifecycle state machine, process(), getHealth(), getMetrics(), getCost(), inspect(), abstract onProcess() hook | 5 | Core | 1.5, 1.9 | 🔥 BaseCell goes through all lifecycle transitions, process() returns valid CellOutput with timing |
| 1.11 | 🧪 Unit tests: types construct correctly, all errors round-trip through JSON, BaseCell lifecycle transitions verified | 3 | Core | 1.10 | 100% coverage on core/types, core/errors, core/cell; all tests pass |
| 1.12 | 📄 Write core/README.md with type reference guide | 1 | Core | 1.1-1.11 | README covers all exported types with examples |

**Sprint 1 Gate:** `@cos/core` compiles, exports all symbols, BaseCell passes lifecycle tests, all errors constructible.

---

# PHASE 1: MVP RUNTIME (Sprints 2-3)

## Sprint 2 — EventBus, StateManager, Scheduler

**Theme:** Build the communication backbone and task execution engine.

**Total SP:** 24

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 2.1 | Implement EventBus: publish() with auto-ID/timestamp/traceId/spanId, subscribe() with wildcard, priority, once, unsubscribe(), getHistory(), clear() | 5 | Runtime | 1.4, 1.9 | 🔥 Events publish to correct subscribers, wildcard '*' receives all, priority ordering works, history is bounded |
| 2.2 | Implement StateManager: get(), set(), update() with immutability, snapshot on every transition, getHistory(), getVersion(), clear() | 3 | Runtime | 1.1 | 🔥 set() creates snapshot before overwrite, getHistory() returns ordered snapshots, clear() resets all |
| 2.3 | Implement Scheduler: enqueue() with priority ordering, dequeue() by type/limit, complete()/fail() with retry, cancel(), getStatus(), getQueueLength(), stats() | 8 | Runtime | 1.8, 1.9 | 🔥 Tasks execute in priority order, retries respect maxRetries, stats() returns accurate counts, concurrent tasks respect maxConcurrency |
| 2.4 | Write Scheduler polling loop: start()/stop() with configurable interval, auto-dequeue when capacity available | 3 | Runtime | 2.3 | Scheduler auto-processes tasks on start(), stops cleanly on stop() |
| 2.5 | 🧪 Unit tests: EventBus with 10 subscribers, 1000 events, priority ordering; StateManager with 100 state transitions, version tracking; Scheduler with 500 tasks, retries, concurrency | 5 | Runtime | 2.1-2.4 | All tests pass, EventBus delivers events in 100ms, Scheduler processes 100 tasks in 500ms |

**Sprint 2 Gate:** EventBus, StateManager, Scheduler all independently testable with passing tests.

---

## Sprint 3 — CellHost, Bootstrap, MVP Verification

**Theme:** Wire everything together into a running system.

**Total SP:** 28

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 3.1 | Implement CellHost: register() validates and inits cells, start() starts all cells + scheduler, shutdown() stops everything, getSystemHealth(), getDependents(), inspectCell() | 8 | Runtime | 1.10, 2.1, 2.2, 2.3 | 🔥 CellHost registers cells, starts/stops lifecycle, connects to EventBus, tasks routed to correct cells |
| 3.2 | Implement CellHost.executeTask: routes scheduler tasks to target cells via cell.process() | 3 | Runtime | 3.1 | 🔥 Scheduler tasks are dispatched to the correct cell by target ID |
| 3.3 | Build MVP cognitive cell: echo processor that wraps input in CellOutput with cost, confidence, latency | 3 | Core | 1.10 | Cell processes any input and returns valid CellOutput |
| 3.4 | Build MVP bootstrap: register cell, define agent, define policy, start, process one input, log output, shutdown | 5 | Runtime | 3.3, 3.1 | 🚀 `npm run cos` boots, processes, returns output, shuts down in < 1s |
| 3.5 | Implement runtime package index, package.json with @cos/core dependency, tsconfig | 2 | Runtime | 2.1, 2.2, 2.3, 3.1 | 🔥 Package compiles, all symbols exported |
| 3.6 | 🧪 Integration test: full boot → process 10 inputs → verify events, state, scheduler stats → shutdown | 5 | Runtime | 3.4 | 10 inputs processed, each produces unique CellOutput, EventBus has 10+ events, Scheduler shows 10 completed |
| 3.7 | 📄 Write runtime/README.md with architecture, usage, EventBus/Scheduler/CellHost API reference | 2 | Runtime | 3.6 | README covers all 4 components with examples |

**Sprint 3 Gate:** 🚀 **MVP COMPLETE.** System boots, processes input, observable events, scheduler processes tasks, state history recorded, clean shutdown.

---

# PHASE 2a: MEMORY SYSTEM (Sprints 4-5)

## Sprint 4 — InMemoryStore, MemoryManager Store/Retrieve

**Theme:** Build the memory store foundation with all 12 layers.

**Total SP:** 25

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 4.1 | Implement InMemoryStore with layer index, tag index, store(), retrieve() with TTL check, access tracking, update(), delete(), clear(layer?), stats() | 8 | Memory | 1.2 | 🔥 All 12 layers indexed, store/retrieve respects TTL, access count increments on retrieve, stats returns per-layer counts |
| 4.2 | Implement TTL sweeper: setInterval sweep, check entry.age vs entry.ttl, delete expired, run every 60s | 3 | Memory | 4.1 | Expired entries deleted within 60s of expiration |
| 4.3 | Implement MemoryManager.store() with auto-importance scoring, default TTL per layer, auto version, source tracking | 5 | Memory | 4.1 | 🔥 Store correctly assigns importance based on layer + recency + access count, TTL defaults per layer (working=5min, long-term=∞, etc.) |
| 4.4 | Implement MemoryManager.retrieve(), query() with layer/tag/importance/timeRange/sortBy filters, update(), delete() | 5 | Memory | 4.3 | Query filters work independently and combined, sortBy works with sortOrder |
| 4.5 | 🧪 Unit tests: store across all 12 layers, retrieve respects TTL, query with 5 combined filters, update partial, delete cascades, stats accurate | 4 | Memory | 4.1-4.4 | All CRUD operations tested per layer, TTL tests verify expiration, query tests verify filter combinations |

**Sprint 4 Gate:** InMemoryStore fully operational, MemoryManager store/retrieve/query/update/delete working, TTL sweeper active.

---

## Sprint 5 — Memory Consolidation, Forgetting, Cross-linking, Integration

**Theme:** Advanced memory operations that make the system cognitive.

**Total SP:** 24

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 5.1 | Implement MemoryManager.consolidate(threshold): query short_term entries with importance >= threshold, promote to long_term, mark consolidated, set TTL to null | 5 | Memory | 4.3 | 🔥 Consolidation moves entries with importance >= 0.7 from short_term to long_term, consolidated flag set |
| 5.2 | Implement MemoryManager.forget(threshold, maxAge): query entries sorted by importance ascending, delete those below threshold and older than maxAge, skip long_term and semantic | 5 | Memory | 4.3 | 🔥 Forgetting removes low-importance old entries, preserves long_term and semantic layers |
| 5.3 | Implement MemoryManager.crossLink(sourceId, targetId, relation): store link metadata on both entries | 3 | Memory | 4.1 | Cross-links are bidirectional, retrievable via entry.metadata.links |
| 5.4 | Implement MemoryManager compression: summarize old entries (placeholder for LLM-based summarization) | 2 | Memory | 4.1 | Compression interface defined, placeholder implementation stores first 100 chars |
| 5.5 | Integrate MemoryManager with CellHost: cells get memory partitions, store/retrieve through manager | 3 | Memory | 3.1, 4.3 | 🔥 CellHost creates memory partition per cell, cells can access memory through context |
| 5.6 | 🧪 Integration test: store 100 entries → consolidate → verify long_term has promoted entries → forget → verify low-importance entries gone → cross-link → verify links → stats | 5 | Memory | 5.1-5.5 | Consolidation promotes 20%+ of entries, forgetting removes 10%+ of low-importance entries, cross-links are bidirectional |
| 5.7 | 📄 Write memory/README.md with layer reference, TTL table, query examples | 1 | Memory | 5.6 | README covers all 12 layers with TTL, importance defaults, and query examples |

**Sprint 5 Gate:** Memory consolidation, forgetting, cross-linking all working. Memory integrated with CellHost.

---

# PHASE 2b: KNOWLEDGE LAYER (Sprints 6-7)

## Sprint 6 — PropertyGraph, KnowledgeGraph

**Theme:** Graph storage and knowledge statement engine.

**Total SP:** 26

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 6.1 | Implement PropertyGraph: addNode/createNode, getNode, updateNode, deleteNode with cascading edge delete, type/tag indices | 8 | Knowledge | 1.3 | 🔥 Nodes can be created/updated/deleted, deleteNode cascades to connected edges, type/tag indices work |
| 6.2 | Implement PropertyGraph: addEdge, getEdge, updateEdge, deleteEdge with source/target validation, out/in edge indices, type index | 5 | Knowledge | 6.1 | 🔥 Edges validate source/target exist, deleteEdge removes from all indices |
| 6.3 | Implement PropertyGraph: queryNodes, queryEdges with type/label/tags/properties/limit filters, traverse(start, edgeTypes, depth) with bidirectional DFS | 5 | Knowledge | 6.1, 6.2 | 🔥 Query filters work independently, traverse returns GraphPath with nodes, edges, totalCost, totalConfidence, depth limit enforced |
| 6.4 | Implement KnowledgeGraph: addStatement creates subject+object nodes + knowledge edge, query(subject/predicate/object), getRelated, deleteStatement | 5 | Knowledge | 6.1, 6.2, 6.3 | 🔥 Statements become graph edges, query returns sorted by confidence, getRelated traverses knowledge/related_to/belongs_to edges |
| 6.5 | 🧪 Unit tests: add 1000 nodes, 5000 edges, query by type/tag, traverse at depth 3, verify stats | 3 | Knowledge | 6.1-6.4 | 1000 nodes + 5000 edges, traversal depth 3 returns paths, stats matches counts |

**Sprint 6 Gate:** PropertyGraph handles 10K+ nodes and 50K+ edges, KnowledgeGraph creates and queries statements.

---

## Sprint 7 — EmbeddingSystem, OntologySystem, Integration

**Theme:** Vector similarity and formal ontology.

**Total SP:** 25

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 7.1 | Implement EmbeddingSystem: store(sourceId, vector, sourceType, model), getBySource, search(queryVector, limit, threshold, sourceType), delete | 5 | Knowledge | 1.1 | 🔥 Embeddings stored and retrieved by source ID, search returns ordered by cosine similarity, threshold filter works |
| 7.2 | Implement cosine similarity calculator, textToEmbedding hashing (hash-based TF vector, normalize), unit tests for similarity accuracy | 5 | Knowledge | 7.1 | Cosine similarity returns 0-1, identical vectors have similarity 1.0, orthogonal vectors have 0.0 |
| 7.3 | Implement OntologySystem: defineClass(name, desc, parent, properties), defineRelation, getClass/getClassById, getRelation, getClassHierarchy | 5 | Knowledge | 1.1 | 🔥 Classes have parent-child hierarchy, relations have domain/range, hierarchy is retrievable |
| 7.4 | Implement OntologySystem.validate(instance, className): check required properties, type matching, return validation errors | 3 | Knowledge | 7.3 | validate catches missing required properties, type mismatches, returns structured errors |
| 7.5 | Integrate KnowledgeGraph + EmbeddingSystem + OntologySystem: knowledge statements auto-embed, ontology validates graph nodes | 3 | Knowledge | 6.4, 7.1, 7.3 | Knowledge statements produce embeddings automatically, ontology validates node types |
| 7.6 | 🧪 Integration test: define ontology → create knowledge graph → embed → search by similarity → validate | 3 | Knowledge | 7.5 | End-to-end: ontology → knowledge → embedding → search → validation all work |
| 7.7 | 📄 Write knowledge/README.md with graph API, embedding usage, ontology reference | 1 | Knowledge | 7.6 | README covers all 4 modules with examples |

**Sprint 7 Gate:** Knowledge layer complete: property graph, knowledge graph, embeddings, ontology all operational.

---

# PHASE 3: COGNITION (Sprints 8-10)

## Sprint 8 — Chain of Thought, Tree of Thoughts Engines

**Theme:** First two reasoning engines.

**Total SP:** 24

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 8.1 | Implement ChainOfThoughtEngine: reason(input) produces N steps with monotonic confidence, step decomposition, reasoning trace, cost tracking | 8 | Cognition | 1.1, 1.9 | 🔥 CoT produces N=5 steps, confidence increases from 0.7 to 0.9, each step has distinct reasoning text |
| 8.2 | Implement TreeOfThoughtsEngine: reason(input) with branching factor, max depth, beam width, generate children, value score, beam selection, alternatives | 8 | Cognition | 1.1, 1.9 | 🔥 ToT explores branchingFactor^maxDepth nodes, beam selects top-k by value, alternatives list populated |
| 8.3 | implement ThoughtNode structure, BFS with beam search, value scoring, tree statistics | 5 | Cognition | 8.2 | Tree structure is inspectable, node count, depth level, best path all retrievable |
| 8.4 | 🧪 Unit tests: CoT produces exactly N steps with correct structure, ToT explores all branches, beam selects correctly | 3 | Cognition | 8.1, 8.3 | CoT steps have correct engine type, increasing confidence, valid reasoning text |

**Sprint 8 Gate:** CoT and ToT engines produce correct, structured reasoning output.

---

## Sprint 9 — Reflection Engine, Reasoning Registry, Planning Engine

**Theme:** Reflection, engine registry, goal decomposition.

**Total SP:** 26

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 9.1 | Implement ReflectionEngine: reason(input) with critiqueAspects, score each aspect, generate improvement text, structured output | 5 | Cognition | 1.1 | 🔥 Reflection scores 5+ aspects, generates improvement text per aspect, confidence matches score |
| 9.2 | Implement ReasoningEngineRegistry: register(engine), get(type), getAll(), reason(engineType, input), getCapabilities() | 3 | Cognition | 8.1, 8.2, 9.1 | 🔥 All 3 engines registered by default, reason() dispatches to correct engine, getCapabilities returns all |
| 9.3 | Implement PlanningEngine.createPlan(goal): decompose goal into steps using CoT reasoning, create PlanStep with dependencies, confidence, cost | 8 | Cognition | 8.1, 9.2 | 🔥 Plan created from goal string, 5+ steps with dependency ordering, confidence per step, cost tracking |
| 9.4 | Implement PlanningEngine.executePlan(planId): topological execution, step-by-step, dependency resolution, deadlock detection, status tracking | 5 | Cognition | 9.3 | 🔥 Plan executes in dependency order, status transitions from pending→running→completed, deadlock detection terminates |
| 9.5 | Implement Plan.getPlan, getPlansByGoal, plan status reporting | 2 | Cognition | 9.3, 9.4 | Plans retrievable by ID and goal, status reports accurate |
| 9.6 | 🧪 Unit tests: Reflection on 5 aspects, Registry dispatches correctly, Plan creation and execution | 3 | Cognition | 9.1-9.5 | Reflection scores all aspects, CoT/ToT/Reflection all dispatchable through registry, plan executes 5 steps |

**Sprint 9 Gate:** All 3 reasoning engines registered, Planning engine creates and executes plans.

---

## Sprint 10 — Evaluation, Learning, Cognition Integration

**Theme:** Quality measurement and feedback loops.

**Total SP:** 24

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 10.1 | Implement EvaluationSystem: evaluate(subject, input, criteria) uses Reflection engine to score each criterion, produce overall score, strengths/weaknesses/suggestions | 5 | Cognition | 9.1 | 🔥 Evaluation produces scores for all criteria, overall score is average, strengths/weaknesses derived from score thresholds |
| 10.2 | Implement LearningSystem: recordExample(input, output, expectedOutput, confidence), addFeedback(exampleId, score, notes), extractPattern from feedback | 5 | Cognition | 1.1 | 🔥 Examples recorded with structured data, feedback updates example, patterns extracted from feedback text |
| 10.3 | Implement LearningSystem.getPatterns(threshold), getRecentExamples, applyFeedbackToEvaluation | 3 | Cognition | 10.2 | Patterns retrievable sorted by confidence, only patterns above threshold returned |
| 10.4 | Integrate Evaluation → Learning pipeline: evaluation results automatically feed into learning system | 5 | Cognition | 10.1, 10.2 | 🔥 Evaluation results are automatically recorded as learning examples, patterns update |
| 10.5 | Integrate Learning → Reasoning: patterns influence reasoning engine selection and confidence calibration | 3 | Cognition | 10.4, 9.2 | Patterns from learning affect engine confidence scores |
| 10.6 | 🧪 Integration test: evaluate → learn → pattern extract → pattern influences reasoning → re-evaluate shows improvement | 3 | Cognition | 10.4, 10.5 | After 10 evaluations, patterns exist, reasoning confidence adjusts |
| 10.7 | 📄 Write cognition/README.md with engine reference, planning guide, evaluation rubric | 1 | Cognition | 10.6 | README covers all 3 reasoning engines, planning, evaluation, learning |

**Sprint 10 Gate:** Cognition layer complete: evaluation produces scores, learning extracts patterns, feedback loop between evaluation and reasoning.

---

# PHASE 4: EXECUTION & ORCHESTRATION (Sprints 11-13)

## Sprint 11 — ToolRegistry, FileSystem, HTTP Tools

**Theme:** Pluggable tool system with first two tools.

**Total SP:** 23

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 11.1 | Implement ToolRegistry: register(tool), get(name), getAll(), execute(name, input, context), getDefinitions() | 3 | Execution | 1.6 | 🔥 Tools registered and callable, getDefinitions returns all schemas, execute dispatches by name |
| 11.2 | Implement FileSystemTool: read(path), write(path, content), delete(path), list(dir), exists(path) with path validation, permission checks, error handling | 5 | Execution | 11.1 | 🔥 All 5 operations work, path traversal prevented, errors return structured ToolResult |
| 11.3 | Implement HTTPTool: GET/POST/PUT/DELETE/PATCH with headers, body, timeout, response parsing, error handling | 5 | Execution | 11.1 | 🔥 All 5 methods work, timeout enforced, errors return structured ToolResult |
| 11.4 | Implement SearchTool: query(text, source, limit) with source filter (knowledge/memory/web/all), structured results | 3 | Execution | 11.1 | Search returns structured results, source filter limits scope |
| 11.5 | Add rate limiting and retry logic to ToolRegistry: maxPerMinute/maxPerHour counters, retry with backoff | 5 | Execution | 11.1 | 🔥 Rate limiting blocks excessive calls, retry fires on failure with exponential backoff |
| 11.6 | 🧪 Unit tests: register 3 tools, execute 100 calls, verify rate limiting, verify retry | 2 | Execution | 11.1-11.5 | All tools execute correctly, rate limit enforces maxPerMinute, retry succeeds after 2 failures |

**Sprint 11 Gate:** ToolRegistry with 3 built-in tools, rate limiting, retry logic.

---

## Sprint 12 — CodeSandbox, Execution Integration

**Theme:** Safe code execution and tool-to-cell integration.

**Total SP:** 22

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 12.1 | Implement CodeSandbox: execute(code, language, context) with timeout, maxMemory, maxOutput constraints, stdout/stderr capture, exit code | 8 | Execution | 1.1 | 🔥 JavaScript executes in sandbox, timeout enforced, stdout captured, errors return structured CodeExecutionResult |
| 12.2 | Implement CodeSandbox validation: code size limit, module whitelist, network/filesystem access control | 5 | Execution | 12.1 | Code exceeding maxOutput rejected, module whitelist enforced, network access blocked when disabled |
| 12.3 | Implement execution cell: CogCell that wraps ToolRegistry, routes process() input to tool execution, returns ToolResult as CellOutput | 5 | Execution | 11.1, 12.1 | 🔥 Execution cell registered in CellHost, process() dispatches to correct tool, ToolResult wrapped in CellOutput |
| 12.4 | 🧪 Integration test: execution cell with 3 tools, sandbox with valid/invalid code, combined tool + sandbox workflow | 3 | Execution | 12.3 | Execution cell processes tool calls, sandbox executes valid JS, rejects invalid code |
| 12.5 | 📄 Write execution/README.md with tool API, sandbox limitations, execution cell reference | 1 | Execution | 12.4 | README covers all tools, sandbox config, execution cell |

**Sprint 12 Gate:** CodeSandbox operational, execution cell integrated with CellHost.

---

## Sprint 13 — AgentSystem, WorkflowEngine, PolicyEngine

**Theme:** Multi-agent orchestration, workflows, governance.

**Total SP:** 28

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 13.1 | Implement AgentSystem: defineAgent(name, purpose, cellIds, options), executeAgent(agentId, input), getAgent, getExecution, registerCell | 5 | Orchestration | 3.1 | 🔥 Agents defined with multiple cells, executeAgent runs cells sequentially, agent status tracked |
| 13.2 | Implement WorkflowEngine: define(name, desc, steps), execute(workflowId, input), registerStepType(type, handler), getWorkflow, getExecution | 8 | Orchestration | 1.1 | 🔥 Workflows defined with ordered steps, execute processes in topological order, step handlers registered by type |
| 13.3 | Implement WorkflowEngine step types: cell, condition, parallel, loop, human_approval with handler dispatch | 5 | Orchestration | 13.2 | 🔥 cell step routes to CellHost, condition step evaluates expression, human_approval pauses execution |
| 13.4 | Implement WorkflowEngine.approveStep(executionId): resume workflow from awaiting_approval state | 3 | Orchestration | 13.3 | Approval resumes workflow execution, continues from paused step |
| 13.5 | Implement PolicyEngine: addRule, removeRule, getRules, evaluate(action, resource, context) with priority matching, condition evaluation | 5 | Orchestration | 1.7 | 🔥 Rules evaluated by priority, conditions filter by context fields, effect (allow/deny/require_approval) returned |
| 13.6 | 🧪 Integration test: define agent → execute → define workflow → run → human approval → approve → complete → define policy → evaluate | 2 | Orchestration | 13.1-13.5 | Agent executes 3 cells, workflow runs 5 steps, human approval pauses and resumes, policy evaluates correctly |
| 13.7 | 📄 Write orchestration/README.md with agent API, workflow DSL, policy examples | 1 | Orchestration | 13.6 | README covers all 3 modules |

**Sprint 13 Gate:** AgentSystem, WorkflowEngine, PolicyEngine all operational and integrated.

---

# PHASE 5: PRODUCTION SYSTEMS (Sprints 14-17)

## Sprint 14 — Storage Adapters, Configuration System

**Theme:** Persistent storage, layered configuration.

**Total SP:** 22

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 14.1 | Implement PostgreSQL adapter: IStorageAdapter with get/set/delete/list/clear, connection pooling, SQL schema for memory/graph storage | 5 | Infra | 1.1 | 🔥 PostgreSQL adapter passes IStorageAdapter contract, connection pooling active, schema creates tables |
| 14.2 | Implement Redis adapter: IStorageAdapter with get/set/delete/list/clear, TTL support, connection management | 3 | Infra | 1.1 | Redis adapter passes IStorageAdapter contract, TTL set on set() |
| 14.3 | Implement Qdrant adapter: vector storage/search with collection management, payload filtering | 3 | Infra | 7.1 | Qdrant adapter stores/search vectors, payload filters work |
| 14.4 | Implement Configuration system: layered resolver (defaults → env → file → runtime), merge strategy, type coercion, validation | 5 | Infra | 1.1 | 🔥 Config resolves in correct order, env vars override defaults, file overrides env, runtime overrides file |
| 14.5 | Implement config schema for all COS components, validation rules, sensible defaults | 3 | Infra | 14.4 | Schema covers all 11 packages, validation catches missing required fields |
| 14.6 | 🧪 Unit tests: all 4 adapters pass contract tests, config resolves/O override/validation | 3 | Infra | 14.1-14.5 | Adapter tests run against containerized services, config tests verify all merge scenarios |

**Sprint 14 Gate:** All 4 storage adapters operational, configuration system resolves correctly.

---

## Sprint 15 — COSServer, Auth Middleware, Telemetry

**Theme:** Unified API, security, observability.

**Total SP:** 26

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 15.1 | Implement COSServer: wire all 11 subsystems, process(request) routing, getHealth() aggregation, getStats() aggregation, start()/shutdown() | 8 | API | 3.1, 4.3, 6.4, 7.1, 7.3, 9.2, 10.1, 10.2, 11.1, 13.1, 13.2, 13.5, 14.4 | 🔥 All subsystems initialized, process() routes to correct subsystem, health/stats return aggregated data |
| 15.2 | Implement process() routing: if reasoning specified → reasoning engine, if target specified → cell, default → pass-through | 3 | API | 15.1 | Routing works for all 3 paths |
| 15.3 | Implement JWT authentication middleware: verify token, extract user, attach to context, reject invalid | 5 | API | 1.1 | 🔥 Valid JWT proceeds, invalid JWT rejected with 401, user extracted and attached to context |
| 15.4 | Implement API key authentication: key lookup, rate limiting per key, expiry check | 3 | API | 15.3 | Valid API key proceeds, expired key rejected, rate limit enforced |
| 15.5 | Implement TelemetrySystem: recordEvent, recordMetric, queryEvents, queryMetrics, export, counter aggregation | 5 | Observability | 1.1 | 🔥 Events and metrics recorded, queryable by type/source/status, export returns all data |
| 15.6 | 🧪 Integration test: COSServer boots, process() with 3 routing paths, auth rejects invalid tokens, telemetry records all events | 2 | API | 15.1-15.5 | Server boots, all 3 routes work, auth blocks unauthenticated, telemetry has events |

**Sprint 15 Gate:** COSServer operational with all subsystems, auth middleware working, telemetry recording.

---

## Sprint 16 — Deployment, Docker, CLI

**Theme:** Containerization, command-line interface, deployment artifacts.

**Total SP:** 24

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 16.1 | Write Dockerfile: multi-stage build, Node.js 18 base, distroless runtime, HEALTHCHECK, non-root user | 5 | DevOps | 15.1 | 🚀 Docker build succeeds, image < 200MB, HEALTHCHECK passes, runs as non-root |
| 16.2 | Write docker-compose.yml: cos-server, postgres, redis, qdrant services, volumes, networks, environment config | 3 | DevOps | 16.1 | 🚀 `docker-compose up` starts all services, cos connects to postgres/redis/qdrant |
| 16.3 | Write Kubernetes manifests: deployment, service, configmap, secret, hpa, ingress | 5 | DevOps | 16.1 | 🚀 `kubectl apply -f k8s/` creates all resources, pod starts, health check passes |
| 16.4 | Implement CLI: cos start, cos stop, cos status, cos process, cos config, cos inspect | 5 | DevOps | 15.1 | 🔥 All 6 commands work, cos start boots server, cos process sends input, cos inspect returns cell details |
| 16.5 | Implement CLI completion: bash/zsh completion scripts, help text for all commands | 2 | DevOps | 16.4 | `cos --help` shows all commands, tab completion works |
| 16.6 | 🧪 Smoke test: Docker container starts, CLI processes input, health endpoint responds | 3 | DevOps | 16.1, 16.4 | Container boots in < 5s, `cos process "hello"` returns valid output, health endpoint returns 200 |
| 16.7 | 📄 Write deployment/README.md with Docker, K8s, CLI instructions | 1 | DevOps | 16.6 | README covers all deployment methods |

**Sprint 16 Gate:** Docker image builds, docker-compose starts all services, CLI commands work.

---

## Sprint 17 — Integration, Hardening, Performance

**Theme:** Full system integration, security audit, performance benchmarks.

**Total SP:** 23

| # | Task | SP | Owner | Dependencies | AC |
|---|------|----|-------|-------------|-----|
| 17.1 | Full system integration test: COSServer boots with all 11 subsystems, process through cognition → memory → knowledge → execution → orchestration, verify end-to-end | 8 | API | 15.1, 16.1 | 🔥 Single input flows through all layers, output contains reasoning trace, memory stores entry, knowledge graph grows, tools execute |
| 17.2 | Resilience testing: kill a dependency, verify system degrades gracefully, restart, verify recovery | 5 | DevOps | 17.1 | System degrades with clear health status, restarts without data loss, reconnects automatically |
| 17.3 | Performance benchmark: measure p50/p95/p99 latency (process), throughput (req/s), memory (RSS), cost per operation | 5 | DevOps | 17.1 | Latency p50 < 100ms, p95 < 500ms, throughput > 100 req/s, memory < 512MB RSS |
| 17.4 | Security audit: verify auth middleware, policy enforcement, sandbox isolation, inject test payloads | 3 | API | 15.3, 15.4, 13.5 | Auth rejects all invalid tokens, policy blocks denied actions, sandbox rejects malicious code |
| 17.5 | 📄 Write full CHANGELOG.md, README.md with quick start, architecture overview, subsystem reference | 2 | DevOps | 17.1 | README covers installation, configuration, usage, architecture |

**Sprint 17 Gate:** 🚀 **PRODUCTION RELEASE.** Full integration verified, performance benchmarked, security audited, documentation complete.

---

# PHASE 6: SELF-IMPROVEMENT & ADVANCED (Sprint 18+)

**Theme:** Learning feedback loops, meta-cognition, plugin system, advanced reasoning.

**Total SP:** Not estimated (ongoing development)

| # | Task | Priority | Dependencies | AC |
|---|------|----------|-------------|-----|
| 18.1 | Implement Learning feedback loop: evaluation results → LearningSystem → pattern extraction → reasoning engine selection | High | 10.4 | Patterns improve reasoning quality over 100+ iterations (measured by evaluation scores) |
| 18.2 | Implement Meta-cognition: system reflects on own performance, identifies bottlenecks, suggests improvements | High | 17.1 | Meta-cognition produces ranked list of top 3 system bottlenecks with actionable suggestions |
| 18.3 | Implement MCP plugin host: dynamic tool loading via MCP protocol, schema discovery, sandboxed execution | Medium | 11.1 | MCP plugins discovered, loaded, executed in sandbox, tools registered in ToolRegistry |
| 18.4 | Implement Graph of Thoughts engine: non-linear reasoning graph, parallel exploration, synthesis | Medium | 8.2 | GoT explores multiple reasoning paths in parallel, synthesizes best path from all branches |
| 18.5 | Implement Debate engine: multiple agents debate a topic, produce consensus or dissenting opinions | Medium | 13.1 | 3+ agents debate, structured output with consensus/dissenting positions, confidence scores |
| 18.6 | Implement World Model: causal model of system behavior, predict outcomes of actions | Medium | 9.3 | World model predicts outcome of action with confidence, updates from actual outcomes |
| 18.7 | Build runtime graph visualization: browser-based graph viewer with real-time updates | Low | 6.3 | Runtime graph renders in browser, nodes/edges update in real-time, inspect node on click |
| 18.8 | Build knowledge graph visualization: interactive knowledge graph with search and filter | Low | 6.4 | Knowledge graph renders with search, filter by type, zoom/pan |
| 18.9 | Build execution trace viewer: timeline of all tasks, cells, events with drill-down | Low | 2.3 | Execution timeline renders, each task expandable to full detail, filter by status |
| 18.10 | Implement distributed runtime: multi-node CellHost, remote cell invocation, distributed scheduler | Low | 3.1 | Cells can run on remote nodes, scheduler distributes tasks across nodes, network partitions handled |
| 18.11 | Implement benchmark suite: automated performance regression detection, historical comparison | Low | 17.3 | Benchmarks run automatically, results compared to baseline, regressions flagged |

---

# SUMMARY

| Phase | Sprints | Tasks | Total SP | Key Deliverable |
|-------|---------|-------|----------|-----------------|
| Phase 0: Foundation | 1 | 12 | 26 | @cos/core package with all types, errors, BaseCell |
| Phase 1: MVP Runtime | 2 | 12 | 52 | 🚀 **WORKING MVP** — EventBus, Scheduler, CellHost, bootstrap |
| Phase 2a: Memory | 2 | 11 | 49 | 12-layer MemoryManager with consolidation, forgetting |
| Phase 2b: Knowledge | 2 | 9 | 51 | PropertyGraph, KnowledgeGraph, Embedding, Ontology |
| Phase 3: Cognition | 3 | 16 | 74 | 3 reasoning engines, Planning, Evaluation, Learning |
| Phase 4: Execution & Orch. | 3 | 13 | 73 | Tools, Sandbox, Agents, Workflows, Policies |
| Phase 5: Production | 4 | 18 | 95 | 🚀 **PRODUCTION** — API, Auth, Docker, CLI, benchmarks |
| **Total** | **17** | **91** | **420** | (+ 11 ongoing tasks in Phase 6) |

## Critical Path (🔥)

The 🔥-marked tasks are on the critical path. Any delay in these tasks pushes the entire schedule. They should be staffed first and unblocked immediately.

**🔥 Tasks by sprint:**
- Sprint 1: 1.1, 1.2, 1.3, 1.4, 1.5, 1.9, 1.10
- Sprint 2: 2.1, 2.3
- Sprint 3: 3.1, 3.4
- Sprint 4: 4.1, 4.3
- Sprint 5: 5.1, 5.2, 5.5
- Sprint 6: 6.1, 6.2, 6.3
- Sprint 7: 7.1, 7.3
- Sprint 8: 8.1, 8.2
- Sprint 9: 9.1, 9.2, 9.3, 9.4
- Sprint 10: 10.1, 10.4
- Sprint 11: 11.1, 11.2, 11.3, 11.5
- Sprint 12: 12.1, 12.3
- Sprint 13: 13.1, 13.2, 13.5
- Sprint 14: 14.1, 14.4
- Sprint 15: 15.1, 15.3, 15.5
- Sprint 16: 16.4
- Sprint 17: 17.1

## Resource Allocation

| Role | Sprint 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 |
|------|---------|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|----|
| Core Engineer | 3 | 1 | 1 | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Runtime Engineer | 1 | 3 | 3 | 1 | 1 | - | - | - | - | - | - | - | 1 | - | - | - | - |
| Memory Engineer | - | - | - | 3 | 3 | - | - | - | - | - | - | - | - | - | - | - | - |
| Knowledge Engineer | - | - | - | - | - | 3 | 3 | - | - | - | - | - | - | - | - | - | - |
| Cognition Engineer | - | - | - | - | - | - | - | 3 | 3 | 3 | - | - | - | - | - | - | - |
| Execution Engineer | - | - | - | - | - | - | - | - | - | - | 3 | 3 | - | - | - | - | - |
| Orchestration Eng. | - | - | - | - | - | - | - | - | - | - | - | - | 3 | - | - | - | - |
| Infrastructure Eng. | - | - | - | - | - | - | - | - | - | - | - | - | - | 3 | - | - | 1 |
| API Engineer | - | - | - | - | - | - | - | - | - | - | - | - | - | - | 3 | - | 1 |
| DevOps Engineer | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | 3 | 2 |
| **Total FTEs** | **4** | **4** | **4** | **4** | **4** | **3** | **3** | **3** | **3** | **3** | **3** | **3** | **4** | **3** | **3** | **3** | **4** |