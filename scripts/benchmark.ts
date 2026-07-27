/**
 * Benchmark Suite — COS Graph Engine v2.1 Fase 1.3
 *
 * 7 benchmarks (B1-B7) midiendo throughput, speedup CSR vs Map,
 * pruning ratio, y perfil de memoria.
 *
 * Componentes:
 *   GraphGenerator   — 6 tipos de grafos sinteticos
 *   Measurer         — time, memory, warmup
 *   BenchmarkRunner  — orquestacion + 7 benchmarks
 *   ReportExporter   — JSON / Markdown / HTML / thresholds
 *
 * Zero dependencias externas.
 */

import { CSRGraph, CSRNode, CSRCell } from '../packages/graph/src/csr';
import {
  BeamPruning,
  VisitedPruning,
  LandmarkPruning,
  EarlyExitPruning,
} from '../packages/graph/src/pruning';

// ============================================================
// Types
// ============================================================

export interface Metrics {
  timeMs: number;
  memoryBytes: number;
  heapUsedMB: number;
  nodesProcessed: number;
  edgesProcessed: number;
  nodesPerMs: number;
  pruningRatio: number;
}

export interface Benchmark {
  id: string;
  name: string;
  description: string;
  graph: CSRGraph;
  setup: () => void;
  run: (graph: CSRGraph) => unknown;
  baseline: { nodesPerMs: number; memoryMB: number };
  threshold: Partial<{
    speedup: number;
    maxMemoryMB: number;
    minPruningRatio: number;
    maxNodesVisitedPercent: number;
    maxMemoryRatio: number;
  }>;
}

export interface BenchmarkResult {
  id: string;
  name: string;
  status: 'pass' | 'fail';
  metrics: Metrics;
  baseline: { nodesPerMs: number; memoryMB: number };
  speedup: number;
  memoryReduction: string;
  details: Record<string, unknown>;
}

export interface DiffReport {
  results: BenchmarkResult[];
  overallSpeedup: number;
  passCount: number;
  failCount: number;
  summary: string;
}

// ============================================================
// GraphGenerator
// ============================================================

export class GraphGenerator {
  static chain(n: number): CSRGraph {
    if (n < 0) throw new Error('n must be >= 0');
    const graph = new CSRGraph();
    for (let i = 0; i < n; i++) {
      graph.addNode({ id: `n${i}` });
    }
    for (let i = 0; i < n - 1; i++) {
      graph.addEdge(`n${i}`, `n${i + 1}`);
    }
    return graph;
  }

