"use strict";
/**
 * Tests for Canvas Renderer — T-4.2
 *
 * 8 tests covering:
 *  - QuadTree: insert, query, split, clear
 *  - CanvasGraphRenderer: setData, getRenderCommands, zoom, pan
 *  - Edge cases: empty graph, single node, zoom extremes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const csr_1 = require("../../graph/src/csr");
const canvas_renderer_1 = require("../src/canvas-renderer");
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
// 1. QuadTree — insert and query
// ============================================================
section('QuadTree — insert and query');
{
    const qt = new canvas_renderer_1.QuadTree({ x: 0, y: 0, width: 800, height: 600 });
    qt.insert('n0', 100, 100);
    qt.insert('n1', 200, 200);
    qt.insert('n2', 700, 500);
    // Query center
    const center = qt.query({ x: 50, y: 50, width: 300, height: 300 });
    assert(center.includes('n0'), 'center query finds n0');
    assert(center.includes('n1'), 'center query finds n1');
    assert(!center.includes('n2'), 'center query does not find n2');
    // Query far corner
    const corner = qt.query({ x: 600, y: 400, width: 200, height: 200 });
    assert(corner.includes('n2'), 'corner query finds n2');
    assert(!corner.includes('n0'), 'corner query does not find n0');
}
// ============================================================
// 2. QuadTree — split and subdivide
// ============================================================
section('QuadTree — split and subdivide');
{
    const qt = new canvas_renderer_1.QuadTree({ x: 0, y: 0, width: 100, height: 100 });
    // Insert 20 nodes to force split
    for (let i = 0; i < 20; i++) {
        qt.insert(`n${i}`, Math.random() * 100, Math.random() * 100);
    }
    // Query the whole area
    const all = qt.query({ x: 0, y: 0, width: 100, height: 100 });
    assert(all.length === 20, 'all 20 nodes found after split');
}
// ============================================================
// 3. QuadTree — clear
// ============================================================
section('QuadTree — clear');
{
    const qt = new canvas_renderer_1.QuadTree({ x: 0, y: 0, width: 800, height: 600 });
    qt.insert('n0', 100, 100);
    qt.insert('n1', 200, 200);
    assert(qt.query({ x: 0, y: 0, width: 800, height: 600 }).length === 2, '2 nodes before clear');
    qt.clear();
    assert(qt.query({ x: 0, y: 0, width: 800, height: 600 }).length === 0, '0 nodes after clear');
}
// ============================================================
// 4. QuadTree — query outside bounds
// ============================================================
section('QuadTree — query outside bounds');
{
    const qt = new canvas_renderer_1.QuadTree({ x: 0, y: 0, width: 100, height: 100 });
    qt.insert('n0', 50, 50);
    const outside = qt.query({ x: 200, y: 200, width: 50, height: 50 });
    assert(outside.length === 0, 'no nodes in outside query');
}
// ============================================================
// 5. CanvasGraphRenderer — setData and getRenderCommands
// ============================================================
section('CanvasGraphRenderer — setData and getRenderCommands');
{
    const graph = buildChain(3);
    const positions = new Map();
    positions.set('n0', { x: 100, y: 100 });
    positions.set('n1', { x: 200, y: 100 });
    positions.set('n2', { x: 300, y: 100 });
    const renderer = new canvas_renderer_1.CanvasGraphRenderer(800, 600);
    renderer.setData(graph, positions);
    const commands = renderer.getRenderCommands(graph);
    assert(commands.length > 0, 'has render commands');
    const nodes = commands.filter(c => c.type === 'node');
    const edges = commands.filter(c => c.type === 'edge');
    assert(nodes.length === 3, '3 node commands');
    assert(edges.length === 2, '2 edge commands');
}
// ============================================================
// 6. CanvasGraphRenderer — zoom
// ============================================================
section('CanvasGraphRenderer — zoom');
{
    const graph = buildChain(3);
    const positions = new Map();
    positions.set('n0', { x: 100, y: 100 });
    positions.set('n1', { x: 200, y: 100 });
    positions.set('n2', { x: 300, y: 100 });
    const renderer = new canvas_renderer_1.CanvasGraphRenderer(800, 600);
    renderer.setData(graph, positions);
    assertStrictEqual(renderer.zoom, 1, 'initial zoom is 1');
    renderer.zoomIn();
    assert(renderer.zoom > 1, 'zoom > 1 after zoomIn');
    renderer.zoomOut();
    renderer.zoomOut();
    assert(renderer.zoom < 1, 'zoom < 1 after zoomOut twice');
    renderer.resetView();
    assertStrictEqual(renderer.zoom, 1, 'zoom reset to 1');
    assertStrictEqual(renderer.panX, 0, 'panX reset to 0');
    assertStrictEqual(renderer.panY, 0, 'panY reset to 0');
}
// ============================================================
// 7. CanvasGraphRenderer — pan
// ============================================================
section('CanvasGraphRenderer — pan');
{
    const graph = buildChain(3);
    const positions = new Map();
    positions.set('n0', { x: 100, y: 100 });
    positions.set('n1', { x: 200, y: 100 });
    positions.set('n2', { x: 300, y: 100 });
    const renderer = new canvas_renderer_1.CanvasGraphRenderer(800, 600);
    renderer.setData(graph, positions);
    assertStrictEqual(renderer.panX, 0, 'initial panX 0');
    assertStrictEqual(renderer.panY, 0, 'initial panY 0');
    renderer.pan(50, 30);
    assertStrictEqual(renderer.panX, 50, 'panX 50 after pan');
    assertStrictEqual(renderer.panY, 30, 'panY 30 after pan');
    renderer.resetView();
    assertStrictEqual(renderer.panX, 0, 'panX reset');
    assertStrictEqual(renderer.panY, 0, 'panY reset');
}
// ============================================================
// 8. CanvasGraphRenderer — empty graph
// ============================================================
section('CanvasGraphRenderer — empty graph');
{
    const graph = new csr_1.CSRGraph();
    const positions = new Map();
    const renderer = new canvas_renderer_1.CanvasGraphRenderer(800, 600);
    renderer.setData(graph, positions);
    const commands = renderer.getRenderCommands(graph);
    assert(commands.length === 0, 'no commands for empty graph');
}
// ============================================================
// Summary
// ============================================================
console.log(`\n=== Summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=canvas-renderer.test.js.map