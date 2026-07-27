// ================================================================
// COS Graph Visualizer — Web-based interactive graph visualizer
// Zero external dependencies. Generates a self-contained HTML page.
// ================================================================

import * as fs from 'fs';
import * as path from 'path';
import { VisualGraphEngine, MermaidRenderer } from './level0-visual';
import { ExecutionGraphEngine } from './level1-execution';
import { StateMachine, StateMachineJSON } from './level2-state';
import { DependencyResolver } from './level3-dependency';
import { CallGraphBuilder } from './level4-call';
import { CFGBuilder } from './level5-cfg';
import { DataFlowGraph } from './level6-dataflow';
import { ComputationalGraph } from './level7-compute';
import { KnowledgeGraphEngine } from './level8-knowledge';
import { SemanticGraph } from './level9-semantic';
import { EmbeddingGraph } from './level10-embedding';
import { GraphRAGEngine } from './level11-graphrag';
import { MemoryGraphEngine } from './level12-memory';
import { AgentGraphEngine } from './level13-agent';
import { ToolGraphEngine } from './level14-tool';
import { WorkflowGraphEngine } from './level15-workflow';
import { NetworkGraphEngine } from './level16-network';
import { SocialGraphEngine } from './level17-social';
import { BiologicalGraphEngine } from './level18-biological';
import { MolecularGraphEngine } from './level19-molecular';

export interface VisualizerConfig {
  title?: string;
  width?: number;
  height?: number;
  outputFile?: string;
}

const LEVEL_ENGINES: Record<string, { name: string; color: string; buildDemo: (engine: any) => void }> = {
  L0: { name: 'Visual Graph', color: '#4A90D9', buildDemo: (e: VisualGraphEngine) => e.buildDemo() },
  L1: { name: 'Execution Graph', color: '#7B68EE', buildDemo: (e: ExecutionGraphEngine) => e.buildDemo() },
  L2: { name: 'State Machine', color: '#2ECC71', buildDemo: (e: StateMachine) => e.buildDemo() },
  L3: { name: 'Dependency Graph', color: '#E74C3C', buildDemo: (e: DependencyResolver) => e.buildDiamond() },
  L4: { name: 'Call Graph', color: '#F39C12', buildDemo: (e: CallGraphBuilder) => e.buildDemo() },
  L5: { name: 'CFG', color: '#1ABC9C', buildDemo: (e: CFGBuilder) => e.buildIfElse() },
  L6: { name: 'DataFlow', color: '#3498DB', buildDemo: (e: DataFlowGraph) => e.buildETLPipeline() },
  L7: { name: 'Compute Graph', color: '#9B59B6', buildDemo: (e: ComputationalGraph) => e.buildMLP() },
  L8: { name: 'Knowledge Graph', color: '#E67E22', buildDemo: (e: KnowledgeGraphEngine) => e.buildKnowledgeGraph() },
  L9: { name: 'Semantic Graph', color: '#1ABC9C', buildDemo: (e: SemanticGraph) => e.buildDemo() },
  L10: { name: 'Embedding Graph', color: '#2980B9', buildDemo: (e: EmbeddingGraph) => e.buildDemo() },
  L11: { name: 'GraphRAG', color: '#8E44AD', buildDemo: (e: GraphRAGEngine) => e.buildDemo() },
  L12: { name: 'Memory Graph', color: '#16A085', buildDemo: (e: MemoryGraphEngine) => e.buildMemoryGraph() },
  L13: { name: 'Agent Graph', color: '#27AE60', buildDemo: (e: AgentGraphEngine) => e.buildDevTeam() },
  L14: { name: 'Tool Graph', color: '#2C3E50', buildDemo: (e: ToolGraphEngine) => e.buildToolEcosystem() },
  L15: { name: 'Workflow Graph', color: '#D35400', buildDemo: (e: WorkflowGraphEngine) => e.buildWorkflow() },
  L16: { name: 'Network Graph', color: '#C0392B', buildDemo: (e: NetworkGraphEngine) => e.buildInfrastructure() },
  L17: { name: 'Social Graph', color: '#E91E63', buildDemo: (e: SocialGraphEngine) => e.buildTechNetwork() },
  L18: { name: 'Biological Graph', color: '#00BCD4', buildDemo: (e: BiologicalGraphEngine) => e.buildNeuralCircuit() },
  L19: { name: 'Molecular Graph', color: '#FF5722', buildDemo: (e: MolecularGraphEngine) => e.buildWater() },
};

