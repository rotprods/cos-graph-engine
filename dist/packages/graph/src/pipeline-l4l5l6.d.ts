import { CallGraphBuilder } from './level4-call';
import { CFGBuilder } from './level5-cfg';
import { DataFlowGraph } from './level6-dataflow';
export interface TraceEntry {
    name: string;
    module?: string;
    type?: 'function' | 'method' | 'api' | 'async' | 'external';
    line?: number;
    column?: number;
    duration?: number;
    timestamp?: number;
    children?: TraceEntry[];
}
export interface ProgramTrace {
    name: string;
    entries: TraceEntry[];
    totalDuration?: number;
}
export interface PipelineOptions {
    /** If true, propagates timing data from trace through to DataFlow */
    propagateTiming?: boolean;
    /** Default latency multiplier for trace entries without duration data */
    defaultLatencyMs?: number;
    /** Assigns throughput based on latency (ops/sec = 1000 / latency) */
    autoThroughput?: boolean;
}
export declare class PipelineL4L5L6 {
    private builder;
    private cfgBuilder;
    private dataFlow;
    callGraphId: string | null;
    cfgId: string | null;
    constructor();
    /** Step 1: Build a CallGraph from a structured program trace */
    traceToCallGraph(trace: ProgramTrace, options?: PipelineOptions): string;
    /** Step 2: Analyze a stack trace string into the CallGraph */
    analyzeStackTrace(graphId: string, stackLines: string[]): void;
    /** Step 3: Convert a CallGraph into a CFG */
    callGraphToCFG(graphId: string, options?: PipelineOptions): string;
    /** Step 4: Convert a CFG into a DataFlow graph */
    cfgToDataFlow(cfgId: string, options?: PipelineOptions): DataFlowGraph;
    /** End-to-end: trace -> CallGraph -> CFG -> DataFlow */
    traceToDataFlow(trace: ProgramTrace, options?: PipelineOptions): DataFlowGraph;
    /** Access underlying builders */
    getCallGraphBuilder(): CallGraphBuilder;
    getCFGBuilder(): CFGBuilder;
    getDataFlowGraph(): DataFlowGraph;
    /** Validate all three graphs */
    validate(): {
        l4: string[];
        l5: string[];
        l6: string[];
    };
    /** Metrics for all three graphs */
    metrics(): {
        l4: any;
        l5: any;
        l6: any;
    };
    private blockTypeToDataFlowType;
}
//# sourceMappingURL=pipeline-l4l5l6.d.ts.map