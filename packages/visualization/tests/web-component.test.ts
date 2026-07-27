/**
 * Tests for Web Component <cos-graph> — T-4.3
 *
 * 8 tests covering:
 *  - CosGraphElement class definition
 *  - registerCosGraph function
 *  - observedAttributes
 *  - exportSVG, exportPNG
 *  - highlightPath
 *  - Edge cases: empty graph, no data
 */

// ============================================================
// Mock HTMLElement and customElements for Node.js
// Must be set BEFORE importing the web-component module
// (ES imports are hoisted, so we use require() instead)
// ============================================================
(globalThis as any).HTMLElement = class MockHTMLElement {
  private _attrs: Map<string, string> = new Map();
  private _shadowRoot: any = null;

  constructor() {
    this._attrs.set('width', '800');
    this._attrs.set('height', '600');
  }

  getAttribute(name: string): string | null {
    return this._attrs.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this._attrs.set(name, value);
  }

  attachShadow(_mode: { mode: string }): any {
    this._shadowRoot = { innerHTML: '', querySelector: () => null };
    return this._shadowRoot;
  }

  get shadowRoot(): any { return this._shadowRoot; }
};

const _registry = new Map<string, any>();
(globalThis as any).customElements = {
  get: (name: string) => _registry.get(name),
  define: (name: string, ctor: any) => { _registry.set(name, ctor); },
};

// ============================================================
// Now require the module (HTMLElement is available)
// ============================================================
const { CosGraphElement, registerCosGraph } = require('../src/web-component');

// ============================================================
// Helpers
// ============================================================

let passed = 0;
let failed = 0;
let testCount = 0;

function assert(condition: boolean, msg: string): void {
  testCount++;
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function assertStrictEqual<T>(a: T, b: T, msg: string): void {
  testCount++;
  if (a === b) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}: expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`);
  }
}

function section(name: string): void {
  console.log(`\n=== ${name} ===`);
}

// ============================================================
// 1. CosGraphElement — class exists
// ============================================================
section('CosGraphElement — class definition');

{
  const el = new CosGraphElement();
  assert(el instanceof CosGraphElement, 'CosGraphElement is constructable');
  assert(el instanceof (globalThis as any).HTMLElement, 'CosGraphElement extends HTMLElement');
}

// ============================================================
// 2. observedAttributes
// ============================================================
section('CosGraphElement — observedAttributes');

{
  const attrs = CosGraphElement.observedAttributes;
  assert(attrs.includes('layout'), 'observes layout');
  assert(attrs.includes('theme'), 'observes theme');
  assert(attrs.includes('interactive'), 'observes interactive');
  assert(attrs.includes('width'), 'observes width');
  assert(attrs.includes('height'), 'observes height');
  assert(attrs.length === 5, '5 observed attributes');
}

// ============================================================
// 3. registerCosGraph — registers custom element
// ============================================================
section('registerCosGraph — registers custom element');

{
  registerCosGraph('test-cos-graph');
  const Ctor = _registry.get('test-cos-graph');
  assert(Ctor !== undefined, 'custom element is defined');
  assert(Ctor === CosGraphElement, 'constructor matches CosGraphElement');
}

// ============================================================
// 4. registerCosGraph — idempotent
// ============================================================
section('registerCosGraph — idempotent');

{
  registerCosGraph('cos-graph');
  registerCosGraph('cos-graph');
  assert(true, 'idempotent registration does not throw');
}

// ============================================================
// 5. CosGraphElement — exportSVG returns empty without graph
// ============================================================
section('CosGraphElement — exportSVG without graph');

{
  const el = new CosGraphElement();
  const svg = el.exportSVG();
  assertStrictEqual(svg, '', 'exportSVG returns empty string without graph data');
}

// ============================================================
// 6. CosGraphElement — exportPNG returns null without canvas
// ============================================================
section('CosGraphElement — exportPNG without canvas');

{
  const el = new CosGraphElement();
  const png = el.exportPNG();
  assert(png === null, 'exportPNG returns null without canvas');
}

// ============================================================
// 7. CosGraphElement — highlightPath returns null without graph
// ============================================================
section('CosGraphElement — highlightPath without graph');

{
  const el = new CosGraphElement();
  const path = el.highlightPath('a', 'b');
  assert(path === null, 'highlightPath returns null without graph');
}

// ============================================================
// 8. CosGraphElement — graphData setter
// ============================================================
section('CosGraphElement — graphData setter');

{
  const el = new CosGraphElement();
  el.graphData = {
    nodes: [
      { id: 'a', label: 'Node A' },
      { id: 'b', label: 'Node B' },
    ],
    edges: [
      { source: 'a', target: 'b' },
    ],
  };

  const svg = el.exportSVG();
  assert(svg !== '', 'exportSVG returns SVG after setting graphData');
  assert(svg.includes('<svg'), 'SVG has svg tag');
}

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);