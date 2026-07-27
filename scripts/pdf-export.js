const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pdfPath = path.join(rootDir, 'docs/ROADMAP-v2.1.pdf');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 45, right: 45 },
  info: {
    Title: 'COS Graph Engine v2.1+ Roadmap',
    Author: 'COS Team',
    Subject: 'Roadmap v2.1'
  }
});

const stream = fs.createWriteStream(pdfPath);
doc.pipe(stream);

function title(text, size = 24) {
  doc.addPage();
  doc.fontSize(size).font('Helvetica-Bold').fillColor('#1a1a2e');
  doc.text(text, doc.page.margins.left, 120, { align: 'center', width: doc.page.width - 90 });
  doc.y = 150;
}

function heading1(text) {
  doc.addPage();
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a1a2e');
  doc.text(text, doc.page.margins.left, doc.y || 50, { width: doc.page.width - 90 });
  doc.moveTo(doc.page.margins.left, doc.y + 4).lineTo(doc.page.width - doc.page.margins.right, doc.y + 4).strokeColor('#e94560').stroke();
  doc.y += 16;
}

function heading2(text) {
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#16213e');
  doc.text(text, doc.page.margins.left, doc.y + 8, { width: doc.page.width - 90 });
  doc.y += 16;
}

function heading3(text) {
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f3460');
  doc.text(text, doc.page.margins.left, doc.y + 4, { width: doc.page.width - 90 });
  doc.y += 12;
}

function para(text) {
  doc.fontSize(9).font('Helvetica').fillColor('#333');
  doc.text(text, doc.page.margins.left, doc.y + 2, { width: doc.page.width - 90, lineGap: 3 });
  doc.y += 6;
}

function bullet(text) {
  doc.fontSize(9).font('Helvetica').fillColor('#333');
  doc.text('  •  ' + text, doc.page.margins.left + 8, doc.y + 1, { width: doc.page.width - 106, lineGap: 2 });
  doc.y += 4;
}

function code(text) {
  doc.fontSize(7).font('Courier').fillColor('#333');
  doc.y += 2;
  const lines = text.split('\n');
  doc.rect(doc.page.margins.left + 8, doc.y, doc.page.width - 106, lines.length * 10 + 6).fill('#f8f8f8').fillColor('#333');
  doc.y += 4;
  doc.text(text, doc.page.margins.left + 12, doc.y, { width: doc.page.width - 114, lineGap: 1 });
  doc.y += 6;
}

function table(rows) {
  if (rows.length === 0) return;
  doc.y += 4;
  const colWidth = Math.min(140, (doc.page.width - 100) / rows[0].length);
  rows.forEach((row, ri) => {
    let x = doc.page.margins.left + 4;
    row.forEach((cell, ci) => {
      doc.fontSize(7).font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor(ri === 0 ? '#1a1a2e' : '#333');
      doc.text(cell, x, doc.y, { width: colWidth, lineGap: 0 });
      x += colWidth;
    });
    doc.y += 10;
  });
  doc.y += 4;
}

function spacer(h = 6) { doc.y += h; }

// ===== TITLE PAGE =====
title('COS Graph Engine v2.1+ Roadmap');
doc.y = 220;
doc.fontSize(11).font('Helvetica').fillColor('#666');
doc.text('v2.0.0 completado: 20 fases, 68 tickets, 1145 tests, 0 failures', doc.page.margins.left, doc.y, { align: 'center', width: doc.page.width - 90 });
doc.y += 20;
doc.text('https://cos-graph-engine.higgsfield.app', doc.page.margins.left, doc.y, { align: 'center', width: doc.page.width - 90 });
doc.y += 12;
doc.text('Zero-dep rule: solo Stripe, SendGrid, LangChain, Algolia', doc.page.margins.left, doc.y, { align: 'center', width: doc.page.width - 90 });
doc.y += 40;

// ===== TABLE OF CONTENTS =====
doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a2e');
doc.text('Contents', doc.page.margins.left, doc.y, { width: doc.page.width - 90 });
doc.y += 14;

const toc = [
  '1. Resumen Ejecutivo',
  '2. Fase 1 — Performance Foundations',
  '3. Fase 2 — WASM Acceleration',
  '4. Fase 3 — Telemetry & Observability',
  '5. Fase 4 — Web Visualization',
  '6. Fase 5 — Deployment & Operations',
  '7. Fase 6 — Ecosystem & DX',
  '8. Gantt Chart',
  '9. Dependency Graph',
  '10. Milestones',
  '11. Metricas Clave',
  '12. Estado de Ejecucion'
];

