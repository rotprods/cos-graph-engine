export type OpType = 'add' | 'mul' | 'matmul' | 'conv2d' | 'relu' | 'softmax' | 'cross_entropy' | 'reduce_mean' | 'reshape' | 'concat' | 'neg' | 'sub' | 'div' | 'pow' | 'exp' | 'log' | 'tanh' | 'sigmoid' | 'constant';
export interface ComputeNode {
    id: string;
    name: string;
    op: OpType;
    inputShape?: string[];
    outputShape?: string;
    params?: Record<string, number>;
    value?: number;
    requiresGrad?: boolean;
}
export interface ComputeEdge {
    source: string;
    target: string;
    srcOutputIdx?: number;
}
export interface ComputeGraphData {
    nodes: ComputeNode[];
    edges: ComputeEdge[];
}
export declare class ComputationalGraph {
    nodes: ComputeNode[];
    edges: ComputeEdge[];
    private values;
    private gradients;
    addNode(n: ComputeNode): string;
    addEdge(e: ComputeEdge): void;
    /**
     * Build a proper MLP with multiple output logits for meaningful gradient flow.
     * Structure: x → matmul(w1) + b1 → relu → matmul(w2) → [logit0, logit1] → cross_entropy
     * logit0 = fc2, logit1 = extra leaf (mock bias for class 1)
     * With 2 inputs to cross_entropy, losses and gradients are non-zero.
     */
    buildMLP(inputDim?: number, hiddenDim?: number, numClasses?: number): void;
    /** Build expression graph: z = (x * y) + (w * v) with leaf values */
    buildExpression(): void;
    /** Topological sort (Kahn's algorithm) — standard forward edge direction (source → target) */
    topologicalSort(): string[];
    /**
     * Forward pass: compute all node values in topological order.
     * Leaf constant nodes (no inputs + value set) use their declared value.
     * Operation nodes apply computeOp to their input values.
     * Returns the value of the LAST output node in topological order.
     */
    forward(inputs: Record<string, number>): number;
    /**
     * Backward pass: compute gradients via reverse-mode autodiff.
     * Seeds d(output)/d(output) = 1.0 and propagates gradients backward
     * through the topological sort (in reverse order).
     * Returns a Map of nodeId → gradient value.
     */
    backward(): Map<string, number>;
    /** Local gradient computation for each op */
    private localGradient;
    private computeOp;
    /** Count trainable parameters */
    paramCount(): number;
    toMermaid(): string;
    /** Serialize the graph to a plain JSON object */
    toJSON(): ComputeGraphData;
    /** Deserialize a plain JSON object into a ComputationalGraph */
    static fromJSON(data: ComputeGraphData): ComputationalGraph;
}
//# sourceMappingURL=level7-compute.d.ts.map