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
declare const _registry: Map<string, any>;
declare const CosGraphElement: any, registerCosGraph: any;
declare let passed: number;
declare let failed: number;
declare let testCount: number;
declare function assert(condition: boolean, msg: string): void;
declare function assertStrictEqual<T>(a: T, b: T, msg: string): void;
declare function section(name: string): void;
//# sourceMappingURL=web-component.test.d.ts.map