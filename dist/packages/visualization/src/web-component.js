"use strict";
/**
 * Web Component <cos-graph> — COS Graph Engine v2.1 Fase 4 T-4.3
 *
 * Web Component drop-in para cualquier pagina HTML.
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CosGraphElement = void 0;
exports.registerCosGraph = registerCosGraph;
const csr_1 = require("../../graph/src/csr");
const svg_renderer_1 = require("./svg-renderer");
const canvas_renderer_1 = require("./canvas-renderer");
// ============================================================
// CosGraphElement — Custom Element
// ============================================================
class CosGraphElement extends HTMLElement {
    _shadow;
    _graph = null;
    _canvasRenderer;
    _svgRenderer;
    _layout = 'force';
    _theme = 'dark';
    _interactive = true;
    _positions = new Map();
    _canvas = null;
    _animationId = null;
    _isDragging = false;
    _dragStartX = 0;
    _dragStartY = 0;
    _selectedNode = null;
    constructor() {
        super();
        this._shadow = this.attachShadow({ mode: 'open' });
        this._canvasRenderer = new canvas_renderer_1.CanvasGraphRenderer();
        this._svgRenderer = new svg_renderer_1.SVGGraphRenderer();
        // Observed attributes
        this._layout = this.getAttribute('layout') || 'force';
        this._theme = this.getAttribute('theme') || 'dark';
        this._interactive = this.getAttribute('interactive') !== 'false';
        this._render();
    }
    // ============================================================
    // Observed attributes
    // ============================================================
    static get observedAttributes() {
        return ['layout', 'theme', 'interactive', 'width', 'height'];
    }
    attributeChangedCallback(name, _oldValue, newValue) {
        switch (name) {
            case 'layout':
                this._layout = newValue;
                break;
            case 'theme':
                this._theme = newValue;
                break;
            case 'interactive':
                this._interactive = newValue !== 'false';
                break;
        }
        this._render();
    }
    // ============================================================
    // Public API
    // ============================================================
    /** Set graph data */
    set graphData(data) {
        const g = new csr_1.CSRGraph();
        for (const n of data.nodes) {
            g.addNode({ id: n.id, label: n.label || n.id });
        }
        for (const e of data.edges) {
            g.addEdge(e.source, e.target, { weight: e.weight ?? 1 });
        }
        this._graph = g;
        this._computeLayout();
        this._render();
    }
    /** Set layout type */
    set layout(type) {
        this._layout = type;
        this.setAttribute('layout', type);
        if (this._graph) {
            this._computeLayout();
            this._render();
        }
    }
    /** Set theme */
    set theme(t) {
        this._theme = t;
        this.setAttribute('theme', t);
        this._render();
    }
    /** Focus on a specific node */
    focusNode(id) {
        const pos = this._positions.get(id);
        if (!pos || !this._canvas)
            return;
        const width = this._canvas.width;
        const height = this._canvas.height;
        this._canvasRenderer.pan(width / 2 / this._canvasRenderer.zoom - pos.x, height / 2 / this._canvasRenderer.zoom - pos.y);
        this._selectedNode = id;
        this._drawCanvas();
    }
    /** Highlight a path between two nodes */
    highlightPath(source, target) {
        if (!this._graph)
            return null;
        const path = this._graph.bidirectionalBFS(source, target, 20);
        if (!path)
            return null;
        this._selectedNode = source;
        this._drawCanvas();
        return path.map(p => p.id).join(' → ');
    }
    /** Export graph as SVG string */
    exportSVG() {
        if (!this._graph)
            return '';
        const opts = {
            layout: this._layout,
            showLabels: true,
            arrowheads: true,
            backgroundColor: this._theme === 'dark' ? '#0d1117' : '#ffffff',
            nodeColor: this._theme === 'dark' ? '#1f6feb' : '#0366d6',
            edgeColor: this._theme === 'dark' ? '#58a6ff' : '#1f6feb',
            labelColor: this._theme === 'dark' ? '#c9d1d9' : '#24292e',
        };
        return this._svgRenderer.render(this._graph, opts);
    }
    /** Export graph as PNG data URL (via Canvas) */
    exportPNG() {
        if (!this._canvas)
            return null;
        return this._canvas.toDataURL('image/png');
    }
    // ============================================================
    // Private
    // ============================================================
    _render() {
        const width = parseInt(this.getAttribute('width') || '800', 10);
        const height = parseInt(this.getAttribute('height') || '600', 10);
        const themeStyles = this._theme === 'dark'
            ? { bg: '#0d1117', text: '#c9d1d9', border: '#30363d' }
            : { bg: '#ffffff', text: '#24292e', border: '#d0d7de' };
        this._shadow.innerHTML = `
      <style>
        :host { display: inline-block; position: relative; }
        canvas { display: block; border: 1px solid ${themeStyles.border}; border-radius: 6px; background: ${themeStyles.bg}; }
        .tooltip { position: absolute; display: none; background: ${themeStyles.bg}; color: ${themeStyles.text};
                   border: 1px solid ${themeStyles.border}; border-radius: 4px; padding: 4px 8px;
                   font-size: 12px; font-family: sans-serif; pointer-events: none; }
      </style>
      <canvas width="${width}" height="${height}"></canvas>
      <div class="tooltip" id="tooltip"></div>
    `;
        this._canvas = this._shadow.querySelector('canvas');
        this._canvasRenderer.resize(width, height);
        if (this._interactive && this._canvas) {
            this._setupInteraction();
        }
        if (this._graph && this._canvas) {
            this._canvasRenderer.setData(this._graph, this._positions);
            this._drawCanvas();
        }
    }
    _computeLayout() {
        if (!this._graph)
            return;
        const width = parseInt(this.getAttribute('width') || '800', 10);
        const height = parseInt(this.getAttribute('height') || '600', 10);
        const opts = { layout: this._layout, iterations: 50 };
        // Use SVG renderer's layout computation
        const svg = this._svgRenderer.render(this._graph, opts);
        // Extract positions from SVG renderer (internal)
        // For simplicity, force layout directly
        const { ForceLayout } = require('./svg-renderer');
        const layout = new ForceLayout(width, height);
        this._positions = layout.compute(this._graph, 50, 20);
    }
    _drawCanvas() {
        if (!this._graph || !this._canvas)
            return;
        this._canvasRenderer.setData(this._graph, this._positions);
        const commands = this._canvasRenderer.getRenderCommands(this._graph);
        const ctx = this._canvas.getContext('2d');
        if (!ctx)
            return;
        const width = this._canvas.width;
        const height = this._canvas.height;
        // Clear
        ctx.fillStyle = this._theme === 'dark' ? '#0d1117' : '#ffffff';
        ctx.fillRect(0, 0, width, height);
        // Draw edges
        for (const cmd of commands) {
            if (cmd.type !== 'edge')
                continue;
            ctx.strokeStyle = cmd.color || '#58a6ff';
            ctx.lineWidth = (cmd.weight || 1) * this._canvasRenderer.zoom;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(cmd.x, cmd.y);
            ctx.lineTo(cmd.targetX, cmd.targetY);
            ctx.stroke();
        }
        // Draw nodes
        ctx.globalAlpha = 1;
        for (const cmd of commands) {
            if (cmd.type !== 'node')
                continue;
            const isSelected = cmd.id === this._selectedNode;
            // Glow
            if (isSelected) {
                ctx.shadowColor = '#58a6ff';
                ctx.shadowBlur = 10;
            }
            ctx.fillStyle = cmd.color || '#1f6feb';
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cmd.x, cmd.y, cmd.radius || 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Label
            if (cmd.label) {
                ctx.fillStyle = this._theme === 'dark' ? '#c9d1d9' : '#24292e';
                ctx.font = `${11 * this._canvasRenderer.zoom}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(cmd.label, cmd.x, cmd.y + (cmd.radius || 20) + 12 * this._canvasRenderer.zoom);
            }
        }
    }
    _setupInteraction() {
        if (!this._canvas)
            return;
        this._canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0)
                this._canvasRenderer.zoomIn();
            else
                this._canvasRenderer.zoomOut();
            this._drawCanvas();
        });
        this._canvas.addEventListener('mousedown', (e) => {
            this._isDragging = true;
            this._dragStartX = e.clientX;
            this._dragStartY = e.clientY;
        });
        this._canvas.addEventListener('mousemove', (e) => {
            if (this._isDragging) {
                const dx = e.clientX - this._dragStartX;
                const dy = e.clientY - this._dragStartY;
                this._canvasRenderer.pan(dx / this._canvasRenderer.zoom, dy / this._canvasRenderer.zoom);
                this._dragStartX = e.clientX;
                this._dragStartY = e.clientY;
                this._drawCanvas();
            }
        });
        this._canvas.addEventListener('mouseup', () => {
            this._isDragging = false;
        });
        this._canvas.addEventListener('mouseleave', () => {
            this._isDragging = false;
        });
    }
}
exports.CosGraphElement = CosGraphElement;
// ============================================================
// Register the custom element
// ============================================================
function registerCosGraph(tagName = 'cos-graph') {
    if (!customElements.get(tagName)) {
        customElements.define(tagName, CosGraphElement);
    }
}
//# sourceMappingURL=web-component.js.map