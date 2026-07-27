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
export interface GQLNode {
    id: string;
    label?: string;
    type?: string;
    metadata?: Record<string, unknown>;
    level: number;
}
export interface GQLEdge {
    id?: string;
    source: string;
    target: string;
    label?: string;
    weight?: number;
    level: number;
}
export interface GQLGraph {
    id: string;
    level: number;
    name: string;
    nodes: GQLNode[];
    edges: GQLEdge[];
    nodeCount: number;
    edgeCount: number;
    createdAt: string;
    updatedAt: string;
}
export interface GQLPageInfo {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    totalCount: number;
    page: number;
    pageSize: number;
}
export interface GQLNodeConnection {
    nodes: GQLNode[];
    pageInfo: GQLPageInfo;
}
export interface GQLEdgeConnection {
    edges: GQLEdge[];
    pageInfo: GQLPageInfo;
}
export interface GQLMutationResult {
    success: boolean;
    node?: GQLNode;
    edge?: GQLEdge;
    graph?: GQLGraph;
    error?: string;
}
export interface GQLBatchResult {
    success: boolean;
    results: GQLMutationResult[];
    errors: number;
}
export interface GQLQuery {
    type: 'query' | 'mutation';
    operation: string;
    args: Record<string, unknown>;
    fields: string[];
}
export declare const GQL_SCHEMA = "\n# COS Graph Engine \u2014 GraphQL Schema v0.1.0\n# 20 niveles: L0-L19\n\ntype Query {\n  \"\"\"Get a single graph by level and id\"\"\"\n  graph(level: Int!, id: ID!): Graph\n\n  \"\"\"Search nodes across a level\"\"\"\n  search(level: Int!, query: String!, filter: NodeFilter, page: Int, pageSize: Int): NodeConnection\n\n  \"\"\"Get a single node by id\"\"\"\n  node(level: Int!, id: ID!): Node\n\n  \"\"\"List all graphs in a level\"\"\"\n  graphs(level: Int!, page: Int, pageSize: Int): [Graph!]!\n\n  \"\"\"Get graph statistics for a level\"\"\"\n  graphStats(level: Int!): GraphStats\n\n  \"\"\"List all available levels\"\"\"\n  levels: [Level!]!\n\n  \"\"\"Health check\"\"\"\n  health: ServiceHealth!\n}\n\ntype Mutation {\n  \"\"\"Add a node to a graph\"\"\"\n  addNode(level: Int!, graphId: ID!, input: NodeInput!): MutationResult\n\n  \"\"\"Add an edge between nodes\"\"\"\n  addEdge(level: Int!, graphId: ID!, input: EdgeInput!): MutationResult\n\n  \"\"\"Remove a node\"\"\"\n  removeNode(level: Int!, graphId: ID!, nodeId: ID!): MutationResult\n\n  \"\"\"Remove an edge\"\"\"\n  removeEdge(level: Int!, graphId: ID!, edgeId: ID!): MutationResult\n\n  \"\"\"Create a new graph\"\"\"\n  createGraph(level: Int!, input: GraphInput!): MutationResult\n\n  \"\"\"Delete a graph\"\"\"\n  deleteGraph(level: Int!, id: ID!): MutationResult\n\n  \"\"\"Batch add nodes\"\"\"\n  batchAddNodes(level: Int!, graphId: ID!, inputs: [NodeInput!]!): BatchResult\n\n  \"\"\"Batch add edges\"\"\"\n  batchAddEdges(level: Int!, graphId: ID!, inputs: [EdgeInput!]!): BatchResult\n\n  \"\"\"Clear all nodes and edges from a graph\"\"\"\n  clearGraph(level: Int!, graphId: ID!): MutationResult\n}\n\ntype Graph {\n  id: ID!\n  level: Int!\n  name: String!\n  nodes(ids: [ID], page: Int, pageSize: Int): NodeConnection\n  edges(source: ID, target: ID, page: Int, pageSize: Int): EdgeConnection\n  nodeCount: Int!\n  edgeCount: Int!\n  createdAt: String!\n  updatedAt: String!\n  metadata: JSON\n}\n\ntype Node {\n  id: ID!\n  label: String\n  type: String\n  metadata: JSON\n  level: Int!\n  graphId: ID!\n  edges(direction: EdgeDirection): [Edge!]!\n}\n\ntype Edge {\n  id: ID!\n  source: Node!\n  target: Node!\n  label: String\n  weight: Float\n  level: Int!\n  graphId: ID!\n}\n\ntype NodeConnection {\n  nodes: [Node!]!\n  pageInfo: PageInfo!\n}\n\ntype EdgeConnection {\n  edges: [Edge!]!\n  pageInfo: PageInfo!\n}\n\ntype PageInfo {\n  hasNextPage: Boolean!\n  hasPreviousPage: Boolean!\n  totalCount: Int!\n  page: Int!\n  pageSize: Int!\n}\n\ntype MutationResult {\n  success: Boolean!\n  node: Node\n  edge: Edge\n  graph: Graph\n  error: String\n}\n\ntype BatchResult {\n  success: Boolean!\n  results: [MutationResult!]!\n  errors: Int!\n}\n\ntype GraphStats {\n  level: Int!\n  totalGraphs: Int!\n  totalNodes: Int!\n  totalEdges: Int!\n  avgNodesPerGraph: Float!\n  avgEdgesPerGraph: Float!\n}\n\ntype Level {\n  id: Int!\n  name: String!\n  description: String!\n  domain: String!\n  graphCount: Int!\n}\n\ntype ServiceHealth {\n  status: String!\n  uptime: Float!\n  version: String!\n  levels: Int!\n  memoryUsage: Float!\n}\n\nenum EdgeDirection {\n  INCOMING\n  OUTGOING\n  BOTH\n}\n\ninput NodeInput {\n  id: ID\n  label: String\n  type: String\n  metadata: JSON\n}\n\ninput EdgeInput {\n  source: ID!\n  target: ID!\n  label: String\n  weight: Float\n}\n\ninput NodeFilter {\n  label: String\n  type: String\n  search: String\n}\n\ninput GraphInput {\n  name: String!\n  metadata: JSON\n}\n\n\"\"\"JSON scalar type\"\"\"\nscalar JSON\n";
export declare class GQLEngine {
    private graphs;
    private startTime;
    constructor();
    /** Get the full schema */
    getSchema(): string;
    /** Resolve `graph(level, id)` */
    getGraph(level: number, id: string): GQLGraph | undefined;
    /** Resolve `search(level, query, filter, page, pageSize)` */
    search(level: number, query: string, filter?: {
        label?: string;
        type?: string;
    }, page?: number, pageSize?: number): GQLNodeConnection;
    /** Resolve `node(level, id)` */
    getNode(level: number, id: string): GQLNode | undefined;
    /** Resolve `graphs(level)` */
    getGraphs(level: number): GQLGraph[];
    /** Resolve `graphStats(level)` */
    getGraphStats(level: number): {
        level: number;
        totalGraphs: number;
        totalNodes: number;
        totalEdges: number;
        avgNodesPerGraph: number;
        avgEdgesPerGraph: number;
    };
    /** Resolve `levels` */
    getLevels(): {
        id: number;
        name: string;
        description: string;
        domain: string;
        graphCount: number;
    }[];
    /** Resolve `health` */
    getHealth(): {
        status: string;
        uptime: number;
        version: string;
        levels: number;
        memoryUsage: number;
    };
    /** Resolve `addNode(level, graphId, input)` */
    addNode(level: number, graphId: string, input: {
        id?: string;
        label?: string;
        type?: string;
        metadata?: Record<string, unknown>;
    }): GQLMutationResult;
    /** Resolve `addEdge(level, graphId, input)` */
    addEdge(level: number, graphId: string, input: {
        source: string;
        target: string;
        label?: string;
        weight?: number;
    }): GQLMutationResult;
    /** Resolve `removeNode(level, graphId, nodeId)` */
    removeNode(level: number, graphId: string, nodeId: string): GQLMutationResult;
    /** Resolve `removeEdge(level, graphId, edgeId)` */
    removeEdge(level: number, graphId: string, edgeId: string): GQLMutationResult;
    /** Resolve `createGraph(level, input)` */
    createGraph(level: number, input: {
        name: string;
        metadata?: Record<string, unknown>;
    }): GQLMutationResult;
    /** Resolve `deleteGraph(level, id)` */
    deleteGraph(level: number, id: string): GQLMutationResult;
    /** Resolve `batchAddNodes(level, graphId, inputs)` */
    batchAddNodes(level: number, graphId: string, inputs: {
        id?: string;
        label?: string;
        type?: string;
        metadata?: Record<string, unknown>;
    }[]): GQLBatchResult;
    /** Resolve `batchAddEdges(level, graphId, inputs)` */
    batchAddEdges(level: number, graphId: string, inputs: {
        source: string;
        target: string;
        label?: string;
        weight?: number;
    }[]): GQLBatchResult;
    /** Resolve `clearGraph(level, graphId)` */
    clearGraph(level: number, graphId: string): GQLMutationResult;
    /** Execute a parsed GraphQL query (simplified) */
    execute(operation: string, variables?: Record<string, unknown>): Record<string, unknown>;
    /** Get engine stats */
    getStats(): {
        graphs: number;
        queries: number;
        cacheSize: number;
    };
}
export declare const gqlEngine: GQLEngine;
//# sourceMappingURL=graphql.d.ts.map