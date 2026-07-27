// ============================================================
// COS Core Types — Foundation of the Cognitive Operating System
// ============================================================

/** Unique identifier for any cognitive entity */
export type EntityId = string & { __brand: 'EntityId' };

/** ISO-8601 timestamp */
export type Timestamp = string;

/** A semantic version */
export interface Version {
  major: number;
  minor: number;
  patch: number;
  label?: string;
}

/** Generic metadata map */
export type Metadata = Record<string, string | number | boolean | null>;

/** Generic confidence score 0..1 */
export type Confidence = number;

/** Generic cost in arbitrary units (credits, tokens, USD) */
export interface Cost {
  units: string;
  amount: number;
  tokens?: { input: number; output: number; total: number };
  compute?: number; // ms
}

/** Generic latency measurement */
export interface Latency {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
}

/** Health status of any component */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface Health {
  status: HealthStatus;
  lastCheck: Timestamp;
  message?: string;
  metrics?: Record<string, number>;
}

/** Severity levels for events and logs */
export type Severity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Permission levels */
export type Permission = 'read' | 'write' | 'execute' | 'admin' | 'deny';

/** Representation types the system supports */
export type RepresentationType =
  | 'text' | 'tokens' | 'json' | 'markdown'
  | 'tree' | 'ast' | 'embedding' | 'knowledge_graph'
  | 'semantic_graph' | 'runtime_graph' | 'dependency_graph'
  | 'execution_graph' | 'state_graph' | 'memory_graph'
  | 'event_graph' | 'workflow_graph' | 'ontology'
  | 'temporal_graph' | 'scene_graph';

/** A representation of data in a specific format */
export interface Representation {
  type: RepresentationType;
  format: string;
  content: unknown;
  schema?: string;
  version: Version;
  createdAt: Timestamp;
  metadata: Metadata;
}

/** Memory layer identifier */
export type MemoryLayer =
  | 'working' | 'short_term' | 'long_term' | 'semantic'
  | 'procedural' | 'episodic' | 'temporal' | 'spatial'
  | 'vector' | 'knowledge_graph' | 'cache' | 'reflection';

/** Memory entry with metadata */
export interface MemoryEntry {
  id: EntityId;
  layer: MemoryLayer;
  content: unknown;
  representations: Partial<Record<RepresentationType, Representation>>;
  importance: number; // 0..1
  ttl: number | null; // seconds, null = permanent
  version: Version;
  createdAt: Timestamp;
  lastAccessed: Timestamp;
  accessCount: number;
  consolidated: boolean;
  compressed: boolean;
  tags: string[];
  source: EntityId;
  metadata: Metadata;
}

/** Memory query interface */
export interface MemoryQuery {
  layer?: MemoryLayer;
  content?: string;
  embedding?: Float32Array;
  tags?: string[];
  importance?: { min?: number; max?: number };
  timeRange?: { from?: Timestamp; to?: Timestamp };
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'lastAccessed' | 'accessCount' | 'importance';
  sortOrder?: 'asc' | 'desc';
}

/** Memory store interface */
export interface IMemoryStore {
  store(entry: MemoryEntry): Promise<EntityId>;
  retrieve(id: EntityId): Promise<MemoryEntry | null>;
  query(q: MemoryQuery): Promise<MemoryEntry[]>;
  update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void>;
  delete(id: EntityId): Promise<void>;
  clear(layer?: MemoryLayer): Promise<void>;
  stats(): Promise<MemoryStoreStats>;
}

export interface MemoryStoreStats {
  totalEntries: number;
  byLayer: Record<MemoryLayer, number>;
  totalSizeBytes: number;
  oldestEntry: Timestamp | null;
  newestEntry: Timestamp | null;
}

/* ============================================================
   GRAPH CORE TYPES
   ============================================================ */

/** A graph node */
export interface GraphNode {
  id: EntityId;
  type: string;
  label: string;
  description?: string;
  representations: Partial<Record<RepresentationType, Representation>>;
  properties: Metadata;
  tags: string[];
  state?: 'active' | 'archived' | 'deleted';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: Version;
}

