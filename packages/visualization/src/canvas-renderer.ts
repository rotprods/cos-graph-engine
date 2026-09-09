/**
 * Canvas Renderer — COS Graph Engine v2.1 Fase 4 T-4.2
 *
 * Renderiza grafos en Canvas con quadtree culling, zoom, pan.
 * Zero dependencias externas.
 */

import { CSRGraph, CSRNode, CSRCell } from '../../graph/src/csr';

// ============================================================
// Point / Rect
// ============================================================

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================
// Quadtree — spatial index for culling
// ============================================================

const MAX_OBJECTS = 10;
const MAX_DEPTH = 10;

interface QuadTreeItem {
  id: string;
  x: number;
  y: number;
}

export class QuadTree {
  private _items: QuadTreeItem[] = [];
  private _children: QuadTree[] | null = null;
  private _bounds: Rect;
  private _depth: number;

  constructor(bounds: Rect, depth = 0) {
    this._bounds = bounds;
    this._depth = depth;
  }

  /** Insert a node into the quadtree */
  insert(id: string, x: number, y: number): void {
    if (this._children) {
      this._insertIntoChild(id, x, y);
      return;
    }

    this._items.push({ id, x, y });

    if (this._items.length > MAX_OBJECTS && this._depth < MAX_DEPTH) {
      this._split();
    }
  }

  /** Query all nodes within a viewport rect */
  query(rect: Rect): string[] {
    const result: string[] = [];

    if (!this._intersects(rect, this._bounds)) return result;

    if (this._children) {
      for (const child of this._children) {
        result.push(...child.query(rect));
      }
    } else {
      for (const item of this._items) {
        if (this._pointInRect(item.x, item.y, rect)) {
          result.push(item.id);
        }
      }
    }

    return result;
  }

  /** Clear all nodes */
  clear(): void {
    this._items = [];
    this._children = null;
  }

  get itemCount(): number { return this._items.length; }
  get bounds(): Rect { return this._bounds; }

  private _split(): void {
    const { x, y, width, height } = this._bounds;
    const hw = width / 2;
    const hh = height / 2;

    this._children = [
      new QuadTree({ x, y, width: hw, height: hh }, this._depth + 1),           // NW
      new QuadTree({ x: x + hw, y, width: hw, height: hh }, this._depth + 1),   // NE
      new QuadTree({ x, y: y + hh, width: hw, height: hh }, this._depth + 1),   // SW
      new QuadTree({ x: x + hw, y: y + hh, width: hw, height: hh }, this._depth + 1), // SE
    ];

    for (const item of this._items) {
      this._insertIntoChild(item.id, item.x, item.y);
    }
    this._items = [];
  }

  private _insertIntoChild(id: string, x: number, y: number): void {
    if (!this._children) return;
    for (const child of this._children) {
      if (this._pointInRect(x, y, child._bounds)) {
        child.insert(id, x, y);
        return;
      }
    }
    // Fallback: keep in parent if no child matches
    this._items.push({ id, x, y });
  }

  private _pointInRect(px: number, py: number, r: Rect): boolean {
    return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
  }

  private _intersects(a: Rect, b: Rect): boolean {
    return !(a.x + a.width < b.x || b.x + b.width < a.x ||
             a.y + a.height < b.y || b.y + b.height < a.y);
  }
}

// ============================================================
// RenderCommand — serializable draw instructions
// ============================================================

export interface RenderCommand {
  type: 'node' | 'edge' | 'label';
  id: string;
  x: number;
  y: number;
  color?: string;
  radius?: number;
  targetX?: number;
  targetY?: number;
  weight?: number;
  label?: string;
}

// ============================================================
// CanvasGraphRenderer — render pipeline
// ============================================================

export class CanvasGraphRenderer {
  private _positions: Map<string, Point> = new Map();
  private _quadTree: QuadTree;
  private _zoom = 1;
  private _panX = 0;
  private _panY = 0;
  private _width: number;
  private _height: number;
  private _nodeRadius: number;
  private _nodeColor: string;
  private _edgeColor: string;
  private _labelColor: string;
  private _bgColor: string;

  constructor(width = 800, height = 600) {
    this._width = width;
    this._height = height;
    this._nodeRadius = 20;
    this._nodeColor = '#1f6feb';
    this._edgeColor = '#58a6ff';
    this._labelColor = '#c9d1d9';
    this._bgColor = '#0d1117';
    this._quadTree = new QuadTree({ x: 0, y: 0, width, height });
  }

  /** Set graph data + positions */
  setData(graph: CSRGraph, positions: Map<string, Point>): void {
    this._positions = positions;
    this._quadTree.clear();
    for (const [id, pos] of positions) {
      this._quadTree.insert(id, pos.x, pos.y);
    }
  }

  /** Get render commands for viewport */
  getRenderCommands(graph: CSRGraph): RenderCommand[] {
    const commands: RenderCommand[] = [];

    // Visible nodes via quadtree
    const viewport = this._viewportRect();
    const visibleIds = new Set(this._quadTree.query(viewport));

    // Edges
    for (const edge of graph.getAllEdges()) {
      const pA = this._positions.get(edge.source);
      const pB = this._positions.get(edge.target);
      if (!pA || !pB) continue;
      if (!visibleIds.has(edge.source) && !visibleIds.has(edge.target)) continue;

      commands.push({
        type: 'edge',
        id: `${edge.source}->${edge.target}`,
        x: this._screenX(pA.x),
        y: this._screenY(pA.y),
        targetX: this._screenX(pB.x),
        targetY: this._screenY(pB.y),
        color: this._edgeColor,
        weight: edge.weight ?? 1,
      });
    }

    // Nodes
    for (const id of visibleIds) {
      const pos = this._positions.get(id);
      if (!pos) continue;

      const node = graph.getNode(id);
      commands.push({
        type: 'node',
        id,
        x: this._screenX(pos.x),
        y: this._screenY(pos.y),
        color: this._nodeColor,
        radius: this._nodeRadius * this._zoom,
        label: node && typeof node.label === 'string' ? node.label : id,
      });
    }

    return commands;
  }

  /** Zoom controls */
  get zoom(): number { return this._zoom; }
  setZoom(z: number): void {
    this._zoom = Math.max(0.1, Math.min(10, z));
  }
  zoomIn(): void { this.setZoom(this._zoom * 1.2); }
  zoomOut(): void { this.setZoom(this._zoom / 1.2); }
  resetView(): void { this._zoom = 1; this._panX = 0; this._panY = 0; }

  /** Pan controls */
  get panX(): number { return this._panX; }
  get panY(): number { return this._panY; }
  pan(dx: number, dy: number): void {
    this._panX += dx;
    this._panY += dy;
  }

  /** Resize canvas */
  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this._quadTree = new QuadTree({ x: 0, y: 0, width, height });
    for (const [id, pos] of this._positions) {
      this._quadTree.insert(id, pos.x, pos.y);
    }
  }

  get width(): number { return this._width; }
  get height(): number { return this._height; }

  private _viewportRect(): Rect {
    const invZoom = 1 / this._zoom;
    return {
      x: -this._panX * invZoom,
      y: -this._panY * invZoom,
      width: this._width * invZoom,
      height: this._height * invZoom,
    };
  }

  private _screenX(worldX: number): number {
    return (worldX + this._panX) * this._zoom;
  }

  private _screenY(worldY: number): number {
    return (worldY + this._panY) * this._zoom;
  }
}