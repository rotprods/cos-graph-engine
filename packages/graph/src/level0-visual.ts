// ================================================================
// LEVEL 0: VISUAL GRAPH — "Solo quiero dibujar algo"
// Renderers: Mermaid, Graphviz, ASCII, JSON
// Refactored: mutation API, adjacency maps, serialization, validation
// ================================================================

import { generateId } from '@cos/core';

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

export class MermaidRenderer {
  render(graph: VisualGraph): string {
    const dir = graph.direction || 'TB';
    let mermaid = `graph ${dir}\n  title: "${graph.title}"\n`;
    for (const node of graph.nodes) {
      const [open, close] = this.getShape(node);
      mermaid += `    ${node.id}${open}"${node.label}"${close}\n`;
    }
    for (const edge of graph.edges) {
      const style = edge.style === 'dashed' ? '-.-' : edge.style === 'dotted' ? '-.-' : '-->';
      const label = edge.label ? `|${edge.label}|` : '';
      mermaid += `    ${edge.source}${style}${label}${edge.target}\n`;
    }
    return mermaid;
  }

  private getShape(node: VisualNode): [string, string] {
    switch (node.type) {
      case 'start': return ['((', '))'];
      case 'end': return ['((', '))'];
      case 'decision': return ['{', '}'];
      case 'database': return ['[(', ')]'];
      case 'document': return ['>', ']'];
      default: return ['[', ']'];
    }
  }
}

export class GraphvizRenderer {
  render(graph: VisualGraph): string {
    const dir = graph.direction === 'LR' ? 'LR' : 'TB';
    let dot = `digraph "${graph.title}" {\n  rankdir=${dir};\n  node [style=rounded, fontname=Helvetica];\n`;
    for (const node of graph.nodes) {
      const shape = node.type === 'decision' ? 'diamond' : node.type === 'start' ? 'ellipse' : node.type === 'end' ? 'doublecircle' : node.type === 'database' ? 'cylinder' : 'box';
      const color = node.color || '#4ecca3';
      dot += `  ${node.id} [label="${node.label}", shape=${shape}, color="${color}", fontcolor="#333"];\n`;
    }
    for (const edge of graph.edges) {
      const style = edge.style === 'dashed' ? 'dashed' : 'solid';
      const color = edge.color || '#666';
      const label = edge.label ? ` label="${edge.label}"` : '';
      dot += `  ${edge.source} -> ${edge.target} [style=${style}, color="${color}"${label}];\n`;
    }
    dot += '}\n';
    return dot;
  }
}

export class ASCIITreeRenderer {
  render(graph: VisualGraph): string {
    let result = `╔════════════════════════════════════════════════╗\n`;
    result += `║  ${graph.title.padEnd(43)}║\n`;
    result += `╚════════════════════════════════════════════════╝\n\n`;
    const adjacency = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source)!.push(edge.target);
    }
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
    function drawTree(nodeId: string, prefix: string, isLast: boolean): string {
      const node = nodeMap.get(nodeId);
      if (!node) return '';
      let res = prefix + (isLast ? '└── ' : '├── ') + node.label + '\n';
      const children = adjacency.get(nodeId) || [];
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      for (let i = 0; i < children.length; i++) {
        res += drawTree(children[i], childPrefix, i === children.length - 1);
      }
      return res;
    }
    const allTargets = new Set(graph.edges.map(e => e.target));
    const roots = graph.nodes.filter(n => !allTargets.has(n.id));
    for (const root of roots) {
      result += drawTree(root.id, '', roots.indexOf(root) === roots.length - 1);
    }
    return result;
  }
}

export class JSONGraphExporter {
  export(graph: VisualGraph): string {
    return JSON.stringify({
      type: 'visual_graph',
      version: '0.1.0',
      title: graph.title,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodes: graph.nodes.map(n => ({ id: n.id, label: n.label, type: n.type || 'default' })),
      edges: graph.edges.map(e => ({ source: e.source, target: e.target, label: e.label || '' })),
      metadata: graph.metadata || {},
    }, null, 2);
  }
}

export class VisualGraphEngine {
  private graph: VisualGraph;
  private adj: Map<string, string[]> = new Map();
  private mermaid = new MermaidRenderer();
  private graphviz = new GraphvizRenderer();
  private ascii = new ASCIITreeRenderer();
  private json = new JSONGraphExporter();

  constructor(title: string = 'Visual Graph') {
    this.graph = { id: generateId(), title, nodes: [], edges: [] };
  }