/** A graph edge */
export interface GraphEdge {
  id: EntityId;
  source: EntityId;
  target: EntityId;
  type: string;
  label: string;
  weight: number;
  properties: Metadata;
  directed: boolean;
  confidence: Confidence;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Property graph interface */
export interface IPropertyGraph {
  addNode(node: GraphNode): Promise<EntityId>;
  getNode(id: EntityId): Promise<GraphNode | null>;
  updateNode(id: EntityId, updates: Partial<GraphNode>): Promise<void>;
  deleteNode(id: EntityId): Promise<void>;
  addEdge(edge: GraphEdge): Promise<EntityId>;
  getEdge(id: EntityId): Promise<GraphEdge | null>;
  updateEdge(id: EntityId, updates: Partial<GraphEdge>): Promise<void>;
  deleteEdge(id: EntityId): Promise<void>;
  queryNodes(q: GraphQuery): Promise<GraphNode[]>;
  queryEdges(q: GraphQuery): Promise<GraphEdge[]>;
  traverse(start: EntityId, edgeTypes: string[], depth: number): Promise<GraphPath[]>;
  stats(): Promise<GraphStats>;
}

export interface GraphQuery {
  type?: string;
  label?: string;
  tags?: string[];
  properties?: Metadata;
  limit?: number;
  offset?: number;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalCost: number;
  totalConfidence: number;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  byNodeType: Record<string, number>;
  byEdgeType: Record<string, number>;
}

/* ============================================================
   EVENT CORE TYPES
   ============================================================ */

/** A typed event flowing through the system */
export interface CogEvent {
  id: EntityId;
  type: string;
  source: EntityId;
  target?: EntityId;
  payload: unknown;
  metadata: Metadata;
  severity: Severity;
  timestamp: Timestamp;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

/** Event handler signature */
export type EventHandler = (event: CogEvent) => Promise<void> | void;

/** EventBus interface */
export interface IEventBus {
  publish(event: Omit<CogEvent, 'id' | 'timestamp' | 'traceId' | 'spanId'>): Promise<EntityId>;
  subscribe(type: string, handler: EventHandler, options?: SubscribeOptions): Promise<SubscriptionId>;
  unsubscribe(id: SubscriptionId): Promise<void>;
  getHistory(type?: string, limit?: number): Promise<CogEvent[]>;
  clear(): Promise<void>;
}

export type SubscriptionId = string & { __brand: 'SubscriptionId' };

export interface SubscribeOptions {
  filter?: (event: CogEvent) => boolean;
  priority?: number; // higher = processed first
  once?: boolean;
}

/* ============================================================
   CELL CORE TYPES
   ============================================================ */

/** Lifecycle state of a CogCell */
export type CellLifecycle =
  | 'created' | 'initializing' | 'ready' | 'running'
  | 'paused' | 'error' | 'shutting_down' | 'terminated';

/** The fundamental unit of cognitive computation */
export interface CogCellDefinition {
  id: EntityId;
  name: string;
  purpose: string;
  version: Version;
  owner: string;
  type: CellType;
  policies: EntityId[];
  dependencies: EntityId[];
  memory: { layers: MemoryLayer[]; capacity: number };
  tools: string[];
  reasoningEngines: string[];
  executionEngine: string;
  permissions: Record<string, Permission[]>;
  config: Metadata;
  documentation: string;
}

export type CellType =
  | 'cognitive' | 'memory' | 'reasoning' | 'execution'
  | 'tool' | 'agent' | 'workflow' | 'orchestrator'
  | 'observer' | 'gateway' | 'adapter' | 'plugin';

/** Runtime state of a CogCell */
export interface CogCellState {
  id: EntityId;
  lifecycle: CellLifecycle;
  startedAt: Timestamp | null;
  lastActivity: Timestamp | null;
  health: Health;
  cost: Cost;
  latency: Latency;
  metrics: Record<string, number>;
  currentInputs: unknown[];
  currentOutputs: unknown[];
  errors: CogError[];
}

export interface CogError {
  id: EntityId;
  code: string;
  message: string;
  severity: Severity;
  timestamp: Timestamp;
  stack?: string;
  context?: unknown;
}

/** The CogCell interface — every component implements this */
export interface ICogCell {
  readonly definition: CogCellDefinition;
  readonly state: CogCellState;

  // Lifecycle
  init(): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  shutdown(): Promise<void>;

  // Processing
  process(input: unknown, context?: CellContext): Promise<CellOutput>;

