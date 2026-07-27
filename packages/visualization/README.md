# @cos/visualization — COS Graph Visualization

SVG renderer, Canvas renderer with quadtree culling, and `<cos-graph>` Web Component.

## Features

- **SVG Renderer** — Force-directed, tree, and radial layouts. Custom colors, arrowheads, glow.
- **Canvas Renderer** — QuadTree spatial index for culling, zoom (0.1x-10x), pan, 30fps on 10K+ nodes.
- **Web Component** — `<cos-graph>` custom element. Attributes: layout, theme, interactive. Methods: exportSVG, exportPNG, highlightPath, focusNode.
- **Zero Dependencies** — No framework, no canvas library.

## Install

```bash
npm install @cos/visualization
```

## Quick Start

### SVG

```typescript
import { SVGGraphRenderer, CSRGraph } from '@cos/visualization';

const graph = new CSRGraph();
// ... populate graph
const renderer = new SVGGraphRenderer();
const svg = renderer.render(graph, { layout: 'force' });
```

### Web Component

```html
<cos-graph layout="force" theme="dark" width="800" height="600"></cos-graph>
<script>
  const el = document.querySelector('cos-graph');
  el.graphData = {
    nodes: [{id:'a', label:'A'}, {id:'b', label:'B'}],
    edges: [{source:'a', target:'b'}]
  };
</script>
```

## License

MIT