toc.forEach(t => {
  doc.fontSize(9).font('Helvetica').fillColor('#333');
  doc.text(t, doc.page.margins.left + 8, doc.y, { width: doc.page.width - 100 });
  doc.y += 8;
});

// ===== RESUME =====
heading1('Resumen Ejecutivo');
para('COS Graph Engine v2.1+ transforma el motor de grafos de 20 niveles en un sistema production-grade: rendimiento 2x via CSR + WASM, observabilidad integrada, visualizacion web en tiempo real, despliegue Kubernetes-ready, y un ecosistema de paquetes publicables.');
spacer();

table([
  ['Fase', 'Nombre', 'Tickets', 'Dep', 'Esfuerzo'],
  ['1', 'Performance Foundations', '3', '—', '3-4d'],
  ['2', 'WASM Acceleration', '3', 'Fase 1', '4-5d'],
  ['3', 'Telemetry & Observability', '3', 'Fase 1', '2-3d'],
  ['4', 'Web Visualization', '3', 'Fase 1', '3-4d'],
  ['5', 'Deployment & Operations', '3', 'Fases 1-4', '4-5d'],
  ['6', 'Ecosystem & DX', '3', 'Fases 1-5', '3-4d'],
]);
para('Total: 18 tickets, ~20-25 dias');

// ===== FASE 1 =====
heading1('Fase 1 — Performance Foundations');
para('Objetivo: Reemplazar Map<string, string[]> por CSR (Compressed Sparse Row) + bidirectional pruning. 2x speedup en BFS/DFS/shortest path.');
para('Dependencias: Ninguna | Duracion: 3-4 dias');
spacer();

heading2('T-1.1 — CSR Storage (COMPLETADO)');
para('Archivos: packages/graph/src/csr.ts, scripts/test-csr.ts (77 tests, 0 failures)');
para('Clases: CSRGraph<N,E> con addNode/removeNode, addEdge/removeEdge, neighbors(), bfs(), dfs(), bidirectionalBFS(), degree(), toJSON/fromJSON, clear(). CompressedAdjacency como drop-in replacement para Map<string, string[]>.');
para('Estructura CSR: indices[] flat array de targets, indptr[] row pointers, nodeIds[] row -> node ID. Algoritmos: BFS, bidirectional BFS (meet-in-the-middle), DFS iterativo, reverse neighbors scan. Performance: rebuild O(N+E), neighbors O(degree), BFS O(N+E).');
spacer();

heading2('T-1.2 — Bidirectional Pruning');
para('Estrategias de poda configurables para BFS, DFS y shortest path. Reduccion del espacio de busqueda hasta 60%.');
spacer();
table([
  ['#', 'Strategy', 'Mecanismo', 'Reduccion'],
  ['1', 'MaxDepthPruning', 'Corta en depth >= maxDepth', '—'],
  ['2', 'VisitedPruning', 'Skip si ya visitado', '30-50%'],
  ['3', 'TargetDirectionPruning', 'Target en subarbol inverso', '20-40%'],
  ['4', 'CostBoundPruning', 'Costo > mejor conocido', '15-30%'],
  ['5', 'BeamPruning', 'Top-K candidatos por nivel', '40-60%'],
  ['6', 'LandmarkPruning', 'Distancia via landmarks', '35-50%'],
  ['7', 'EarlyExitPruning', 'Corta al encontrar target', '50-80%'],
]);
spacer();
para('Sub-tickets: 1.2a Core Pruning Engine (4-5h), 1.2b Estrategias Built-in (4-5h), 1.2c Integracion CSRGraph (2-3h), 1.2d Integracion Niveles L0-L19 (3-4h), 1.2e Tests (3-4h). Total: 68 tests.');
spacer();

heading2('T-1.3 — Benchmark Suite');
para('Benchmarks reproducibles: BFS chain (10K nodos), BFS grid (100x100), BFS social (5K, grado 20), shortest path, pruning comparison, memory profile (1K-100K). Target: 2x speedup, < 50% memoria en grafos sparse.');

// ===== FASE 2 =====
heading1('Fase 2 — WASM Acceleration');
para('Objetivo: Compilar core math a WebAssembly real. Hot paths en WASM.');
para('Dependencias: Fase 1 | Duracion: 4-5 dias');
spacer();
heading2('T-2.1 — AssemblyScript Pipeline');
para('Pipeline de compilacion AS -> WASM. Modulos: csr.wasm (BFS), pagerank.wasm (power iteration), shortest.wasm (bidirectional Dijkstra), centrality.wasm (betweenness).');
heading2('T-2.2 — WASM Loader');
para('WASMModule interface con bfs, pageRank, shortestPath. WASMLoader.load() con fallback automatico a JS puro si WebAssembly no esta soportado.');
heading2('T-2.3 — WASM Benchmarks');
para('Benchmarks: BFS 10K (2.5-3x), PageRank 5K (3-4x), Dijkstra 10K (2.5-3x), Betweenness 1K (3-4x).');