  // Observability
  getHealth(): Promise<Health>;
  getMetrics(): Promise<Record<string, number>>;
  getCost(): Promise<Cost>;
  inspect(): Promise<CellInspection>;
}

export interface CellContext {
  traceId: string;
  parentSpanId?: string;
  userId?: string;
  sessionId?: string;
  budget?: Cost;
  policies?: EntityId[];
  metadata?: Metadata;
}

export interface CellOutput {
  id: EntityId;
  result: unknown;
  representations: Partial<Record<RepresentationType, Representation>>;
  cost: Cost;
  latency: number;
  confidence: Confidence;
  memoryUpdates: MemoryEntry[];
  events: CogEvent[];
  errors: CogError[];
  metadata: Metadata;
}

export interface CellInspection {
  id: EntityId;
  definition: CogCellDefinition;
  state: CogCellState;
  eventSubscriptions: SubscriptionId[];
  memoryStats: MemoryStoreStats;
  dependencyGraph: GraphEdge[];
  recentEvents: CogEvent[];
  recentErrors: CogError[];
  configuration: Metadata;
}

/* ============================================================
   SCHEDULER CORE TYPES
   ============================================================ */

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'pending_approval';

export interface Task {
  id: EntityId;
  type: string;
  priority: number;
  target: EntityId; // cell to execute
  input: unknown;
  context: CellContext;
  status: TaskStatus;
  dependencies: EntityId[];
  scheduledAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  result?: CellOutput;
  error?: CogError;
  retryCount: number;
  maxRetries: number;
  timeout: number; // seconds
  cost: Cost;
  policies: EntityId[];
}

export interface IScheduler {
  enqueue(task: Omit<Task, 'id' | 'status' | 'scheduledAt' | 'retryCount' | 'cost'>): Promise<EntityId>;
  dequeue(options?: { types?: string[]; limit?: number }): Promise<Task[]>;
  complete(id: EntityId, result: CellOutput): Promise<void>;
  fail(id: EntityId, error: CogError): Promise<void>;
  cancel(id: EntityId): Promise<void>;
  getStatus(id: EntityId): Promise<TaskStatus>;
  getQueueLength(): Promise<number>;
  stats(): Promise<SchedulerStats>;
}

export interface SchedulerStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  avgWaitTime: number;
  avgExecutionTime: number;
}

/* ============================================================
   KNOWLEDGE & REASONING CORE TYPES
   ============================================================ */

export interface KnowledgeStatement {
  id: EntityId;
  subject: string;
  predicate: string;
  object: string;
  confidence: Confidence;
  source: EntityId;
  timestamp: Timestamp;
  metadata: Metadata;
  embedding?: Float32Array;
}

export type ReasoningEngineType =
  | 'chain_of_thought' | 'tree_of_thoughts' | 'graph_of_thoughts'
  | 'reflection' | 'recursive_planning' | 'self_critique'
  | 'debate' | 'simulation' | 'search' | 'constraint_solving'
  | 'symbolic' | 'rule_engine' | 'planning_engine' | 'world_model';

export interface ReasoningStep {
  id: EntityId;
  engine: ReasoningEngineType;
  input: unknown;
  output: unknown;
  confidence: Confidence;
  reasoning: string;
  cost: Cost;
  latency: number;
  timestamp: Timestamp;
  alternatives?: ReasoningStep[];
  metadata: Metadata;
}

export interface IReasoningEngine {
  readonly type: ReasoningEngineType;
  reason(input: unknown, context: CellContext): Promise<ReasoningStep[]>;
  getCapabilities(): string[];
  getCost(): Cost;
}

/* ============================================================
   POLICY & GOVERNANCE CORE TYPES
   ============================================================ */

export interface PolicyRule {
  id: EntityId;
  name: string;
  description: string;
  effect: 'allow' | 'deny' | 'require_approval';
  actions: string[];
  resources: string[];
  conditions: PolicyCondition[];
  priority: number;
  enabled: boolean;
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'matches';
  value: unknown;
}

export interface IPolicyEngine {
  evaluate(action: string, resource: string, context: CellContext): Promise<PolicyDecision>;
  addRule(rule: PolicyRule): Promise<EntityId>;
  removeRule(id: EntityId): Promise<void>;
  getRules(): Promise<PolicyRule[]>;
}

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  matchedRules: PolicyRule[];
  reason: string;
}

/* ============================================================
   TOOL CORE TYPES
   ============================================================ */

export interface ToolDefinition {
  id: EntityId;
  name: string;
  description: string;
  version: Version;
  inputSchema: unknown;
  outputSchema: unknown;
  permissions: Permission[];
  cost: Cost;
  timeout: number;
  rateLimit: { maxPerMinute: number; maxPerHour: number };
  retryConfig: { maxRetries: number; backoffMs: number };
}

export interface ITool {
  readonly definition: ToolDefinition;
  execute(input: unknown, context: CellContext): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  cost: Cost;
  latency: number;
  error?: CogError;
  metadata: Metadata;
}

/* ============================================================
   OBSERVABILITY CORE TYPES
   ============================================================ */

export interface TelemetryEvent {
  id: EntityId;
  type: string;
  source: EntityId;
  timestamp: Timestamp;
  traceId: string;
  spanId: string;
  duration: number;
  attributes: Record<string, string | number | boolean>;
  status: 'ok' | 'error';
  error?: CogError;
}

export interface MetricSample {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Timestamp;
  unit: string;
}

export interface ITelemetry {
  recordEvent(event: TelemetryEvent): Promise<void>;
  recordMetric(sample: MetricSample): Promise<void>;
  queryEvents(filter: Partial<TelemetryEvent>): Promise<TelemetryEvent[]>;
  queryMetrics(name: string, timeRange: { from: Timestamp; to: Timestamp }): Promise<MetricSample[]>;
  export(): Promise<unknown>;
}

/* ============================================================
   ORCHESTRATION CORE TYPES
   ============================================================ */

export interface IAgent {
  id: EntityId;
  name: string;
  cells: EntityId[];
  start(context: CellContext): Promise<CellOutput>;
  stop(): Promise<void>;
  getState(): Promise<unknown>;
}

export interface IWorkflow {
  id: EntityId;
  name: string;
  steps: WorkflowStep[];
  execute(context: CellContext): Promise<CellOutput>;
}

export interface WorkflowStep {
  id: EntityId;
  type: 'cell' | 'condition' | 'parallel' | 'loop' | 'human_approval';
  target?: EntityId;
  input?: unknown;
  condition?: string;
  timeout?: number;
  retries?: number;
  onSuccess?: EntityId;
  onFailure?: EntityId;
}

/* ============================================================
   STORAGE CORE TYPES
   ============================================================ */

export interface IStorageAdapter {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  clear(): Promise<void>;
}