  static grid(rows: number, cols: number): CSRGraph {
    if (rows <= 0 || cols <= 0) throw new Error('rows and cols must be > 0');
    const graph = new CSRGraph();
    const id = (r: number, c: number) => `r${r}_c${c}`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        graph.addNode({ id: id(r, c) });
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c + 1 < cols) graph.addEdge(id(r, c), id(r, c + 1));
        if (r + 1 < rows) graph.addEdge(id(r, c), id(r + 1, c));
      }
    }
    return graph;
  }

  static social(n: number, degree: number): CSRGraph {
    if (n <= 0) throw new Error('n must be > 0');
    if (degree % 2 !== 0) throw new Error('degree must be even');
    const graph = new CSRGraph();
    const k = Math.floor(degree / 2);
    const id = (i: number) => `s${i}`;

    for (let i = 0; i < n; i++) graph.addNode({ id: id(i) });

    // Ring lattice: each node connects to k neighbors on each side
    for (let i = 0; i < n; i++) {
      for (let j = 1; j <= k; j++) {
        const target = (i + j) % n;
        graph.addEdge(id(i), id(target));
        graph.addEdge(id(target), id(i));
      }
    }

    // Rewire with probability 0.1 (Watts-Strogatz)
    for (let i = 0; i < n; i++) {
      for (let j = 1; j <= k; j++) {
        const target = (i + j) % n;
        if (Math.random() < 0.1) {
          graph.removeEdge(id(i), id(target));
          graph.removeEdge(id(target), id(i));
          let newTarget: number;
          do {
            newTarget = Math.floor(Math.random() * n);
          } while (newTarget === i || graph.hasEdge(id(i), id(newTarget)));
          graph.addEdge(id(i), id(newTarget));
          graph.addEdge(id(newTarget), id(i));
        }
      }
    }
    return graph;
  }

  static random(n: number, edgeProb: number): CSRGraph {
    if (n < 0) throw new Error('n must be >= 0');
    if (edgeProb < 0 || edgeProb > 1) throw new Error('edgeProb must be in [0, 1]');
    const graph = new CSRGraph();
    const id = (i: number) => `r${i}`;

    for (let i = 0; i < n; i++) graph.addNode({ id: id(i) });

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.random() < edgeProb) {
          graph.addEdge(id(i), id(j));
        }
      }
    }
    return graph;
  }

  static tree(depth: number, branching: number): CSRGraph {
    if (depth < 0) throw new Error('depth must be >= 0');
    if (branching <= 0) throw new Error('branching must be > 0');
    const graph = new CSRGraph();
    if (depth === 0) {
      graph.addNode({ id: 'root' });
      return graph;
    }

    // Total nodes: sum_{d=0}^{depth} branching^d = (branching^{depth+1} - 1) / (branching - 1)
    const totalNodes = Math.floor((Math.pow(branching, depth + 1) - 1) / (branching - 1));
    const id = (i: number) => `t${i}`;

    for (let i = 0; i < totalNodes; i++) graph.addNode({ id: id(i) });

    // For each node i, children are at branching*i+1 to branching*i+branching
    for (let i = 0; i < totalNodes; i++) {
      for (let b = 1; b <= branching; b++) {
        const child = branching * i + b;
        if (child < totalNodes) {
          graph.addEdge(id(i), id(child));
        }
      }
    }
    return graph;
  }

  static knowledge(n: number, clusters: number): CSRGraph {
    if (n <= 0) throw new Error('n must be > 0');
    if (clusters <= 0) throw new Error('clusters must be > 0');
    const graph = new CSRGraph();
    const clusterSize = Math.max(1, Math.floor(n / clusters));
    const actualClusters = Math.ceil(n / clusterSize);
    const id = (i: number) => `k${i}`;

    for (let i = 0; i < n; i++) graph.addNode({ id: id(i) });

    // Assign each node to a cluster
    const nodeCluster: number[] = [];
    for (let i = 0; i < n; i++) {
      nodeCluster.push(Math.min(Math.floor(i / clusterSize), actualClusters - 1));
    }

    // Intra-cluster edges (density 0.3)
    for (let c = 0; c < actualClusters; c++) {
      const clusterNodes: number[] = [];
      for (let i = 0; i < n; i++) {
        if (nodeCluster[i] === c) clusterNodes.push(i);
      }
      for (let a = 0; a < clusterNodes.length; a++) {
        for (let b = a + 1; b < clusterNodes.length; b++) {
          if (Math.random() < 0.3) {
            graph.addEdge(id(clusterNodes[a]), id(clusterNodes[b]));
          }
        }
      }
    }

    // Inter-cluster edges (density 0.01)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (nodeCluster[i] !== nodeCluster[j] && Math.random() < 0.01) {
          graph.addEdge(id(i), id(j));
        }
      }
    }

    return graph;
  }
}

// ============================================================
// Measurer
// ============================================================

export class Measurer {
  static time<T>(fn: () => T, iterations: number): { result: T; timeMs: number } {
    if (iterations < 1) throw new Error('iterations must be >= 1');

    // Cold run: primera ejecucion (JIT compilation, cache miss)
    fn();

    // Warm measured iterations
    const start = performance.now();
    let result: T = undefined as unknown as T;
    for (let i = 0; i < iterations; i++) {
      result = fn();
    }
    const end = performance.now();

    return {
      result,
      timeMs: (end - start) / iterations,
    };
  }

  static memory<T>(fn: () => T): { result: T; heapDelta: number } {
    // Force GC if available (Node --expose-gc)
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
    }

    const before = process.memoryUsage().heapUsed;
    const result = fn();
    const after = process.memoryUsage().heapUsed;

    const heapDelta = Math.max(0, after - before);
    return { result, heapDelta };
  }

  static measure<T>(fn: () => T, iterations: number): Metrics {
    // TODO: T-1.3b — implementar
    throw new Error('Not implemented: Measurer.measure');
  }

  static warmup<T>(fn: () => T, iterations: number): void {
    // TODO: T-1.3b — implementar
    throw new Error('Not implemented: Measurer.warmup');
  }
}

// ============================================================
// BenchmarkRunner
// ============================================================

export class BenchmarkRunner {
  private benchmarks: Map<string, Benchmark> = new Map();

  define(b: Benchmark): void {
    // TODO: T-1.3c — implementar
    throw new Error('Not implemented: BenchmarkRunner.define');
  }

