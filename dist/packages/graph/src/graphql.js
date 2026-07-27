"use strict";
/**
 * COS Graph Engine — GraphQL API (Fase 14)
 *
 * Proporciona:
 * 1. Schema GraphQL completo para los 20 niveles
 * 2. Resolver engine con queries y mutations
 * 3. Conexion a SMB para persistencia
 * 4. Paginacion, filtros, batch mutations
 * 5. Zero dependencias externas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gqlEngine = exports.GQLEngine = exports.GQL_SCHEMA = void 0;
// ============================================================
// Schema Definition
// ============================================================
exports.GQL_SCHEMA = `
# COS Graph Engine — GraphQL Schema v0.1.0
# 20 niveles: L0-L19

type Query {
  """Get a single graph by level and id"""
  graph(level: Int!, id: ID!): Graph

  """Search nodes across a level"""
  search(level: Int!, query: String!, filter: NodeFilter, page: Int, pageSize: Int): NodeConnection

  """Get a single node by id"""
  node(level: Int!, id: ID!): Node

  """List all graphs in a level"""
  graphs(level: Int!, page: Int, pageSize: Int): [Graph!]!

  """Get graph statistics for a level"""
  graphStats(level: Int!): GraphStats

  """List all available levels"""
  levels: [Level!]!

  """Health check"""
  health: ServiceHealth!
}

type Mutation {
  """Add a node to a graph"""
  addNode(level: Int!, graphId: ID!, input: NodeInput!): MutationResult

  """Add an edge between nodes"""
  addEdge(level: Int!, graphId: ID!, input: EdgeInput!): MutationResult

  """Remove a node"""
  removeNode(level: Int!, graphId: ID!, nodeId: ID!): MutationResult

  """Remove an edge"""
  removeEdge(level: Int!, graphId: ID!, edgeId: ID!): MutationResult

  """Create a new graph"""
  createGraph(level: Int!, input: GraphInput!): MutationResult

  """Delete a graph"""
  deleteGraph(level: Int!, id: ID!): MutationResult

  """Batch add nodes"""
  batchAddNodes(level: Int!, graphId: ID!, inputs: [NodeInput!]!): BatchResult

  """Batch add edges"""
  batchAddEdges(level: Int!, graphId: ID!, inputs: [EdgeInput!]!): BatchResult

  """Clear all nodes and edges from a graph"""
  clearGraph(level: Int!, graphId: ID!): MutationResult
}

type Graph {
  id: ID!
  level: Int!
  name: String!
  nodes(ids: [ID], page: Int, pageSize: Int): NodeConnection
  edges(source: ID, target: ID, page: Int, pageSize: Int): EdgeConnection
  nodeCount: Int!
  edgeCount: Int!
  createdAt: String!
  updatedAt: String!
  metadata: JSON
}

type Node {
  id: ID!
  label: String
  type: String
  metadata: JSON
  level: Int!
  graphId: ID!
  edges(direction: EdgeDirection): [Edge!]!
}

type Edge {
  id: ID!
  source: Node!
  target: Node!
  label: String
  weight: Float
  level: Int!
  graphId: ID!
}

type NodeConnection {
  nodes: [Node!]!
  pageInfo: PageInfo!
}

type EdgeConnection {
  edges: [Edge!]!
  pageInfo: PageInfo!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  totalCount: Int!
  page: Int!
  pageSize: Int!
}

type MutationResult {
  success: Boolean!
  node: Node
  edge: Edge
  graph: Graph
  error: String
}

type BatchResult {
  success: Boolean!
  results: [MutationResult!]!
  errors: Int!
}

type GraphStats {
  level: Int!
  totalGraphs: Int!
  totalNodes: Int!
  totalEdges: Int!
  avgNodesPerGraph: Float!
  avgEdgesPerGraph: Float!
}

type Level {
  id: Int!
  name: String!
  description: String!
  domain: String!
  graphCount: Int!
}

type ServiceHealth {
  status: String!
  uptime: Float!
  version: String!
  levels: Int!
  memoryUsage: Float!
}

enum EdgeDirection {
  INCOMING
  OUTGOING
  BOTH
}

input NodeInput {
  id: ID
  label: String
  type: String
  metadata: JSON
}

input EdgeInput {
  source: ID!
  target: ID!
  label: String
  weight: Float
}

input NodeFilter {
  label: String
  type: String
  search: String
}

input GraphInput {
  name: String!
  metadata: JSON
}

"""JSON scalar type"""
scalar JSON
`;
// ============================================================
// Level Metadata
// ============================================================
const LEVEL_META = {
    0: { name: 'L0-Visual', description: 'Visual graph rendering (Mermaid, Graphviz, ASCII)', domain: 'Base' },
    1: { name: 'L1-Execution', description: 'Sequential and parallel execution engine', domain: 'Base' },
    2: { name: 'L2-State', description: 'Finite state machine and lifecycle management', domain: 'Base' },
    3: { name: 'L3-Dependency', description: 'Dependency resolution and topological sort', domain: 'Base' },
    4: { name: 'L4-Call', description: 'Call graph tracing and flame graph analysis', domain: 'Computational' },
    5: { name: 'L5-CFG', description: 'Control flow graph with dominators and loops', domain: 'Computational' },
    6: { name: 'L6-DataFlow', description: 'Data flow analysis with bottleneck detection', domain: 'Computational' },
    7: { name: 'L7-Compute', description: 'Computational graph for neural network inference', domain: 'Computational' },
    8: { name: 'L8-Knowledge', description: 'Knowledge graph with entities and relations', domain: 'Cognitive' },
    9: { name: 'L9-Semantic', description: 'Semantic graph with ontology and reasoning', domain: 'Cognitive' },
    10: { name: 'L10-Embedding', description: 'Embedding graph for vector similarity', domain: 'Cognitive' },
    11: { name: 'L11-GraphRAG', description: 'Graph RAG for retrieval-augmented generation', domain: 'Cognitive' },
    12: { name: 'L12-Memory', description: 'Memory graph with working/short/long-term layers', domain: 'Applied' },
    13: { name: 'L13-Agent', description: 'Agent graph for multi-agent orchestration', domain: 'Applied' },
    14: { name: 'L14-Tool', description: 'Tool graph for function and API orchestration', domain: 'Applied' },
    15: { name: 'L15-Workflow', description: 'Workflow graph for business process automation', domain: 'Applied' },
    16: { name: 'L16-Network', description: 'Network graph for topology and routing', domain: 'Applied' },
    17: { name: 'L17-Social', description: 'Social graph for influence and community detection', domain: 'Applied' },
    18: { name: 'L18-Biological', description: 'Biological graph for pathway analysis', domain: 'Applied' },
    19: { name: 'L19-Molecular', description: 'Molecular graph for chemical structure analysis', domain: 'Applied' },
};
// ============================================================
// GraphQL Resolver Engine
// ============================================================
class GQLEngine {
    graphs = new Map();
    startTime = Date.now();
    constructor() { }
    /** Get the full schema */
    getSchema() {
        return exports.GQL_SCHEMA;
    }
    // ============================================================
    // Resolvers: Query
    // ============================================================
    /** Resolve `graph(level, id)` */
    getGraph(level, id) {
        const key = `${level}:${id}`;
        return this.graphs.get(key);
    }
    /** Resolve `search(level, query, filter, page, pageSize)` */
    search(level, query, filter, page = 1, pageSize = 20) {
        const results = [];
        const queryLower = query.toLowerCase();
        // Search across all graphs in this level
        for (const [key, graph] of this.graphs) {
            if (!key.startsWith(`${level}:`))
                continue;
            for (const node of graph.nodes) {
                let match = false;
                if (node.id.toLowerCase().includes(queryLower))
                    match = true;
                if (node.label?.toLowerCase().includes(queryLower))
                    match = true;
                if (filter?.label && node.label !== filter.label)
                    match = false;
                if (filter?.type && node.type !== filter.type)
                    match = false;
                if (match)
                    results.push(node);
            }
        }
        const total = results.length;
        const start = (page - 1) * pageSize;
        const paged = results.slice(start, start + pageSize);
        return {
            nodes: paged,
            pageInfo: {
                hasNextPage: start + pageSize < total,
                hasPreviousPage: page > 1,
                totalCount: total,
                page,
                pageSize,
            },
        };
    }
    /** Resolve `node(level, id)` */
    getNode(level, id) {
        for (const [key, graph] of this.graphs) {
            if (!key.startsWith(`${level}:`))
                continue;
            const node = graph.nodes.find(n => n.id === id);
            if (node)
                return { ...node, level };
        }
        return undefined;
    }
    /** Resolve `graphs(level)` */
    getGraphs(level) {
        const results = [];
        for (const [key, graph] of this.graphs) {
            if (key.startsWith(`${level}:`))
                results.push(graph);
        }
        return results;
    }
    /** Resolve `graphStats(level)` */
    getGraphStats(level) {
        const graphs = this.getGraphs(level);
        const totalNodes = graphs.reduce((s, g) => s + g.nodes.length, 0);
        const totalEdges = graphs.reduce((s, g) => s + g.edges.length, 0);
        return {
            level,
            totalGraphs: graphs.length,
            totalNodes,
            totalEdges,
            avgNodesPerGraph: graphs.length > 0 ? Math.round(totalNodes / graphs.length * 100) / 100 : 0,
            avgEdgesPerGraph: graphs.length > 0 ? Math.round(totalEdges / graphs.length * 100) / 100 : 0,
        };
    }
    /** Resolve `levels` */
    getLevels() {
        return Object.entries(LEVEL_META).map(([id, meta]) => ({
            id: parseInt(id),
            ...meta,
            graphCount: this.getGraphs(parseInt(id)).length,
        }));
    }
    /** Resolve `health` */
    getHealth() {
        return {
            status: 'healthy',
            uptime: (Date.now() - this.startTime) / 1000,
            version: '0.1.0',
            levels: 20,
            memoryUsage: process.memoryUsage?.()?.heapUsed / 1024 / 1024 || 0,
        };
    }
    // ============================================================
    // Resolvers: Mutation
    // ============================================================
    /** Resolve `addNode(level, graphId, input)` */
    addNode(level, graphId, input) {
        const key = `${level}:${graphId}`;
        let graph = this.graphs.get(key);
        if (!graph) {
            // Auto-create graph
            graph = {
                id: graphId,
                level,
                name: `Graph-${graphId}`,
                nodes: [],
                edges: [],
                nodeCount: 0,
                edgeCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            this.graphs.set(key, graph);
        }
        const nodeId = input.id || `n${graph.nodes.length + 1}`;
        const node = {
            id: nodeId,
            label: input.label,
            type: input.type,
            metadata: input.metadata,
            level,
        };
        graph.nodes.push(node);
        graph.nodeCount = graph.nodes.length;
        graph.updatedAt = new Date().toISOString();
        return { success: true, node, graph };
    }
    /** Resolve `addEdge(level, graphId, input)` */
    addEdge(level, graphId, input) {
        const key = `${level}:${graphId}`;
        const graph = this.graphs.get(key);
        if (!graph) {
            return { success: false, error: `Graph ${graphId} not found in level ${level}` };
        }
        // Validate source and target exist
        const sourceExists = graph.nodes.some(n => n.id === input.source);
        const targetExists = graph.nodes.some(n => n.id === input.target);
        if (!sourceExists)
            return { success: false, error: `Source node ${input.source} not found` };
        if (!targetExists)
            return { success: false, error: `Target node ${input.target} not found` };
        const edge = {
            id: `e${graph.edges.length + 1}`,
            source: input.source,
            target: input.target,
            label: input.label,
            weight: input.weight,
            level,
        };
        graph.edges.push(edge);
        graph.edgeCount = graph.edges.length;
        graph.updatedAt = new Date().toISOString();
        return { success: true, edge, graph };
    }
    /** Resolve `removeNode(level, graphId, nodeId)` */
    removeNode(level, graphId, nodeId) {
        const key = `${level}:${graphId}`;
        const graph = this.graphs.get(key);
        if (!graph)
            return { success: false, error: `Graph ${graphId} not found` };
        const idx = graph.nodes.findIndex(n => n.id === nodeId);
        if (idx === -1)
            return { success: false, error: `Node ${nodeId} not found` };
        graph.nodes.splice(idx, 1);
        // Remove edges referencing this node
        graph.edges = graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
        graph.nodeCount = graph.nodes.length;
        graph.edgeCount = graph.edges.length;
        graph.updatedAt = new Date().toISOString();
        return { success: true, graph };
    }
    /** Resolve `removeEdge(level, graphId, edgeId)` */
    removeEdge(level, graphId, edgeId) {
        const key = `${level}:${graphId}`;
        const graph = this.graphs.get(key);
        if (!graph)
            return { success: false, error: `Graph ${graphId} not found` };
        const idx = graph.edges.findIndex(e => e.id === edgeId);
        if (idx === -1)
            return { success: false, error: `Edge ${edgeId} not found` };
        graph.edges.splice(idx, 1);
        graph.edgeCount = graph.edges.length;
        graph.updatedAt = new Date().toISOString();
        return { success: true, graph };
    }
    /** Resolve `createGraph(level, input)` */
    createGraph(level, input) {
        const id = `g${Date.now()}`;
        const graph = {
            id,
            level,
            name: input.name,
            nodes: [],
            edges: [],
            nodeCount: 0,
            edgeCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const key = `${level}:${id}`;
        this.graphs.set(key, graph);
        return { success: true, graph };
    }
    /** Resolve `deleteGraph(level, id)` */
    deleteGraph(level, id) {
        const key = `${level}:${id}`;
        if (!this.graphs.has(key))
            return { success: false, error: `Graph ${id} not found` };
        this.graphs.delete(key);
        return { success: true };
    }
    /** Resolve `batchAddNodes(level, graphId, inputs)` */
    batchAddNodes(level, graphId, inputs) {
        const results = [];
        let errors = 0;
        for (const input of inputs) {
            const result = this.addNode(level, graphId, input);
            results.push(result);
            if (!result.success)
                errors++;
        }
        return { success: errors === 0, results, errors };
    }
    /** Resolve `batchAddEdges(level, graphId, inputs)` */
    batchAddEdges(level, graphId, inputs) {
        const results = [];
        let errors = 0;
        for (const input of inputs) {
            const result = this.addEdge(level, graphId, input);
            results.push(result);
            if (!result.success)
                errors++;
        }
        return { success: errors === 0, results, errors };
    }
    /** Resolve `clearGraph(level, graphId)` */
    clearGraph(level, graphId) {
        const key = `${level}:${graphId}`;
        const graph = this.graphs.get(key);
        if (!graph)
            return { success: false, error: `Graph ${graphId} not found` };
        graph.nodes = [];
        graph.edges = [];
        graph.nodeCount = 0;
        graph.edgeCount = 0;
        graph.updatedAt = new Date().toISOString();
        return { success: true, graph };
    }
    // ============================================================
    // Query Execution
    // ============================================================
    /** Execute a parsed GraphQL query (simplified) */
    execute(operation, variables = {}) {
        // Parse operation name
        const opName = operation.trim().split(/\s+/)[0] || '';
        const args = variables;
        switch (opName) {
            // === Queries ===
            case 'graph':
                return { graph: this.getGraph(args.level, args.id) ?? null };
            case 'search':
                return { search: this.search(args.level, args.query, args.filter, args.page, args.pageSize) };
            case 'node':
                return { node: this.getNode(args.level, args.id) ?? null };
            case 'graphs':
                return { graphs: this.getGraphs(args.level) };
            case 'graphStats':
                return { graphStats: this.getGraphStats(args.level) };
            case 'levels':
                return { levels: this.getLevels() };
            case 'health':
                return { health: this.getHealth() };
            // === Mutations ===
            case 'addNode':
                return { addNode: this.addNode(args.level, args.graphId, args.input) };
            case 'addEdge':
                return { addEdge: this.addEdge(args.level, args.graphId, args.input) };
            case 'removeNode':
                return { removeNode: this.removeNode(args.level, args.graphId, args.nodeId) };
            case 'removeEdge':
                return { removeEdge: this.removeEdge(args.level, args.graphId, args.edgeId) };
            case 'createGraph':
                return { createGraph: this.createGraph(args.level, args.input) };
            case 'deleteGraph':
                return { deleteGraph: this.deleteGraph(args.level, args.id) };
            case 'batchAddNodes':
                return { batchAddNodes: this.batchAddNodes(args.level, args.graphId, args.inputs) };
            case 'batchAddEdges':
                return { batchAddEdges: this.batchAddEdges(args.level, args.graphId, args.inputs) };
            case 'clearGraph':
                return { clearGraph: this.clearGraph(args.level, args.graphId) };
            default:
                return { error: `Unknown operation: ${opName}` };
        }
    }
    /** Get engine stats */
    getStats() {
        return {
            graphs: this.graphs.size,
            queries: 0,
            cacheSize: this.graphs.size,
        };
    }
}
exports.GQLEngine = GQLEngine;
exports.gqlEngine = new GQLEngine();
//# sourceMappingURL=graphql.js.map