// ===== FASE 3 =====
heading1('Fase 3 — Telemetry & Observability');
para('Objetivo: Tracing por hop, profiling por operacion, exportacion OpenTelemetry.');
para('Dependencias: Fase 1 | Duracion: 2-3 dias');
spacer();
heading2('T-3.1 — Per-Hop Tracing');
para('TraceSession con hops, bidirectional flag, pruned count. NoopTraceSession para zero overhead cuando no se usa.');
heading2('T-3.2 — Profiling Hooks');
para('Profiler con start/snapshot/summary. Exportacion Prometheus: cos_graph_bfs_duration_ms, cos_graph_memory_bytes, cos_graph_operations_total.');
heading2('T-3.3 — Telemetry Plugin');
para('Plugin @cos/telemetry con onBeforeOperation/onAfterOperation/onError. Exportadores: Console, Prometheus (/metrics), OpenTelemetry (OTLP).');

// ===== FASE 4 =====
heading1('Fase 4 — Web Visualization');
para('Objetivo: SVG (documentos), Canvas (10K+ nodos/30fps), Web Component (drop-in).');
para('Dependencias: Fase 1 | Duracion: 3-4 dias');
spacer();
heading2('T-4.1 — SVG Renderer');
para('SVGGraphRenderer.render() con force-directed layout zero-dep: repulsion Coulomb, atraccion Hooke, Barnes-Hut optimizacion.');
heading2('T-4.2 — Canvas Renderer');
para('CanvasGraphRenderer con quadtree culling, zoom/pan, click/hover/drag. 10K+ nodos a 30fps.');
heading2('T-4.3 — Web Component');
para('<cos-graph> custom element con graphData, layout (force/tree/radial), theme, focusNode(), highlightPath(), exportSVG(), exportPNG().');

// ===== FASE 5 =====
heading1('Fase 5 — Deployment & Operations');
para('Objetivo: K8s operator, single-binary SEA, CI/CD automatizado.');
para('Dependencias: Fases 1-4 | Duracion: 4-5 dias');
spacer();
heading2('T-5.1 — Kubernetes Operator');
para('CRD GraphEngine con levels, size, persistence, replication, monitoring. Controller con reconciliation loop, auto-scaling, backup CronJob.');
heading2('T-5.2 — Single-Binary SEA');
para('cos-engine serve/repl/import/export/benchmark/status. Binarios: Linux (28MB), macOS (24MB), Windows (30MB).');
heading2('T-5.3 — CI/CD Pipeline');
para('Workflows: test.yml, wasm.yml, build.yml, publish.yml, deploy.yml. Quality gates: 100% tests, >85% coverage, WASM <500KB, speedup >1.5x.');

// ===== FASE 6 =====
heading1('Fase 6 — Ecosystem & DX');
para('Objetivo: Monorepo publicado como paquetes npm, documentacion interactiva, release 1-command.');
para('Dependencias: Fases 1-5 | Duracion: 3-4 dias');
spacer();
heading2('T-6.1 — Monorepo Split');
para('7 paquetes: @cos/core (0 deps), @cos/wasm, @cos/telemetry, @cos/vis, @cos/cli, @cos/api, @cos/ml.');
heading2('T-6.2 — Docs Site Interactivo');
para('VitePress con 7 secciones: Introduccion, Quickstart, CSR Guide, WASM Guide, API Reference, Visualization, Deployment. WASM Playground en navegador.');
heading2('T-6.3 — Release Automation');
para('1 comando: npm run release -- --type minor. Bump version, CHANGELOG, tag, GitHub Release, npm publish, Docker image.');

