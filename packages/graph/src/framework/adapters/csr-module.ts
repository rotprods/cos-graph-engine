import {
  COS_GRAPH_PROTOCOL_VERSION,
  GraphCapability,
  GraphModule,
  GraphSchema,
  defineGraphCapability,
  defineGraphModule,
} from '../protocol';
import { CanonicalGraphDocument, parseGraphDocument } from '../model';

interface LegacyCSRTraversal {
  readonly id: string;
  readonly depth: number;
}

interface LegacyCSRGraph {
  addNode(node: Readonly<Record<string, unknown>> & { readonly id: string }): void;
  addEdge(source: string, target: string, data?: Readonly<Record<string, unknown>>): string;
  bfs(source: string, maxDepth?: number): LegacyCSRTraversal[];
  nodeCount(): number;
  edgeCount(): number;
}

type LegacyCSRConstructor = new () => LegacyCSRGraph;

export interface CSRBFSInput {
  readonly graph: CanonicalGraphDocument;
  readonly source: string;
  readonly maxDepth?: number;
}

export interface CSRBFSResult {
  readonly visits: readonly LegacyCSRTraversal[];
  readonly nodeCount: number;
  readonly canonicalEdgeCount: number;
  readonly projectedEdgeCount: number;
}

export interface CSRStatsInput {
  readonly graph: CanonicalGraphDocument;
}

export interface CSRProjectionStats {
  readonly nodeCount: number;
  readonly canonicalEdgeCount: number;
  readonly projectedEdgeCount: number;
  readonly undirectedEdgeCount: number;
}

export type CSRAdapterErrorCode =
  | 'CSR_ENGINE_UNAVAILABLE'
  | 'CSR_PARALLEL_EDGE_UNSUPPORTED';

