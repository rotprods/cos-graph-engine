// LEVEL 7: COMPUTATIONAL GRAPH — "Operaciones matemáticas"
// Forward/backward pass, autograd, tensor shapes, gradient tape

export type OpType = 'add' | 'mul' | 'matmul' | 'conv2d' | 'relu' | 'softmax' | 'cross_entropy' | 'reduce_mean' | 'reshape' | 'concat' | 'neg' | 'sub' | 'div' | 'pow' | 'exp' | 'log' | 'tanh' | 'sigmoid' | 'constant';

export interface ComputeNode {
  id: string; name: string; op: OpType;
  inputShape?: string[]; outputShape?: string;
  params?: Record<string, number>;
  value?: number;          // Leaf constant value (used by forward if no inputs)
  requiresGrad?: boolean;
}

export interface ComputeEdge {
  source: string; target: string;
  srcOutputIdx?: number;
}

export interface ComputeGraphData {
  nodes: ComputeNode[];
  edges: ComputeEdge[];
}

export class ComputationalGraph {
  nodes: ComputeNode[] = []; edges: ComputeEdge[] = [];
  private values = new Map<string, number>();
  private gradients = new Map<string, number>();

  addNode(n: ComputeNode) { this.nodes.push(n); return n.id; }
  addEdge(e: ComputeEdge) { this.edges.push(e); }

  /**
   * Build a proper MLP with multiple output logits for meaningful gradient flow.
   * Structure: x → matmul(w1) + b1 → relu → matmul(w2) → [logit0, logit1] → cross_entropy
   * logit0 = fc2, logit1 = extra leaf (mock bias for class 1)
   * With 2 inputs to cross_entropy, losses and gradients are non-zero.
   */
  buildMLP(inputDim: number = 784, hiddenDim: number = 256, numClasses: number = 2) {
    // Input leaf
    this.addNode({ id: 'x', name: 'input', op: 'constant', value: 1, outputShape: `${inputDim}` });
    // Weight leaves (trainable parameters)
    this.addNode({ id: 'w1', name: 'weight_1', op: 'constant', value: 0.5, params: { rows: inputDim, cols: hiddenDim }, requiresGrad: true });
    this.addNode({ id: 'b1', name: 'bias_1', op: 'constant', value: 0.1, params: { dim: hiddenDim }, requiresGrad: true });
    this.addNode({ id: 'w2', name: 'weight_2', op: 'constant', value: 0.3, params: { rows: hiddenDim, cols: numClasses }, requiresGrad: true });
    // Second logit: separate leaf so cross_entropy receives 2 inputs for non-zero gradient
    this.addNode({ id: 'logit1', name: 'logit_class_1', op: 'constant', value: 0.05, params: { dim: 1 }, requiresGrad: true });
    // Operation nodes
    this.addNode({ id: 'fc1', name: 'fc1', op: 'matmul', outputShape: `${hiddenDim}` });
    this.addNode({ id: 'h1', name: 'h1', op: 'add', outputShape: `${hiddenDim}` });
    this.addNode({ id: 'r1', name: 'relu_1', op: 'relu', outputShape: `${hiddenDim}` });
    this.addNode({ id: 'fc2', name: 'fc2', op: 'matmul', outputShape: `${numClasses}` });
    this.addNode({ id: 'logit0', name: 'logit_class_0', op: 'add', outputShape: `1` });
    this.addNode({ id: 'loss', name: 'cross_entropy_loss', op: 'cross_entropy' });
    // Edges: x * w1 + b1 → relu → * w2 → fc2 (logit0 + bias) → loss (receives 2 inputs: logit0, logit1)
    this.addEdge({ source: 'x', target: 'fc1' });
    this.addEdge({ source: 'w1', target: 'fc1' });
    this.addEdge({ source: 'fc1', target: 'h1' });
    this.addEdge({ source: 'b1', target: 'h1' });
    this.addEdge({ source: 'h1', target: 'r1' });
    this.addEdge({ source: 'r1', target: 'fc2' });
    this.addEdge({ source: 'w2', target: 'fc2' });
    this.addEdge({ source: 'fc2', target: 'logit0' });
    this.addEdge({ source: 'logit0', target: 'loss' });  // logit for class 0 (input index 0)
    this.addEdge({ source: 'logit1', target: 'loss' });  // logit for class 1 (input index 1)
  }