  run(id: string): BenchmarkResult {
    // TODO: T-1.3c — implementar
    throw new Error('Not implemented: BenchmarkRunner.run');
  }

  runAll(): BenchmarkResult[] {
    // TODO: T-1.3c — implementar
    throw new Error('Not implemented: BenchmarkRunner.runAll');
  }

  compare(results: BenchmarkResult[], baseline: { nodesPerMs: number }): DiffReport {
    // TODO: T-1.3c — implementar
    throw new Error('Not implemented: BenchmarkRunner.compare');
  }
}

// ============================================================
// ReportExporter
// ============================================================

export class ReportExporter {
  static toJSON(report: DiffReport): string {
    // TODO: T-1.3d — implementar
    throw new Error('Not implemented: ReportExporter.toJSON');
  }

  static toMarkdown(report: DiffReport): string {
    // TODO: T-1.3d — implementar
    throw new Error('Not implemented: ReportExporter.toMarkdown');
  }

  static toHTML(report: DiffReport): string {
    // TODO: T-1.3d — implementar
    throw new Error('Not implemented: ReportExporter.toHTML');
  }

  static validateThresholds(report: DiffReport): boolean {
    // TODO: T-1.3d — implementar
    throw new Error('Not implemented: ReportExporter.validateThresholds');
  }
}

// ============================================================
// Benchmark Definitions (B1-B7)
// ============================================================

// Nota: estos benchmarks se instancian con sus grafos en el Runner.
// Los grafos se generan via GraphGenerator (a implementar en T-1.3a).
// Los thresholds se definen aqui como referencia de diseno.

export const BENCHMARK_DEFINITIONS: Omit<Benchmark, 'graph' | 'setup' | 'run'>[] = [
  {
    id: 'B1',
    name: 'bfs-chain-10k',
    description: 'BFS en cadena lineal de 10K nodos. Mide throughput puro de CSR.',
    baseline: { nodesPerMs: 1420, memoryMB: 4.2 },
    threshold: { speedup: 1.5, maxMemoryMB: 10 },
  },
  {
    id: 'B2',
    name: 'bfs-grid-100x100',
    description: 'BFS en grid 100x100 (10K nodos). Mide throughput en grafo 2D.',
    baseline: { nodesPerMs: 2100, memoryMB: 6.8 },
    threshold: { speedup: 1.5, maxMemoryMB: 15 },
  },
  {
    id: 'B3',
    name: 'bfs-social-5k',
    description: 'BFS small-world 5K nodos. Compara CSR vs Map<string, string[]>.',
    baseline: { nodesPerMs: 800, memoryMB: 3.5 },
    threshold: { speedup: 1.5, maxMemoryMB: 8 },
  },
  {
    id: 'B4',
    name: 'shortest-path-tree-1k',
    description: 'Bidirectional BFS en arbol de 10 niveles. Mide eficiencia de poda.',
    baseline: { nodesPerMs: 500, memoryMB: 2.0 },
    threshold: { maxNodesVisitedPercent: 30 },
  },
  {
    id: 'B5',
    name: 'pruning-beam-10k',
    description: 'Beam pruning (K=50) en random 10K. Mide pruning ratio.',
    baseline: { nodesPerMs: 300, memoryMB: 5.0 },
    threshold: { minPruningRatio: 0.4 },
  },
  {
    id: 'B6',
    name: 'pruning-landmark-5k',
    description: 'Landmark pruning (L=5) + EarlyExit en knowledge 5K. Mide pruning ratio.',
    baseline: { nodesPerMs: 250, memoryMB: 4.0 },
    threshold: { minPruningRatio: 0.35 },
  },
  {
    id: 'B7',
    name: 'memory-profile',
    description: 'Perfil de memoria CSR vs Map para N=1K, 10K, 100K.',
    baseline: { nodesPerMs: 0, memoryMB: 0 },
    threshold: { maxMemoryRatio: 0.5 },
  },
];

// ============================================================
// CLI entry point
// ============================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const suiteIndex = args.indexOf('--suite');
  const suite = suiteIndex >= 0 ? args[suiteIndex + 1] : 'all';
  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : 'json';
  const validate = args.includes('--validate');

  console.log(`COS Benchmark Suite v2.1`);
  console.log(`Suite: ${suite}, Output: ${output}, Validate: ${validate}`);
  console.log(`\nNOTA: Los componentes aun no estan implementados.`);
  console.log(`Ejecute 'npx tsx scripts/test-benchmark.ts' para ver los tests.`);
}