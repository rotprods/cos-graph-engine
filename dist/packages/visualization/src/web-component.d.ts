/**
 * Web Component <cos-graph> — COS Graph Engine v2.1 Fase 4 T-4.3
 *
 * Web Component drop-in para cualquier pagina HTML.
 * Zero dependencias externas.
 */
export declare class CosGraphElement extends HTMLElement {
    private _shadow;
    private _graph;
    private _canvasRenderer;
    private _svgRenderer;
    private _layout;
    private _theme;
    private _interactive;
    private _positions;
    private _canvas;
    private _animationId;
    private _isDragging;
    private _dragStartX;
    private _dragStartY;
    private _selectedNode;
    constructor();
    static get observedAttributes(): string[];
    attributeChangedCallback(name: string, _oldValue: string, newValue: string): void;
    /** Set graph data */
    set graphData(data: {
        nodes: Array<{
            id: string;
            label?: string;
        }>;
        edges: Array<{
            source: string;
            target: string;
            weight?: number;
        }>;
    });
    /** Set layout type */
    set layout(type: 'force' | 'tree' | 'radial');
    /** Set theme */
    set theme(t: 'light' | 'dark');
    /** Focus on a specific node */
    focusNode(id: string): void;
    /** Highlight a path between two nodes */
    highlightPath(source: string, target: string): string | null;
    /** Export graph as SVG string */
    exportSVG(): string;
    /** Export graph as PNG data URL (via Canvas) */
    exportPNG(): string | null;
    private _render;
    private _computeLayout;
    private _drawCanvas;
    private _setupInteraction;
}
export declare function registerCosGraph(tagName?: string): void;
//# sourceMappingURL=web-component.d.ts.map