  /** Build expression graph: z = (x * y) + (w * v) with leaf values */
  buildExpression() {
    this.addNode({ id: 'x', name: 'x', op: 'constant', value: 2, requiresGrad: true });
    this.addNode({ id: 'y', name: 'y', op: 'constant', value: 3, requiresGrad: true });
    this.addNode({ id: 'w', name: 'w', op: 'constant', value: 4, requiresGrad: true });
    this.addNode({ id: 'v', name: 'v', op: 'constant', value: 5, requiresGrad: true });
    this.addNode({ id: 't1', name: 'x*y', op: 'mul' });
    this.addNode({ id: 't2', name: 'w*v', op: 'mul' });
    this.addNode({ id: 'z', name: 'z = xy + wv', op: 'add' });
    this.addEdge({ source: 'x', target: 't1' }); this.addEdge({ source: 'y', target: 't1' });
    this.addEdge({ source: 'w', target: 't2' }); this.addEdge({ source: 'v', target: 't2' });
    this.addEdge({ source: 't1', target: 'z' }); this.addEdge({ source: 't2', target: 'z' });
  }

  /** Topological sort (Kahn's algorithm) — standard forward edge direction (source → target) */
  topologicalSort(): string[] {
    const inDeg = new Map<string, number>(); const adj = new Map<string, string[]>();
    for (const n of this.nodes) { inDeg.set(n.id, 0); adj.set(n.id, []); }
    for (const e of this.edges) { adj.get(e.source)!.push(e.target); inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1); }
    const q: string[] = []; for (const [id, d] of inDeg) if (d === 0) q.push(id);
    const r: string[] = []; while (q.length > 0) { const n = q.shift()!; r.push(n); for (const nb of adj.get(n) || []) { const nd = (inDeg.get(nb) || 1) - 1; inDeg.set(nb, nd); if (nd === 0) q.push(nb); } }
    return r;
  }

  /**
   * Forward pass: compute all node values in topological order.
   * Leaf constant nodes (no inputs + value set) use their declared value.
   * Operation nodes apply computeOp to their input values.
   * Returns the value of the LAST output node in topological order.
   */
  forward(inputs: Record<string, number>): number {
    const order = this.topologicalSort();
    this.values = new Map(Object.entries(inputs));

    for (const nodeId of order) {
      if (this.values.has(nodeId)) continue;
      const node = this.nodes.find(n => n.id === nodeId)!;
      if (!node) throw new Error(`Node '${nodeId}' not found in graph`);
      const inputEdges = this.edges.filter(e => e.target === nodeId);

      if (inputEdges.length === 0 && node.value !== undefined) {
        // Leaf constant node: use its declared value
        this.values.set(nodeId, node.value);
      } else {
        const inputValues = inputEdges.map(e => this.values.get(e.source) || 0);
        this.values.set(nodeId, this.computeOp(node.op, inputValues, node.params));
      }
    }
    // Find the last sink node (no outgoing edges) — this is the graph output
    const sinks = order.filter(id => !this.edges.some(e => e.source === id));
    const outputNode = sinks[sinks.length - 1] || order[order.length - 1];
    return this.values.get(outputNode) ?? 0;
  }

  /**
   * Backward pass: compute gradients via reverse-mode autodiff.
   * Seeds d(output)/d(output) = 1.0 and propagates gradients backward
   * through the topological sort (in reverse order).
   * Returns a Map of nodeId → gradient value.
   */
  backward(): Map<string, number> {
    const order = this.topologicalSort().reverse();
    this.gradients = new Map();

    // Find the output node (last sink in topological order)
    const sinks = order.filter(id => !this.edges.some(e => e.source === id));
    const outputNode = sinks[sinks.length - 1] || order[0];
    this.gradients.set(outputNode, 1.0); // seed: d(output)/d(output) = 1.0

    for (const nodeId of order) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      const grad = this.gradients.get(nodeId) || 0;
      if (Math.abs(grad) < 1e-10) continue; // skip zero-gradient nodes (dead branches)

      const inputIds = this.edges.filter(e => e.target === nodeId).map(e => e.source);
      const inputVals = inputIds.map(id => this.values.get(id) || 0);

      const localGrads = this.localGradient(node.op, grad, inputVals);
      for (let i = 0; i < inputIds.length; i++) {
        const existing = this.gradients.get(inputIds[i]) || 0;
        this.gradients.set(inputIds[i], existing + (localGrads[i] || 0));
      }
    }
    return this.gradients;
  }

  /** Local gradient computation for each op */
  private localGradient(op: OpType, upstreamGrad: number, inputs: number[]): number[] {
    switch (op) {
      case 'constant': return [];
      case 'add': return inputs.map(() => upstreamGrad);
      case 'mul': return [upstreamGrad * (inputs[1] || 0), upstreamGrad * (inputs[0] || 0)];
      case 'neg': return [-upstreamGrad];
      case 'sub': return [upstreamGrad, -upstreamGrad];
      case 'div': return [upstreamGrad / Math.max(1e-10, inputs[1] || 1), -upstreamGrad * (inputs[0] || 0) / Math.max(1e-10, (inputs[1] || 1) ** 2)];
      case 'pow': return [upstreamGrad * (inputs[1] || 1) * Math.pow(inputs[0] || 0, (inputs[1] || 1) - 1)];
      case 'exp': return [upstreamGrad * Math.exp(inputs[0] || 0)];
      case 'log': return [upstreamGrad / Math.max(1e-10, inputs[0] || 1)];
      case 'relu': return [upstreamGrad * ((inputs[0] || 0) > 0 ? 1 : 0)];
      case 'tanh': { const t = Math.tanh(inputs[0] || 0); return [upstreamGrad * (1 - t * t)]; }
      case 'sigmoid': { const s = 1 / (1 + Math.exp(-(inputs[0] || 0))); return [upstreamGrad * s * (1 - s)]; }
      case 'matmul': return [upstreamGrad * (inputs[1] || 1), upstreamGrad * (inputs[0] || 0)];
      case 'softmax': {
        const s = 1 / (inputs.length || 1);
        return inputs.map(() => upstreamGrad * s * (1 - s));
      }
      case 'cross_entropy': {
        // Gradient of cross_entropy w.r.t. logits: dL/dz_i = softmax(z_i) - y_i
        // where y_i is one-hot (true class = index 0)
        const maxInput = Math.max(...inputs, 0);
        const exps = inputs.map(x => Math.exp(x - maxInput));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        const softmaxProbs = sumExps > 0 ? exps.map(x => x / sumExps) : inputs.map(() => 1 / inputs.length);
        return softmaxProbs.map((p, i) => upstreamGrad * (p - (i === 0 ? 1 : 0)));
      }
      default: return inputs.map(() => upstreamGrad);
    }
  }

  private computeOp(op: OpType, inputs: number[], params?: Record<string, number>): number {
    switch (op) {
      case 'constant':
        // Dead code path: leaf constants are handled by forward() before calling computeOp.
        // This handler exists as a safety fallback for edge cases.
        return inputs.length > 0 ? inputs[0] : (params?.value as number ?? 0);
      case 'add': return inputs.reduce((a, b) => a + b, 0);
      case 'mul': return inputs.reduce((a, b) => a * b, 1);
      case 'sub': return inputs[0] - (inputs[1] || 0);
      case 'div': return (inputs[0] || 0) / Math.max(1e-10, inputs[1] || 1);
      case 'neg': return -(inputs[0] || 0);
      case 'pow': return Math.pow(inputs[0] || 0, inputs[1] || 1);
      case 'exp': return Math.exp(inputs[0] || 0);
      case 'log': return Math.log(Math.max(1e-10, inputs[0] || 1));
      case 'tanh': return Math.tanh(inputs[0] || 0);
      case 'sigmoid': return 1 / (1 + Math.exp(-(inputs[0] || 0)));
      case 'matmul': return (inputs[0] || 0) * (inputs[1] || 1);
      case 'relu': return Math.max(0, inputs[0] || 0);
      case 'softmax': {
        const maxInput = Math.max(...inputs, 0);
        const exps = inputs.map(x => Math.exp(x - maxInput));
        const sum = exps.reduce((a, b) => a + b, 0);
        return sum > 0 ? exps[0] / sum : 1 / inputs.length;
      }
      case 'cross_entropy': {
        // Cross-entropy = -log(softmax_output[correct_class])
        const maxInput = Math.max(...inputs, 0);
        const exps = inputs.map(x => Math.exp(x - maxInput));
        const sumExps = exps.reduce((s, x) => s + x, 0);  // sum already-exp values
        const prob = sumExps > 0 ? exps[0] / sumExps : 1e-10;
        return -Math.log(Math.max(1e-10, prob));
      }
      case 'reduce_mean': return inputs.reduce((a, b) => a + b, 0) / Math.max(1, inputs.length);
      case 'reshape': return inputs[0] || 0;
      default: return inputs[0] || 0;
    }
  }

  /** Count trainable parameters */
  paramCount(): number { return this.nodes.filter(n => n.requiresGrad).length; }

  toMermaid(): string {
    let m = 'graph TD\n';
    for (const n of this.nodes) {
      const shape = n.op === 'cross_entropy' ? '((' : n.op === 'relu' || n.op === 'tanh' || n.op === 'sigmoid' ? '{' : '[';
      const close = n.op === 'cross_entropy' ? '))' : n.op === 'relu' || n.op === 'tanh' || n.op === 'sigmoid' ? '}' : ']';
      m += `    ${n.id}${shape}"${n.name} [${n.op}]"${close}\n`;
    }
    for (const e of this.edges) m += `    ${e.source} --> ${e.target}\n`;
    return m;
  }

  /** Serialize the graph to a plain JSON object */
  toJSON(): ComputeGraphData {
    return { nodes: this.nodes, edges: this.edges };
  }

  /** Deserialize a plain JSON object into a ComputationalGraph */
  static fromJSON(data: ComputeGraphData): ComputationalGraph {
    const g = new ComputationalGraph();
    g.nodes = data.nodes;
    g.edges = data.edges;
    return g;
  }
}
