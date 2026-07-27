export interface VisualNode {
    id: string;
    label: string;
    type?: 'process' | 'decision' | 'start' | 'end' | 'database' | 'document' | 'default';
    color?: string;
    shape?: string;
}
export interface VisualEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    style?: 'solid' | 'dashed' | 'dotted';
    color?: string;
}
export interface VisualGraph {
    id: string;
    title: string;
    nodes: VisualNode[];
    edges: VisualEdge[];
    direction?: 'TB' | 'LR' | 'RL' | 'BT';
    metadata?: Record<string, unknown>;
}
export declare class MermaidRenderer {
    render(graph: VisualGraph): string;
    private getShape;
}
export declare class GraphvizRenderer {
    render(graph: VisualGraph): string;
}
export declare class ASCIITreeRenderer {
    render(graph: VisualGraph): string;
}
export declare class JSONGraphExporter {
    export(graph: VisualGraph): string;
}
export declare class VisualGraphEngine {
    private graph;
    private adj;
    private mermaid;
    private graphviz;
    private ascii;
    private json;
    constructor(title?: string);
    private buildAdjacency;
    addNode(n: {
        id?: string;
        label: string;
        type?: VisualNode['type'];
        color?: string;
    }): string;
    removeNode(nodeId: string): void;
    addEdge(source: string, target: string, label?: string, style?: VisualEdge['style']): string;
    removeEdge(edgeId: string): void;
    getNode(nodeId: string): VisualNode | undefined;
    render(format?: 'mermaid' | 'graphviz' | 'ascii' | 'json'): string;
    createFromEdges(title: string, edges: Array<{
        from: string;
        to: string;
        label?: string;
    }>): VisualGraph;
    buildFlowchart(): void;
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        nodeTypes: ("start" | "default" | "document" | "end" | "process" | "decision" | "database")[];
    };
    toJSON(): VisualGraph;
    static fromJSON(data: VisualGraph): VisualGraphEngine;
    toMermaid(): string;
    toGraphviz(): string;
    toASCII(): string;
    toJSONString(): string;
}
//# sourceMappingURL=level0-visual.d.ts.map