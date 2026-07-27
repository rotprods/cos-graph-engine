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
import { CSRGraph } from '../packages/graph/src/csr';
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
    baseline: {
        nodesPerMs: number;
        memoryMB: number;
    };
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
    baseline: {
        nodesPerMs: number;
        memoryMB: number;
    };
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
export declare class GraphGenerator {
    static chain(n: number): CSRGraph;
    static grid(rows: number, cols: number): CSRGraph;
    static social(n: number, degree: number): CSRGraph;
    static random(n: number, edgeProb: number): CSRGraph;
    static tree(depth: number, branching: number): CSRGraph;
    static knowledge(n: number, clusters: number): CSRGraph;
}
export declare class Measurer {
    static time<T>(fn: () => T, iterations: number): {
        result: T;
        timeMs: number;
    };
    static memory<T>(fn: () => T): {
        result: T;
        heapDelta: number;
    };
    static measure<T>(fn: () => T, iterations: number): Metrics;
    private static extractMetadata;
    static warmup<T>(fn: () => T, iterations: number): void;
}
export declare class BenchmarkRunner {
    private benchmarks;
    define(b: Benchmark): void;
    run(id: string): BenchmarkResult;
    runAll(): BenchmarkResult[];
    compare(results: BenchmarkResult[], baseline: {
        nodesPerMs: number;
    }): DiffReport;
}
export declare class ReportExporter {
    static toJSON(report: DiffReport): string;
    static toMarkdown(report: DiffReport): string;
    static toHTML(report: DiffReport): string;
    static validateThresholds(report: DiffReport): boolean;
}
export declare const BENCHMARK_DEFINITIONS: Omit<Benchmark, 'graph' | 'setup' | 'run'>[];
//# sourceMappingURL=benchmark.d.ts.map