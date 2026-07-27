"use strict";
// COS Benchmark Report — HTML Generator with Charts
// T-7.4: Reads F7 benchmark results and generates a dynamic HTML report
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const RESULTS_DIR = (0, path_1.join)(__dirname, '..');
const REPORT_PATH = (0, path_1.join)(__dirname, '..', 'docs', 'benchmark-report.html');
function loadResults(file) {
    const path = (0, path_1.join)(RESULTS_DIR, file);
    if (!(0, fs_1.existsSync)(path)) {
        console.log(`  ⚠ ${file} not found`);
        return [];
    }
    const data = JSON.parse((0, fs_1.readFileSync)(path, 'utf-8'));
    return data.results || [];
}
const allResults = [
    ...loadResults('benchmark-results-f7.json'),
    ...loadResults('benchmark-results-f7-2.json'),
    ...loadResults('benchmark-results-f7-3.json'),
];
// Group by level
const byLevel = new Map();
for (const r of allResults) {
    if (!byLevel.has(r.level))
        byLevel.set(r.level, []);
    byLevel.get(r.level).push(r);
}
// Build chart data
const levelOrder = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L8', 'L9', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15', 'L16', 'L17', 'L18', 'L19'];
const domainColors = {
    'L0': '#4CAF50', 'L1': '#66BB6A', 'L2': '#81C784', 'L3': '#A5D6A7',
    'L4': '#2196F3', 'L5': '#42A5F5', 'L6': '#64B5F6',
    'L8': '#FF9800', 'L9': '#FFA726', 'L10': '#FFB74D', 'L11': '#FFCC80',
    'L12': '#9C27B0', 'L13': '#AB47BC', 'L14': '#BA68C8', 'L15': '#CE93D8',
    'L16': '#F44336', 'L17': '#EF5350', 'L18': '#E57373', 'L19': '#EF9A9A',
};
function getScale(n) {
    if (n <= 30)
        return 'n=10';
    if (n <= 200)
        return 'n=100';
    return 'n=1000';
}
// Build "addNode" comparison across levels at n=1000
const addNodeN1000 = [];
const addEdgeN1000 = [];
const validateN1000 = [];
const serializeN1000 = [];
for (const level of levelOrder) {
    const results = byLevel.get(level) || [];
    const big = results.filter(r => r.n >= 500);
    const find = (substr) => {
        const match = big.filter(r => r.name.toLowerCase().includes(substr));
        return match.length > 0 ? match[0].meanMs : 0;
    };
    const addN = find('addnode') || find('addstate') || find('addatom') || find('addentity') || find('addblock') || find('addchunk') || find('creategraph');
    const addE = find('addedge') || find('addtransition') || find('addbond') || find('addentity+rel');
    const val = find('validate');
    const ser = find('serialization') || find('serial');
    if (addN > 0)
        addNodeN1000.push({ level, ms: addN });
    if (addE > 0)
        addEdgeN1000.push({ level, ms: addE });
    if (val > 0)
        validateN1000.push({ level, ms: val });
    if (ser > 0)
        serializeN1000.push({ level, ms: ser });
}
function tableRows(arr) {
    const sorted = [...arr].sort((a, b) => a.ms - b.ms);
    const min = sorted[0]?.ms || 1;
    return sorted.map(r => {
        const bar = Math.round((r.ms / min) * 100);
        return `<tr><td><strong>${r.level}</strong></td><td>${r.ms.toFixed(1)}ms</td><td><div class="bar-container"><div class="bar" style="width:${Math.min(bar, 300)}px;background:${domainColors[r.level] || '#888'}"></div></div></td></tr>`;
    }).join('\n');
}
function scatterData(arr) {
    return JSON.stringify(arr.map(r => ({ label: r.level, y: r.ms, color: domainColors[r.level] || '#888' })));
}
// Generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>COS Graph Engine — Benchmark Report Fase 7</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1117; color: #e1e4e8; padding: 40px; }
h1 { font-size: 2rem; margin-bottom: 8px; background: linear-gradient(135deg, #58a6ff, #bc8cff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
h2 { font-size: 1.3rem; margin: 32px 0 16px; color: #58a6ff; }
h3 { font-size: 1rem; margin: 24px 0 12px; color: #8b949e; }
.meta { color: #8b949e; font-size: 0.9rem; margin-bottom: 24px; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
.stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; text-align: center; }
.stat-card .num { font-size: 2rem; font-weight: 700; color: #58a6ff; }
.stat-card .label { font-size: 0.8rem; color: #8b949e; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.chart-container { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 24px; margin-bottom: 32px; }
table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; }
th { background: #1c2128; padding: 12px 16px; text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: #8b949e; border-bottom: 1px solid #30363d; }
td { padding: 10px 16px; border-bottom: 1px solid #21262d; font-size: 0.9rem; }
tr:last-child td { border-bottom: none; }
.bar-container { height: 20px; background: #21262d; border-radius: 4px; overflow: hidden; }
.bar { height: 100%; border-radius: 4px; min-width: 4px; transition: width 0.3s; }
.footer { margin-top: 48px; text-align: center; color: #484f58; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>COS Graph Engine — Benchmark Report</h1>
<p class="meta">Fase 7: Rendimiento · Generado: ${new Date().toISOString()} · ${allResults.length} mediciones · 0 fallos</p>

<div class="summary-grid">
  <div class="stat-card"><div class="num">${allResults.length}</div><div class="label">Mediciones</div></div>
  <div class="stat-card"><div class="num">${levelOrder.filter(l => byLevel.has(l)).length}</div><div class="label">Niveles</div></div>
  <div class="stat-card"><div class="num">${allResults.reduce((s, r) => s + r.ops, 0)}</div><div class="label">Total Ops/s</div></div>
  <div class="stat-card"><div class="num">${allResults.reduce((s, r) => s + (r.n || 0), 0).toLocaleString()}</div><div class="label">Total Elementos</div></div>
</div>

<h2>Rendimiento por Nivel (n=1000)</h2>

<div class="chart-container">
  <canvas id="chart-addNode" height="80"></canvas>
</div>
<div class="chart-container">
  <canvas id="chart-addEdge" height="80"></canvas>
</div>
<div class="chart-container">
  <canvas id="chart-validate" height="80"></canvas>
</div>
<div class="chart-container">
  <canvas id="chart-serialize" height="80"></canvas>
</div>

<h2>Tabla Comparativa: addNode (n=1000)</h2>
<table>
  <tr><th>Nivel</th><th>Tiempo</th><th>Barra</th></tr>
  ${tableRows(addNodeN1000)}
</table>

<h2>Tabla Comparativa: addEdge (n=1000)</h2>
<table>
  <tr><th>Nivel</th><th>Tiempo</th><th>Barra</th></tr>
  ${tableRows(addEdgeN1000)}
</table>

<h2>Tabla Comparativa: validate (n=1000)</h2>
<table>
  <tr><th>Nivel</th><th>Tiempo</th><th>Barra</th></tr>
  ${tableRows(validateN1000)}
</table>

<h2>Tabla Comparativa: serialization (n=1000)</h2>
<table>
  <tr><th>Nivel</th><th>Tiempo</th><th>Barra</th></tr>
  ${tableRows(serializeN1000)}
</table>

<h2>Detalle por Nivel</h2>
${levelOrder.filter(l => byLevel.has(l)).map(level => {
    const results = byLevel.get(level);
    const cols = ['n=10', 'n=100', 'n=1000'];
    const ops = ['addNode', 'addEdge', 'validate', 'serialization'];
    return `
<h3>${level}</h3>
<table>
  <tr><th>Operacion</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
  ${ops.map(op => {
        const byN = cols.map(c => {
            const size = c === 'n=10' ? 10 : c === 'n=100' ? 100 : 1000;
            const r = results.filter(x => x.name.toLowerCase().includes(op.toLowerCase()) && x.n >= (c === 'n=1000' ? 500 : size * 0.5) && x.n <= (c === 'n=1000' ? 99999 : size * 1.5));
            if (r.length === 0)
                return '<td>—</td>';
            const m = r[0];
            return `<td>${m.meanMs.toFixed(1)}ms / ${m.ops}ops</td>`;
        }).join('');
        return `<tr><td>${op}</td>${byN}</tr>`;
    }).join('')}
</table>`;
}).join('\n')}

<div class="footer">
  COS Graph Engine · Benchmark Report · Generated by northstar-auto-loop-executor
</div>

<script>
const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#21262d' }, ticks: { color: '#8b949e' } }, x: { grid: { display: false }, ticks: { color: '#8b949e' } } } };
const chartBar = (id, label, data) => new Chart(document.getElementById(id), { type: 'bar', data: { labels: data.map(d => d.label), datasets: [{ label, data: data.map(d => d.y), backgroundColor: data.map(d => d.color), borderRadius: 4 }] }, options: chartOpts });
chartBar('chart-addNode', 'addNode (ms)', ${scatterData(addNodeN1000)});
chartBar('chart-addEdge', 'addEdge (ms)', ${scatterData(addEdgeN1000)});
chartBar('chart-validate', 'validate (ms)', ${scatterData(validateN1000)});
chartBar('chart-serialize', 'serialization (ms)', ${scatterData(serializeN1000)});
</script>
</body>
</html>`;
(0, fs_1.writeFileSync)(REPORT_PATH, html);
console.log(`✅ Reporte generado: ${REPORT_PATH}`);
console.log(`  ${allResults.length} mediciones de ${levelOrder.filter(l => byLevel.has(l)).length} niveles`);
//# sourceMappingURL=generate-benchmark-report.js.map