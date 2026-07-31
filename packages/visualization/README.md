# @cos/visualization

Visualization layer for COS Graph Engine: SVG, Canvas, and Web Component renderers.

## Instalacion

```bash
npm install @cos/visualization
```

## Renderers

### SVG Renderer
- Force-directed layout (Fruchterman-Reingold)
- Tree layout (Reingold-Tilford)
- Radial layout
- Export to SVG string

### Canvas Renderer
- Hardware-accelerated canvas rendering
- QuadTree culling for large graphs
- Zoom, pan, and drag interaction
- Dynamic node sizing and color coding

### Web Component
```html
<cos-graph
  data='{"nodes": [...], "edges": [...]}'
  layout="force"
  theme="dark"
></cos-graph>
```

## Uso

```typescript
import { SvgRenderer, CanvasRenderer } from "@cos/visualization";

const svg = new SvgRenderer();
const svgString = svg.renderForce(graph);

const canvas = new CanvasRenderer(document.getElementById("container"));
canvas.render(graph, { zoom: true, pan: true });
```

## Export

- SVG string export
- PNG export from canvas
- Web Component with shadow DOM