export class CSRAdapterError extends Error {
  readonly code: CSRAdapterErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: CSRAdapterErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'CSRAdapterError';
    this.code = code;
    this.details = details;
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function loadLegacyCSRConstructor(): LegacyCSRConstructor {
  const loaded: unknown = require('../../csr');
  if (typeof loaded !== 'object' || loaded === null || !('CSRGraph' in loaded)) {
    throw new CSRAdapterError('CSR_ENGINE_UNAVAILABLE', 'Legacy CSR module did not expose CSRGraph');
  }
  const constructorValue = (loaded as { readonly CSRGraph?: unknown }).CSRGraph;
  if (typeof constructorValue !== 'function') {
    throw new CSRAdapterError('CSR_ENGINE_UNAVAILABLE', 'Legacy CSRGraph export is not constructable');
  }
  return constructorValue as LegacyCSRConstructor;
}

function projectedPairKey(source: string, target: string): string {
  return `${source.length}:${source}${target.length}:${target}`;
}

function projectToLegacyCSR(document: CanonicalGraphDocument): {
  graph: LegacyCSRGraph;
  projectedEdgeCount: number;
  undirectedEdgeCount: number;
} {
  const CSRGraph = loadLegacyCSRConstructor();
  const graph = new CSRGraph();
  for (const node of document.nodes) {
    graph.addNode({ id: node.id, type: node.type ?? '', labels: node.labels, properties: node.properties });
  }

  const projectedPairs = new Set<string>();
  let projectedEdgeCount = 0;
  let undirectedEdgeCount = 0;

  const addProjectedEdge = (
    source: string,
    target: string,
    edgeId: string,
    properties: Readonly<Record<string, unknown>>,
  ): void => {
    const pair = projectedPairKey(source, target);
    if (projectedPairs.has(pair)) {
      throw new CSRAdapterError(
        'CSR_PARALLEL_EDGE_UNSUPPORTED',
        'Legacy CSR storage cannot preserve multiple canonical edges with the same directed endpoints',
        { source, target, edgeId },
      );
    }
    projectedPairs.add(pair);
    graph.addEdge(source, target, { ...properties, canonicalEdgeId: edgeId });
    projectedEdgeCount += 1;
  };

  for (const edge of document.edges) {
    addProjectedEdge(edge.source, edge.target, edge.id, edge.properties);
    if (!edge.directed) {
      undirectedEdgeCount += 1;
      if (edge.source !== edge.target) {
        addProjectedEdge(edge.target, edge.source, edge.id, edge.properties);
      }
    }
  }

  return { graph, projectedEdgeCount, undirectedEdgeCount };
}

const bfsInputSchema: GraphSchema<CSRBFSInput> = {
  parse(value: unknown): CSRBFSInput {
    const record = asRecord(value, 'CSR BFS input');
    if (typeof record.source !== 'string' || record.source.length === 0) throw new TypeError('CSR BFS source must be a non-empty string');
    if (
      record.maxDepth !== undefined &&
      (!Number.isSafeInteger(record.maxDepth) || (record.maxDepth as number) < 0)
    ) {
      throw new TypeError('CSR BFS maxDepth must be a non-negative safe integer');
    }
    return Object.freeze({
      graph: parseGraphDocument(record.graph),
      source: record.source,
      ...(record.maxDepth !== undefined ? { maxDepth: record.maxDepth as number } : {}),
    });
  },
};

const bfsOutputSchema: GraphSchema<CSRBFSResult> = {
  parse(value: unknown): CSRBFSResult {
    const record = asRecord(value, 'CSR BFS result');
    if (!Array.isArray(record.visits)) throw new TypeError('CSR BFS visits must be an array');
    const visits = record.visits.map((entry) => {
      const visit = asRecord(entry, 'CSR BFS visit');
      if (typeof visit.id !== 'string' || !Number.isSafeInteger(visit.depth) || (visit.depth as number) < 0) {
        throw new TypeError('CSR BFS visit must contain id:string and depth:non-negative integer');
      }
      return Object.freeze({ id: visit.id, depth: visit.depth as number });
    });
    const nodeCount = record.nodeCount;
    const canonicalEdgeCount = record.canonicalEdgeCount;
    const projectedEdgeCount = record.projectedEdgeCount;
    if (![nodeCount, canonicalEdgeCount, projectedEdgeCount].every((entry) => Number.isSafeInteger(entry) && (entry as number) >= 0)) {
      throw new TypeError('CSR BFS result counts must be non-negative safe integers');
    }
    return Object.freeze({
      visits: Object.freeze(visits),
      nodeCount: nodeCount as number,
      canonicalEdgeCount: canonicalEdgeCount as number,
      projectedEdgeCount: projectedEdgeCount as number,
    });
  },
};

const statsInputSchema: GraphSchema<CSRStatsInput> = {
  parse(value: unknown): CSRStatsInput {
    const record = asRecord(value, 'CSR stats input');
    return Object.freeze({ graph: parseGraphDocument(record.graph) });
  },
};

const statsOutputSchema: GraphSchema<CSRProjectionStats> = {
  parse(value: unknown): CSRProjectionStats {
    const record = asRecord(value, 'CSR projection stats');
    const fields = ['nodeCount', 'canonicalEdgeCount', 'projectedEdgeCount', 'undirectedEdgeCount'] as const;
    for (const field of fields) {
      if (!Number.isSafeInteger(record[field]) || (record[field] as number) < 0) {
        throw new TypeError(`CSR projection stats ${field} must be a non-negative safe integer`);
      }
    }
    return Object.freeze({
      nodeCount: record.nodeCount as number,
      canonicalEdgeCount: record.canonicalEdgeCount as number,
      projectedEdgeCount: record.projectedEdgeCount as number,
      undirectedEdgeCount: record.undirectedEdgeCount as number,
    });
  },
};

export interface CSRFrameworkModule {
  readonly module: GraphModule;
  readonly bfs: GraphCapability<CSRBFSInput, CSRBFSResult>;
  readonly stats: GraphCapability<CSRStatsInput, CSRProjectionStats>;
}

export function createCSRFrameworkModule(): CSRFrameworkModule {
  const bfs = defineGraphCapability({
    descriptor: {
      id: 'cos.graph.csr.bfs',
      kind: 'adapter',
      version: '1.0.0-alpha.1',
      maturity: 'experimental',
      description: 'Run the existing COS CSR BFS implementation over a canonical GraphDocument projection',
      modes: ['stream'],
      determinism: 'deterministic',
      sideEffects: 'none',
      idempotency: 'none',
    },
    input: bfsInputSchema,
    output: bfsOutputSchema,
    execute(input) {
      const projection = projectToLegacyCSR(input.graph);
      return {
        visits: projection.graph.bfs(input.source, input.maxDepth),
        nodeCount: projection.graph.nodeCount(),
        canonicalEdgeCount: input.graph.edges.length,
        projectedEdgeCount: projection.projectedEdgeCount,
      };
    },
  });

  const stats = defineGraphCapability({
    descriptor: {
      id: 'cos.graph.csr.stats',
      kind: 'adapter',
      version: '1.0.0-alpha.1',
      maturity: 'experimental',
      description: 'Project a canonical GraphDocument into legacy COS CSR and report structural projection statistics',
      modes: ['stats'],
      determinism: 'deterministic',
      sideEffects: 'none',
      idempotency: 'none',
    },
    input: statsInputSchema,
    output: statsOutputSchema,
    execute(input) {
      const projection = projectToLegacyCSR(input.graph);
      return {
        nodeCount: projection.graph.nodeCount(),
        canonicalEdgeCount: input.graph.edges.length,
        projectedEdgeCount: projection.projectedEdgeCount,
        undirectedEdgeCount: projection.undirectedEdgeCount,
      };
    },
  });

  const module = defineGraphModule({
    manifest: {
      id: 'cos.graph.adapter.csr',
      name: 'COS Legacy CSR Adapter',
      version: '1.0.0-alpha.1',
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      maturity: 'experimental',
      description: 'Compatibility adapter that executes the existing CSR engine through the COS Graph Protocol',
      capabilities: [bfs.descriptor, stats.descriptor],
    },
    capabilities: [bfs, stats],
  });

  return Object.freeze({ module, bfs, stats });
}
