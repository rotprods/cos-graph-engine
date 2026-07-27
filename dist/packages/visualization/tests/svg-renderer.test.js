"use strict";
/**
 * Tests for SVG Renderer — T-4.1
 *
 * 8 tests covering:
 *  - ForceLayout: compute positions
 *  - SVGGraphRenderer: render SVG, force layout, tree layout, radial layout
 *  - Edge cases: empty graph, single node
 */
Object.defineProperty(exports, "__esModule", { value: true });
const csr_1 = require("../../graph/src/csr");
const svg_renderer_1 = require("../src/svg-renderer");
// ============================================================
// Helpers
// ============================================================
let passed = 0;
let failed = 0;
let testCount = 0;
function assert(condition, msg) {
    testCount++;
    if (condition) {
        passed++;
    }
    else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}
function assertStrictEqual(a, b, msg) {
    testCount++;
    if (a === b) {
        passed++;
    }
    else {
        failed++;
        console.error(`  FAIL: ${msg}: expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`);
    }
}
function section(name) {
    console.log(`\n=== ${name} ===`);
}
function buildChain(n) {
    const g = new csr_1.CSRGraph();
    for (let i = 0; i < n; i++)
        g.addNode({ id: `n${i}` });
    for (let i = 0; i < n - 1; i++)
        g.addEdge(`n${i}`, `n${i + 1}`);
    return g;
}
// ============================================================
// 1. ForceLayout — compute positions
// ============================================================
section('ForceLayout — compute positions');
{
    const graph = buildChain(5);
    const layout = new svg_renderer_1.ForceLayout(800, 600);
    const positions = layout.compute(graph, 10, 20);
    assert(positions.size === 5, '5 positions for 5 nodes');
    for (const [id, pos] of positions) {
        assert(pos.x >= 0, `node ${id} x >= 0`);
        assert(pos.x <= 800, `node ${id} x <= 800`);
        assert(pos.y >= 0, `node ${id} y >= 0`);
        assert(pos.y <= 600, `node ${id} y <= 600`);
    }
}
// ============================================================
// 2. SVGGraphRenderer — render basic SVG
// ============================================================
section('SVGGraphRenderer — render basic SVG');
{
    const graph = buildChain(3);
    const renderer = new svg_renderer_1.SVGGraphRenderer();
    const svg = renderer.render(graph, { iterations: 10, showLabels: false, arrowheads: false });
    assert(svg.startsWith('<svg'), 'SVG starts with svg tag');
    assert(svg.endsWith('</svg>'), 'SVG ends with svg tag');
    assert(svg.includes('<rect'), 'has background rect');
    assert(svg.includes('<circle'), 'has circles');
    assert(svg.includes('<line'), 'has lines');
    assert(svg.includes('</svg>'), 'properly closed');
}
// ============================================================
// 3. SVGGraphRenderer — force layout
// ============================================================
section('SVGGraphRenderer — force layout');
{
    const graph = buildChain(5);
    const renderer = new svg_renderer_1.SVGGraphRenderer();
    const svg = renderer.render(graph, { layout: 'force', iterations: 20, showLabels: true });
    assert(svg.includes('<svg'), 'force layout SVG');
    assert(svg.includes('<text'), 'has labels');
    assert(svg.includes('n0'), 'has node n0 label');
    assert(svg.includes('n4'), 'has node n4 label');
}
// ============================================================
// 4. SVGGraphRenderer — tree layout
// ============================================================
section('SVGGraphRenderer — tree layout');
{
    const graph = buildChain(5);
    const renderer = new svg_renderer_1.SVGGraphRenderer();
    const svg = renderer.render(graph, { layout: 'tree', iterations: 10 });
    assert(svg.includes('<svg'), 'tree layout SVG');
    assert(svg.includes('<circle'), 'has circles');
    assert(svg.includes('<line'), 'has lines');
}
// ============================================================
// 5. SVGGraphRenderer — radial layout
// ============================================================
section('SVGGraphRenderer — radial layout');
{
    const graph = buildChain(5);
    const renderer = new svg_renderer_1.SVGGraphRenderer();
    const svg = renderer.render(graph, { layout: 'radial', iterations: 10 });
    assert(svg.includes('<svg'), 'radial layout SVG');
    assert(svg.includes('<circle'), 'has circles');
    assert(svg.includes('<line'), 'has lines');
}
// ============================================================
// 6. SVGGraphRenderer — empty graph
// ============================================================
section('SVGGraphRenderer — empty graph');
{
    const graph = new csr_1.CSRGraph();
    const renderer = new svg_renderer_1.SVGGraphRenderer();
    const svg = renderer.render(graph);
    assert(svg.includes('<svg'), 'empty graph SVG');
    assert(!svg.includes('<circle'), 'no circles in empty graph');
    assert(!svg.includes('<line'), 'no lines in empty graph');
}
// ============================================================
// 7. SVGGraphRenderer — single node
// ============================================================
section('SVGGraphRenderer — single node');
{
    const graph = new csr_1.CSRGraph();
    graph.addNode({ id: 'root', label: 'Root' });
    const renderer = new svg_renderer_1.SVGGraphRenderer();
    const svg = renderer.render(graph, { showLabels: true });
    assert(svg.includes('<svg'), 'single node SVG');
    assert(svg.includes('<circle'), 'has circle');
    assert(svg.includes('Root'), 'has label');
}
// ============================================================
// 8. SVGGraphRenderer — custom options
// ============================================================
section('SVGGraphRenderer — custom options');
{
    const graph = buildChain(3);
    const renderer = new svg_renderer_1.SVGGraphRenderer();
    const svg = renderer.render(graph, {
        width: 400,
        height: 300,
        nodeRadius: 10,
        edgeColor: '#ff0000',
        nodeColor: '#00ff00',
        backgroundColor: '#ffffff',
        showLabels: false,
        arrowheads: true,
    });
    assert(svg.includes('width="400"'), 'custom width');
    assert(svg.includes('height="300"'), 'custom height');
    assert(svg.includes('#ff0000'), 'custom edge color');
    assert(svg.includes('#00ff00'), 'custom node color');
    assert(svg.includes('#ffffff'), 'custom background');
    assert(svg.includes('arrowhead'), 'has arrowhead marker');
}
// ============================================================
// Summary
// ============================================================
console.log(`\n=== Summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=svg-renderer.test.js.map