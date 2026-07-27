/**
 * Canvas Renderer — COS Graph Engine v2.1 Fase 4 T-4.2
 *
 * Renderiza grafos en Canvas con quadtree culling, zoom, pan.
 * Zero dependencias externas.
 */
import { CSRGraph } from '../../graph/src/csr';
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
export declare class QuadTree {
    private _items;
    private _children;
    private _bounds;
    private _depth;
    constructor(bounds: Rect, depth?: number);
    /** Insert a node into the quadtree */
    insert(id: string, x: number, y: number): void;
    /** Query all nodes within a viewport rect */
    query(rect: Rect): string[];
    /** Clear all nodes */
    clear(): void;
    get itemCount(): number;
    get bounds(): Rect;
    private _split;
    private _insertIntoChild;
    private _pointInRect;
    private _intersects;
}
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
export declare class CanvasGraphRenderer {
    private _positions;
    private _quadTree;
    private _zoom;
    private _panX;
    private _panY;
    private _width;
    private _height;
    private _nodeRadius;
    private _nodeColor;
    private _edgeColor;
    private _labelColor;
    private _bgColor;
    constructor(width?: number, height?: number);
    /** Set graph data + positions */
    setData(graph: CSRGraph, positions: Map<string, Point>): void;
    /** Get render commands for viewport */
    getRenderCommands(graph: CSRGraph): RenderCommand[];
    /** Zoom controls */
    get zoom(): number;
    setZoom(z: number): void;
    zoomIn(): void;
    zoomOut(): void;
    resetView(): void;
    /** Pan controls */
    get panX(): number;
    get panY(): number;
    pan(dx: number, dy: number): void;
    /** Resize canvas */
    resize(width: number, height: number): void;
    get width(): number;
    get height(): number;
    private _viewportRect;
    private _screenX;
    private _screenY;
}
//# sourceMappingURL=canvas-renderer.d.ts.map