function generateHTML(levels: Array<{ id: string; name: string; color: string; nodes: any[]; edges: any[]; metrics: any }>): string {
  const levelsJson = JSON.stringify(levels);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>COS Graph Engine — Visualizer</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f0f1a; color: #e0e0e0; overflow-x: hidden; }
  header { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 20px 30px; border-bottom: 1px solid #2a2a4a; }
  header h1 { font-size: 24px; font-weight: 700; background: linear-gradient(90deg, #4A90D9, #7B68EE); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  header p { color: #888; font-size: 13px; margin-top: 4px; }
  .controls { display: flex; gap: 10px; padding: 15px 30px; background: #14142a; border-bottom: 1px solid #2a2a4a; flex-wrap: wrap; align-items: center; }
  .controls select, .controls button { padding: 8px 16px; border-radius: 6px; border: 1px solid #3a3a5a; background: #1e1e3a; color: #e0e0e0; font-size: 13px; cursor: pointer; }
  .controls select:focus, .controls button:hover { border-color: #4A90D9; outline: none; }
  .controls label { color: #888; font-size: 13px; }
  .controls .stats { margin-left: auto; color: #666; font-size: 12px; }
  #canvas-container { width: 100%; height: 70vh; position: relative; overflow: hidden; background: #0a0a18; }
  #canvas-container canvas { display: block; width: 100%; height: 100%; }
  .nodes-panel { position: fixed; right: 0; top: 140px; width: 340px; height: calc(100vh - 140px); background: #14142a; border-left: 1px solid #2a2a4a; overflow-y: auto; transform: translateX(340px); transition: transform 0.3s; z-index: 10; }
  .nodes-panel.open { transform: translateX(0); }
  .nodes-panel h3 { padding: 15px; border-bottom: 1px solid #2a2a4a; font-size: 14px; color: #aaa; }
  .nodes-panel .node-item { padding: 10px 15px; border-bottom: 1px solid #1a1a2e; cursor: pointer; display: flex; align-items: center; gap: 10px; }
  .nodes-panel .node-item:hover { background: #1e1e3a; }
  .nodes-panel .node-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .nodes-panel .node-id { font-size: 11px; color: #666; }
  .nodes-panel .node-label { font-size: 13px; }
  .tooltip { position: absolute; background: #1e1e3a; border: 1px solid #3a3a5a; padding: 8px 12px; border-radius: 6px; font-size: 12px; pointer-events: none; display: none; z-index: 20; }
  #legend { display: flex; gap: 15px; padding: 10px 30px; flex-wrap: wrap; }
  #legend .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #888; }
  #legend .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
  footer { text-align: center; padding: 15px; color: #444; font-size: 11px; border-top: 1px solid #1a1a2e; }
</style>
</head>
<body>
<header>
  <h1>⚡ COS Graph Engine — Visualizer</h1>
  <p>Interactive visualization of all 20 graph levels. Drag nodes, scroll to zoom.</p>
</header>

<div class="controls">
  <label>Level:</label>
  <select id="level-select" onchange="switchLevel(this.value)"></select>
  <button onclick="toggleAutoLayout()">⟳ Toggle Auto-Layout</button>
  <button onclick="resetView()">⊞ Reset View</button>
  <button onclick="togglePanel()">☰ Nodes</button>
  <span class="stats" id="stats-bar">Nodes: 0 | Edges: 0</span>
</div>

<div id="legend"></div>

<div id="canvas-container">
  <canvas id="graph-canvas"></canvas>
  <div class="tooltip" id="tooltip"></div>
</div>

<div class="nodes-panel" id="nodes-panel">
  <h3>Nodes</h3>
  <div id="nodes-list"></div>
</div>

<footer>COS Graph Engine v2.0.0 | 20 Levels | Interactive Visualizer</footer>

<script>
const LEVELS = ${levelsJson};
let currentLevel = LEVELS[0];
let nodes = [];
let edges = [];
let autoLayout = true;
let animFrame = null;
let zoom = 1, panX = 0, panY = 0;
let dragging = false, dragNode = null, dragOffX = 0, dragOffY = 0;
let selectedNode = null;

const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');
const tooltip = document.getElementById('tooltip');
const select = document.getElementById('level-select');
const statsBar = document.getElementById('stats-bar');
const legend = document.getElementById('legend');
const nodesList = document.getElementById('nodes-list');

function resizeCanvas() {
  canvas.width = container.clientWidth * window.devicePixelRatio;
  canvas.height = container.clientHeight * window.devicePixelRatio;
  canvas.style.width = container.clientWidth + 'px';
  canvas.style.height = container.clientHeight + 'px';
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

function buildLayout(srcNodes, srcEdges) {
  const w = container.clientWidth, h = container.clientHeight;
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) * 0.35;
  const n = srcNodes.length;
  return srcNodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      ...node,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      vx: 0, vy: 0,
      r: 20,
      color: currentLevel.color || '#4A90D9',
    };
  });
}

function applyForceLayout(layout, srcEdges, steps) {
  const w = container.clientWidth, h = container.clientHeight;
  const cx = w / 2, cy = h / 2;
  for (let s = 0; s < steps; s++) {
    for (const a of layout) {
      let fx = 0, fy = 0;
      // Repulsion
      for (const b of layout) {
        if (a === b) continue;
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = 5000 / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }
      // Attraction along edges
      for (const e of srcEdges) {
        const src = layout.find(n => n.id === e.source);
        const tgt = layout.find(n => n.id === e.target);
        if (!src || !tgt) continue;
        let dx = 0, dy = 0;
        if (a === src) { dx = tgt.x - a.x; dy = tgt.y - a.y; }
        else if (a === tgt) { dx = src.x - a.x; dy = src.y - a.y; }
        else continue;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = dist / 50;
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }
      // Center gravity
      fx += (cx - a.x) / 200;
      fy += (cy - a.y) / 200;
      a.vx = (a.vx || 0) * 0.85 + fx * 0.15;
      a.vy = (a.vy || 0) * 0.85 + fy * 0.15;
      a.x += a.vx;
      a.y += a.vy;
      a.x = Math.max(30, Math.min(w - 30, a.x));
      a.y = Math.max(30, Math.min(h - 30, a.y));
    }
  }
}

function draw() {
  const w = container.clientWidth, h = container.clientHeight;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // Draw edges
  for (const e of edges) {
    const src = nodes.find(n => n.id === e.source);
    const tgt = nodes.find(n => n.id === e.target);
    if (!src || !tgt) continue;
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = e.selected ? '#4A90D9' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = e.selected ? 2.5 : 1.5;
    ctx.stroke();
    // Arrow
    const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
    const ax = tgt.x - 25 * Math.cos(angle);
    const ay = tgt.y - 25 * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(ax + 8 * Math.cos(angle - 0.4), ay + 8 * Math.sin(angle - 0.4));
    ctx.lineTo(ax + 8 * Math.cos(angle + 0.4), ay + 8 * Math.sin(angle + 0.4));
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Label
    if (e.type && e.type !== 'default') {
      const mx = (src.x + tgt.x) / 2, my = (src.y + tgt.y) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.type, mx, my - 8);
    }
  }

  // Draw nodes
  for (const n of nodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(n.x - 4, n.y - 4, 0, n.x, n.y, n.r);
    grad.addColorStop(0, n.selected ? '#7B68EE' : n.color || '#4A90D9');
    grad.addColorStop(1, n.selected ? '#4A90D9' : (n.color || '#4A90D9') + '88');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = n.selected ? '#fff' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = n.selected ? 2.5 : 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = n.label || n.id;
    if (label.length > 12) ctx.font = 'bold 9px sans-serif';
    ctx.fillText(label, n.x, n.y);

    // Sub-label
    if (n.type) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '8px sans-serif';
      ctx.fillText(n.type, n.x, n.y + n.r + 12);
    }
  }

  ctx.restore();
}

function animate() {
  if (autoLayout) {
    applyForceLayout(nodes, edges, 5);
  }
  draw();
  animFrame = requestAnimationFrame(animate);
}

function switchLevel(levelId) {
  const l = LEVELS.find(l => l.id === levelId);
  if (!l) return;
  currentLevel = l;
  nodes = buildLayout(l.nodes, l.edges);
  edges = l.edges;
  selectedNode = null;
  updateUI();
  buildLegend();
  buildNodesPanel();
}

function updateUI() {
  statsBar.textContent = \`Nodes: \${nodes.length} | Edges: \${edges.length} | \${currentLevel.name}\`;
}

function buildLegend() {
  legend.innerHTML = '';
  for (const l of LEVELS) {
    const div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = '<span class="legend-dot" style="background:' + l.color + '"></span>' + l.id;
    legend.appendChild(div);
  }
}

function buildNodesPanel() {
  nodesList.innerHTML = '';
  for (const n of nodes) {
    const div = document.createElement('div');
    div.className = 'node-item';
    div.innerHTML = '<span class="node-dot" style="background:' + (n.color || currentLevel.color) + '"></span>' +
      '<span class="node-label">' + (n.label || n.id) + '</span>' +
      '<span class="node-id">' + n.id.substring(0, 8) + '</span>';
    div.onclick = () => {
      selectedNode = selectedNode === n.id ? null : n.id;
      nodes.forEach(nd => nd.selected = nd.id === selectedNode);
      edges.forEach(e => e.selected = e.source === selectedNode || e.target === selectedNode);
      draw();
    };
    nodesList.appendChild(div);
  }
}

function toggleAutoLayout() { autoLayout = !autoLayout; }
function resetView() { zoom = 1; panX = 0; panY = 0; }
function togglePanel() { document.getElementById('nodes-panel').classList.toggle('open'); }

// Mouse events
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left - panX) / zoom;
  const my = (e.clientY - rect.top - panY) / zoom;
  const hit = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < n.r + 5);
  if (hit) { dragging = true; dragNode = hit; dragOffX = mx - hit.x; dragOffY = my - hit.y; }
  else { dragging = true; dragOffX = e.clientX - panX; dragOffY = e.clientY - panY; dragNode = null; }
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left - panX) / zoom;
  const my = (e.clientY - rect.top - panY) / zoom;
  if (dragging) {
    if (dragNode) { dragNode.x = mx - dragOffX; dragNode.y = my - dragOffY; }
    else { panX = e.clientX - dragOffX; panY = e.clientY - dragOffY; }
  }
  // Tooltip
  const hit = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < n.r + 5);
  if (hit) {
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
    tooltip.style.top = (e.clientY - rect.top + 15) + 'px';
    tooltip.textContent = hit.label + ' (' + hit.id.substring(0, 12) + ')' + (hit.type ? ' — ' + hit.type : '');
  } else {
    tooltip.style.display = 'none';
  }
});

canvas.addEventListener('mouseup', () => { dragging = false; dragNode = null; });
canvas.addEventListener('mouseleave', () => { dragging = false; dragNode = null; tooltip.style.display = 'none'; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom *= e.deltaY > 0 ? 0.9 : 1.1; zoom = Math.max(0.1, Math.min(5, zoom)); });

// Init
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Populate select
for (const l of LEVELS) {
  const opt = document.createElement('option');
  opt.value = l.id;
  opt.textContent = l.id + ' — ' + l.name;
  select.appendChild(opt);
}

switchLevel(LEVELS[0].id);
animate();
</script>
</body>
</html>`;
}

export function generateVisualizer(
  levels?: string[],
  config: VisualizerConfig = {}
): string {
  const targetLevels = levels || Object.keys(LEVEL_ENGINES);
  const data: Array<{ id: string; name: string; color: string; nodes: any[]; edges: any[]; metrics: any }> = [];

  for (const levelId of targetLevels) {
    const info = LEVEL_ENGINES[levelId];
    if (!info) continue;
    try {
      const engine = new (getEngineClass(levelId))();
      info.buildDemo(engine);
      const json = engine.toJSON ? engine.toJSON() : {};
      const metrics = engine.metrics ? engine.metrics() : {};
      const nodes = json.nodes || json.blocks || json.states || json.entities || json.chunks || json.atoms || [];
      const edges = json.edges || json.transitions || json.relations || json.bonds || [];
      data.push({
        id: levelId,
        name: info.name,
        color: info.color,
        nodes: nodes.map((n: any) => ({ id: n.id, label: n.label || n.name || n.element || n.type || n.id, type: n.type || n.role || '' })),
        edges: edges.map((e: any) => ({ source: e.source || e.from, target: e.target || e.to, type: e.type || e.event || '' })),
        metrics,
      });
    } catch (err) {
      data.push({ id: levelId, name: info.name, color: info.color, nodes: [], edges: [], metrics: { error: (err as Error).message } });
    }
  }

  return generateHTML(data);
}

function getEngineClass(levelId: string): any {
  const map: Record<string, any> = {
    L0: VisualGraphEngine, L1: ExecutionGraphEngine, L2: StateMachine, L3: DependencyResolver,
    L4: CallGraphBuilder, L5: CFGBuilder, L6: DataFlowGraph, L7: ComputationalGraph,
    L8: KnowledgeGraphEngine, L9: SemanticGraph, L10: EmbeddingGraph, L11: GraphRAGEngine,
    L12: MemoryGraphEngine, L13: AgentGraphEngine, L14: ToolGraphEngine, L15: WorkflowGraphEngine,
    L16: NetworkGraphEngine, L17: SocialGraphEngine, L18: BiologicalGraphEngine, L19: MolecularGraphEngine,
  };
  return map[levelId];
}

export function generateVisualizerFile(
  outputFile: string,
  levels?: string[],
  config: VisualizerConfig = {}
): string {
  const html = generateVisualizer(levels, config);
  fs.writeFileSync(path.resolve(outputFile), html, 'utf-8');
  return outputFile;
}

// Standalone entry
if (require.main === module) {
  const output = process.argv[2] || 'docs/visualizer.html';
  const levels = process.argv[3] ? process.argv[3].split(',') : undefined;
  const result = generateVisualizerFile(output, levels);
  console.log(`Visualizer generated: ${result}`);
}