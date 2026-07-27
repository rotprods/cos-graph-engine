/**
 * SVG Renderer — COS Graph Engine v2.1 Fase 4 T-4.1
 *
 * Renderiza grafos CSR como SVG inline con force-directed layout.
 * Zero dependencias externas.
 */

import { CSRGraph, CSRNode, CSRCell } from '../../graph/src/csr';

// ============================================================
// Layout types
// ============================================================

export interface Point {
  x: number;
  y: number;
}

export type LayoutType = 'force' | 'tree' | 'radial';

export interface SVGRenderOptions {
  width?: number;
  height?: number;
  layout?: LayoutType;
  iterations?: number;
  nodeRadius?: number;
  edgeColor?: string;
  nodeColor?: string;
  labelColor?: string;
  backgroundColor?: string;
  showLabels?: boolean;
  arrowheads?: boolean;
}

// ============================================================
// ForceLayout — force-directed layout algorithm
// ============================================================

export class ForceLayout {
  private _positions: Map<string, Point> = new Map();
  private _velocities: Map<string, Point> = new Map();
  private _width: number;
  private _height: number;

  constructor(width = 800, height = 600) {
    this._width = width;
    this._height = height;
  }

  /** Compute layout for a graph */
  compute(
    graph: CSRGraph,
    iterations = 100,
    nodeRadius = 20
  ): Map<string, Point> {
    const nodes = graph.getAllNodes();
    const edges = graph.getAllEdges();

    // Initialize random positions
    for (const node of nodes) {
      this._positions.set(node.id, {
        x: Math.random() * this._width * 0.8 + this._width * 0.1,
        y: Math.random() * this._height * 0.8 + this._height * 0.1,
      });
      this._velocities.set(node.id, { x: 0, y: 0 });
    }

    // Simulate
    const k = Math.sqrt((this._width * this._height) / nodes.length);
    const dt = 0.1;
    const damping = 0.85;
    const idealEdgeLength = k * 1.5;

    for (let iter = 0; iter < iterations; iter++) {
      const forces: Map<string, Point> = new Map();
      for (const id of this._positions.keys()) {
        forces.set(id, { x: 0, y: 0 });
      }

      // Repulsion: Coulomb's law between all pairs
      const posArr = Array.from(this._positions.entries());
      for (let i = 0; i < posArr.length; i++) {
        for (let j = i + 1; j < posArr.length; j++) {
          const [idA, pA] = posArr[i];
          const [idB, pB] = posArr[j];
          let dx = pA.x - pB.x;
          let dy = pA.y - pB.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (k * k) / (dist * dist);
          dx = (dx / dist) * force;
          dy = (dy / dist) * force;
          forces.get(idA)!.x += dx;
          forces.get(idA)!.y += dy;
          forces.get(idB)!.x -= dx;
          forces.get(idB)!.y -= dy;
        }
      }

      // Attraction: Hooke's law along edges
      for (const edge of edges) {
        const pA = this._positions.get(edge.source);
        const pB = this._positions.get(edge.target);
        if (!pA || !pB) continue;

        let dx = pB.x - pA.x;
        let dy = pB.y - pA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const displacement = dist - idealEdgeLength;
        const force = displacement * 0.01;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        forces.get(edge.source)!.x += dx;
        forces.get(edge.source)!.y += dy;
        forces.get(edge.target)!.x -= dx;
        forces.get(edge.target)!.y -= dy;
      }

      // Center gravity
      const cx = this._width / 2;
      const cy = this._height / 2;
      for (const [id, pos] of this._positions) {
        const dx = cx - pos.x;
        const dy = cy - pos.y;
        forces.get(id)!.x += dx * 0.001;
        forces.get(id)!.y += dy * 0.001;
      }

      // Update positions with cooling
      const temperature = Math.max(0.01, 1 - iter / iterations);
      for (const [id, pos] of this._positions) {
        const vel = this._velocities.get(id)!;
        const f = forces.get(id)!;
        vel.x = (vel.x + f.x * dt) * damping;
        vel.y = (vel.y + f.y * dt) * damping;
        pos.x += vel.x * temperature;
        pos.y += vel.y * temperature;

        // Keep within bounds
        pos.x = Math.max(nodeRadius, Math.min(this._width - nodeRadius, pos.x));
        pos.y = Math.max(nodeRadius, Math.min(this._height - nodeRadius, pos.y));
      }
    }

    return this._positions;
  }
}

// ============================================================
// SVGGraphRenderer — render graph as SVG
// ============================================================

export class SVGGraphRenderer {
  private _layout: ForceLayout;

  constructor() {
    this._layout = new ForceLayout();
  }