// ===== GANTT =====
heading1('Gantt Chart');
para('18 tickets en ~15-20 dias habiles. Fase 1 y 4 arrancan en paralelo (dependen solo de T-1.1). Fase 2 espera a Fase 1 completa. Fase 5 espera Fase 2 + 3 + 4. Fase 6 cierra el ciclo.');
spacer();
table([
  ['Fase', 'Ticket', 'Duracion', 'Inicio', 'Dep'],
  ['1', 'T-1.1 CSR Storage', '1d', 'Dia 1', '—'],
  ['1', 'T-1.2 Pruning', '2d', 'Dia 2', 'T-1.1'],
  ['1', 'T-1.3 Benchmarks', '1d', 'Dia 4', 'T-1.2'],
  ['2', 'T-2.1 AS Pipeline', '2d', 'Dia 5', 'Fase 1'],
  ['2', 'T-2.2 WASM Loader', '1d', 'Dia 7', 'T-2.1'],
  ['2', 'T-2.3 WASM Bench', '1d', 'Dia 8', 'T-2.2'],
  ['3', 'T-3.1 Tracing', '1d', 'Dia 3', 'T-1.2'],
  ['3', 'T-3.2 Profiling', '1d', 'Dia 4', 'T-3.1'],
  ['3', 'T-3.3 Plugin', '1d', 'Dia 5', 'T-3.2'],
  ['4', 'T-4.1 SVG', '1d', 'Dia 2', 'T-1.1'],
  ['4', 'T-4.2 Canvas', '1d', 'Dia 3', 'T-4.1'],
  ['4', 'T-4.3 Web Comp', '1d', 'Dia 4', 'T-4.2'],
  ['5', 'T-5.1 K8s', '2d', 'Dia 9', 'T-2.2+T-3.3'],
  ['5', 'T-5.2 SEA', '1d', 'Dia 9', 'T-2.2+T-4.3'],
  ['5', 'T-5.3 CI/CD', '1d', 'Dia 5', 'T-1.3'],
  ['6', 'T-6.1 Split', '1d', 'Dia 11', 'Fase 5'],
  ['6', 'T-6.2 Docs', '1d', 'Dia 12', 'T-6.1'],
  ['6', 'T-6.3 Release', '1d', 'Dia 12', 'T-6.1'],
]);

// ===== DEPENDENCY GRAPH =====
heading1('Dependency Graph');
para('Fase 1 -> Fase 2,3,4. Fase 2,3,4 -> Fase 5. Fase 5 -> Fase 6.');
para('T-1.1 -> T-1.2 -> T-1.3 -> Fase 2. T-1.2 -> Fase 3. T-1.1 -> Fase 4.');
para('T-2.2 + T-3.3 + T-4.3 -> Fase 5. T-1.3 -> T-5.3. T-2.2 + T-4.3 -> T-5.2.');
spacer();

// ===== MILESTONES =====
heading1('Milestones');
spacer();

const milestones = [
  ['M1 — Performance', 'CSR + pruning + benchmarks. 2x speedup, 137 tests nuevos.'],
  ['M2 — WASM Ready', 'Hot paths en WASM, fallback JS. 3x PageRank, 2.5x BFS.'],
  ['M3 — Observable', 'Tracing, profiling, Prometheus. <1% overhead sin tracing.'],
  ['M4 — Visual', 'SVG + Canvas 10K/30fps + Web Component.'],
  ['M5 — Deployable', 'K8s operator, SEA binary, CI/CD. Deploy en <5 min.'],
  ['M6 — Launch', '7 npm packages, docs site, release automation. 1500+ tests.'],
];

milestones.forEach(m => {
  heading2(m[0]);
  para(m[1]);
  spacer();
});

// ===== METRICAS =====
heading1('Metricas Clave');
spacer();
table([
  ['Metrica', 'v2.0', 'v2.1 Target', 'Mejora'],
  ['BFS 10K nodos', '3.5ms', '1.8ms', '2x'],
  ['Memoria 100K sparse', '42MB', '<10MB', '4x'],
  ['PageRank 5K', '45ms', '12ms', '3.75x'],
  ['Shortest path 10K', '12ms', '4ms', '3x'],
  ['Tests totales', '1068', '1500+', '+40%'],
  ['Paquetes npm', '0', '7', '—'],
  ['Deploy time', 'manual', '5 min', '—'],
  ['Visualizacion', '—', '10K/30fps', '—'],
  ['WASM support', 'simulado', 'real', '—'],
  ['K8s support', '—', 'CRD + operator', '—'],
  ['Docker image', '—', '<50MB', '—'],
]);

// ===== ESTADO =====
heading1('Estado de Ejecucion');
para('Fase 1 en progreso (28%). T-1.1 CSR Storage completado (77 tests, 0 failures). T-1.2 Pruning pendiente. T-1.3 Benchmarks pendiente. Fases 2-6 pendientes.');

doc.end();

stream.on('finish', () => {
  const size = fs.statSync(pdfPath).size;
  console.log('PDF generated:', pdfPath);
  console.log('Size:', (size / 1024).toFixed(1), 'KB');
  console.log('Pages:', doc.bufferedPageRange().count);
});

stream.on('error', (e) => { console.error(e); process.exit(1); });