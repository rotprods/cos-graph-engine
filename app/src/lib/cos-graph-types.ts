export type GraphLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19;

export const GRAPH_LEVEL_NAMES: Record<GraphLevel, string> = {
  0: "Visual Graph", 1: "Execution Graph", 2: "State Machine",
  3: "Dependency Resolver", 4: "Call Graph", 5: "Control Flow Graph",
  6: "Data Flow", 7: "Compute", 8: "Knowledge Graph",
  9: "Semantic Graph", 10: "Embedding Graph", 11: "GraphRAG",
  12: "Memory Graph", 13: "Agent Graph", 14: "Tool Graph",
  15: "Workflow Graph", 16: "Network Graph", 17: "Social Graph",
  18: "Biological Graph", 19: "Molecular Graph",
};

export interface COSNode {
  id: string;
  type: GraphLevel;
  label: string;
  properties: Record<string, unknown>;
  source: string;
  sourceId?: string;
  embeddings?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface COSEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  properties?: Record<string, unknown>;
  createdAt: string;
}

export interface COSQuery {
  nodes?: { level?: GraphLevel; source?: string; limit?: number; offset?: number };
  search?: { query: string; level?: GraphLevel; limit?: number };
  path?: { from: string; to: string; maxDepth?: number };
}

export interface COSQueryResult {
  nodes: COSNode[];
  edges: COSEdge[];
  total: number;
  queryTime: number;
}