  /** Render graph as SVG string */
  render(
    graph: CSRGraph,
    options: SVGRenderOptions = {}
  ): string {
    const width = options.width ?? 800;
    const height = options.height ?? 600;
    const nodeRadius = options.nodeRadius ?? 20;
    const edgeColor = options.edgeColor ?? '#58a6ff';
    const nodeColor = options.nodeColor ?? '#1f6feb';
    const labelColor = options.labelColor ?? '#c9d1d9';
    const bgColor = options.backgroundColor ?? '#0d1117';
    const showLabels = options.showLabels ?? true;
    const arrowheads = options.arrowheads ?? true;
    const iterations = options.iterations ?? 100;

    const layout = options.layout ?? 'force';
    const positions = this._computeLayout(graph, layout, width, height, iterations, nodeRadius);

    const lines: string[] = [];
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
    lines.push(`  <rect width="${width}" height="${height}" fill="${bgColor}" />`);

    // Defs
    lines.push('  <defs>');
    if (arrowheads) {
      lines.push(`    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">`);
      lines.push(`      <polygon points="0 0, 10 3.5, 0 7" fill="${edgeColor}" />`);
      lines.push('    </marker>');
    }
    // Node glow filter
    lines.push('    <filter id="glow">');
    lines.push('      <feGaussianBlur stdDeviation="2" result="blur" />');
    lines.push('      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>');
    lines.push('    </filter>');
    lines.push('  </defs>');

    // Edges
    const edges = graph.getAllEdges();
    for (const edge of edges) {
      const pA = positions.get(edge.source);
      const pB = positions.get(edge.target);
      if (!pA || !pB) continue;

      const marker = arrowheads ? ' marker-end="url(#arrowhead)"' : '';
      lines.push(`  <line x1="${pA.x.toFixed(1)}" y1="${pA.y.toFixed(1)}" x2="${pB.x.toFixed(1)}" y2="${pB.y.toFixed(1)}" stroke="${edgeColor}" stroke-width="${(edge.weight ?? 1).toFixed(1)}" opacity="0.6"${marker} />`);
    }

    // Nodes
    for (const [id, pos] of positions) {
      const node = graph.getNode(id);
      const label = node ? (node.label || id) : id;
      lines.push(`  <circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${nodeRadius}" fill="${nodeColor}" stroke="${edgeColor}" stroke-width="1.5" filter="url(#glow)" />`);
      if (showLabels) {
        lines.push(`  <text x="${pos.x.toFixed(1)}" y="${(pos.y + 4).toFixed(1)}" text-anchor="middle" fill="${labelColor}" font-size="11" font-family="sans-serif">${_escapeXml(label)}</text>`);
      }
    }

    lines.push('</svg>');
    return lines.join('\n');
  }

  private _computeLayout(
    graph: CSRGraph,
    layout: LayoutType,
    width: number,
    height: number,
    iterations: number,
    nodeRadius: number
  ): Map<string, Point> {
    switch (layout) {
      case 'force':
        return this._layout.compute(graph, iterations, nodeRadius);
      case 'tree':
        return this._treeLayout(graph, width, height);
      case 'radial':
        return this._radialLayout(graph, width, height);
      default:
        return this._layout.compute(graph, iterations, nodeRadius);
    }
  }

  private _treeLayout(graph: CSRGraph, width: number, height: number): Map<string, Point> {
    const positions = new Map<string, Point>();
    const nodes = graph.getAllNodes();
    if (nodes.length === 0) return positions;

    // BFS levels
    const visited = new Set<string>();
    const levels: Map<number, string[]> = new Map();
    const levelOf = new Map<string, number>();

    // Find root (first node with no incoming edges, or first node)
    const allEdges = graph.getAllEdges();
    const hasIncoming = new Set<string>();
    for (const e of allEdges) hasIncoming.add(e.target);
    const root = nodes.find(n => !hasIncoming.has(n.id)) || nodes[0];

    const queue: Array<{ id: string; depth: number }> = [{ id: root.id, depth: 0 }];
    visited.add(root.id);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const lvl = levels.get(depth) || [];
      lvl.push(id);
      levels.set(depth, lvl);
      levelOf.set(id, depth);

      for (const nid of graph.neighbors(id)) {
        if (!visited.has(nid)) {
          visited.add(nid);
          queue.push({ id: nid, depth: depth + 1 });
        }
      }
    }

    const maxDepth = levels.size;
    const vSpacing = height / (maxDepth + 1);

    for (const [depth, nodeIds] of levels) {
      const hSpacing = width / (nodeIds.length + 1);
      for (let i = 0; i < nodeIds.length; i++) {
        positions.set(nodeIds[i], {
          x: hSpacing * (i + 1),
          y: vSpacing * (depth + 1),
        });
      }
    }

    return positions;
  }

  private _radialLayout(graph: CSRGraph, width: number, height: number): Map<string, Point> {
    const positions = new Map<string, Point>();
    const nodes = graph.getAllNodes();
    if (nodes.length === 0) return positions;

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.35;

    // Place nodes in a circle ordered by degree (largest first)
    const sorted = [...nodes].sort((a, b) => graph.degree(b.id) - graph.degree(a.id));
    const angleStep = (2 * Math.PI) / sorted.length;

    for (let i = 0; i < sorted.length; i++) {
      const angle = angleStep * i - Math.PI / 2;
      positions.set(sorted[i].id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    }

    return positions;
  }
}

function _escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}