  private buildAdjacency(): void {
    this.adj.clear();
    for (const n of this.graph.nodes) this.adj.set(n.id, []);
    for (const e of this.graph.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
    }
  }

  addNode(n: { id?: string; label: string; type?: VisualNode['type']; color?: string }): string {
    const id = n.id || generateId();
    if (this.graph.nodes.some(x => x.id === id)) throw new Error(`Node ${id} already exists`);
    this.graph.nodes.push({ id, label: n.label, type: n.type, color: n.color });
    this.buildAdjacency(); return id;
  }

  removeNode(nodeId: string): void {
    const idx = this.graph.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) throw new Error(`Node ${nodeId} not found`);
    this.graph.nodes.splice(idx, 1);
    this.graph.edges = this.graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.buildAdjacency();
  }

  addEdge(source: string, target: string, label?: string, style?: VisualEdge['style']): string {
    if (!this.graph.nodes.some(n => n.id === source)) throw new Error(`Source ${source} not found`);
    if (!this.graph.nodes.some(n => n.id === target)) throw new Error(`Target ${target} not found`);
    const id = generateId();
    this.graph.edges.push({ id, source, target, label, style });
    this.buildAdjacency(); return id;
  }

  removeEdge(edgeId: string): void {
    const idx = this.graph.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    this.graph.edges.splice(idx, 1); this.buildAdjacency();
  }

  getNode(nodeId: string): VisualNode | undefined { return this.graph.nodes.find(n => n.id === nodeId); }

  render(format: 'mermaid' | 'graphviz' | 'ascii' | 'json' = 'mermaid'): string {
    switch (format) {
      case 'mermaid': return this.mermaid.render(this.graph);
      case 'graphviz': return this.graphviz.render(this.graph);
      case 'ascii': return this.ascii.render(this.graph);
      case 'json': return this.json.export(this.graph);
    }
  }

  createFromEdges(title: string, edges: Array<{ from: string; to: string; label?: string }>): VisualGraph {
    const nodeSet = new Set<string>();
    const visualEdges: VisualEdge[] = [];
    for (const edge of edges) {
      nodeSet.add(edge.from); nodeSet.add(edge.to);
      visualEdges.push({ id: generateId(), source: edge.from, target: edge.to, label: edge.label });
    }
    this.graph = { id: generateId(), title, nodes: Array.from(nodeSet).map(id => ({ id, label: id })), edges: visualEdges };
    this.buildAdjacency();
    return this.graph;
  }

  buildFlowchart() {
    const start = this.addNode({ id: 'start', label: 'Start', type: 'start' });
    const process = this.addNode({ id: 'process', label: 'Process', type: 'process' });
    const decision = this.addNode({ id: 'decision', label: 'Valid?', type: 'decision' });
    const save = this.addNode({ id: 'save', label: 'Save', type: 'process' });
    const error = this.addNode({ id: 'error', label: 'Error', type: 'end' });
    const end = this.addNode({ id: 'end', label: 'End', type: 'end' });
    this.addEdge(start, process, 'start');
    this.addEdge(process, decision, 'check');
    this.addEdge(decision, save, 'yes');
    this.addEdge(decision, error, 'no');
    this.addEdge(save, end, 'done');
  }

  validate(): string[] {
    const errors: string[] = [];
    const ids = new Set<string>();
    for (const n of this.graph.nodes) {
      if (ids.has(n.id)) errors.push(`Duplicate node id: ${n.id}`);
      ids.add(n.id);
    }
    for (const e of this.graph.edges) {
      if (!this.graph.nodes.some(n => n.id === e.source)) errors.push(`Dangling edge source: ${e.source}`);
      if (!this.graph.nodes.some(n => n.id === e.target)) errors.push(`Dangling edge target: ${e.target}`);
    }
    return errors;
  }

  metrics() {
    const n = this.graph.nodes.length; const e = this.graph.edges.length;
    return { nodeCount: n, edgeCount: e, avgDegree: n > 0 ? (2 * e) / n : 0, nodeTypes: [...new Set(this.graph.nodes.map(n => n.type || 'default'))] };
  }

  toJSON(): VisualGraph { return JSON.parse(JSON.stringify(this.graph)); }
  static fromJSON(data: VisualGraph): VisualGraphEngine { const g = new VisualGraphEngine(data.title); g.graph = data; g.buildAdjacency(); return g; }

  toMermaid(): string { return this.render('mermaid'); }
  toGraphviz(): string { return this.render('graphviz'); }
  toASCII(): string { return this.render('ascii'); }
  toJSONString(): string { return this.render('json'); }
}