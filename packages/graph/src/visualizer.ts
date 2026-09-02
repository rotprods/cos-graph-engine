// ================================================================
// COS Graph Visualizer — Web-based interactive graph visualizer
// Zero external dependencies. Generates a self-contained HTML page.
// ================================================================

import * as fs from 'fs';
import * as path from 'path';
import { VisualGraphEngine, MermaidRenderer } from './level0-visual';
import { ExecutionGraphEngine } from './level1-execution';
import { StateMachine } from './level2-state';
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
import { generateId } from '@cos/core';

export interface VisualizerConfig {
  title?: string;
  width?: number;
  height?: number;
  outputFile?: string;
}

interface VisualizerLevelSnapshot {
  nodes: any[];
  edges: any[];
  metrics: any;
}

const LEVEL_META: Record<string, { name: string; color: string }> = {
  L0: { name: 'Visual Graph', color: '#4A90D9' },
  L1: { name: 'Execution Graph', color: '#7B68EE' },
  L2: { name: 'State Machine', color: '#2ECC71' },
  L3: { name: 'Dependency Graph', color: '#E74C3C' },
  L4: { name: 'Call Graph', color: '#F39C12' },
  L5: { name: 'CFG', color: '#1ABC9C' },
  L6: { name: 'DataFlow', color: '#3498DB' },
  L7: { name: 'Compute Graph', color: '#9B59B6' },
  L8: { name: 'Knowledge Graph', color: '#E67E22' },
  L9: { name: 'Semantic Graph', color: '#1ABC9C' },
  L10: { name: 'Embedding Graph', color: '#2980B9' },
  L11: { name: 'GraphRAG', color: '#8E44AD' },
  L12: { name: 'Memory Graph', color: '#16A085' },
  L13: { name: 'Agent Graph', color: '#27AE60' },
  L14: { name: 'Tool Graph', color: '#2C3E50' },
  L15: { name: 'Workflow Graph', color: '#D35400' },
  L16: { name: 'Network Graph', color: '#C0392B' },
  L17: { name: 'Social Graph', color: '#E91E63' },
  L18: { name: 'Biological Graph', color: '#00BCD4' },
  L19: { name: 'Molecular Graph', color: '#FF5722' },
};

function snapshotFromJSON(json: any, metrics: any = {}): VisualizerLevelSnapshot {
  if (!json || typeof json !== 'object') return { nodes: [], edges: [], metrics };
  const nodes = json.nodes || json.blocks || json.states || json.entities || json.chunks || json.atoms || [];
  const edges = json.edges || json.transitions || json.relations || json.bonds || [];
  return { nodes: Array.isArray(nodes) ? nodes : [], edges: Array.isArray(edges) ? edges : [], metrics };
}

function buildLevelSnapshot(levelId: string): VisualizerLevelSnapshot {
  switch (levelId) {
    case 'L0': {
      const engine = new VisualGraphEngine('Visualizer Demo');
      const start = engine.addNode({ label: 'Start', type: 'start' });
      const process = engine.addNode({ label: 'Process', type: 'process' });
      const decision = engine.addNode({ label: 'Decision', type: 'decision' });
      const end = engine.addNode({ label: 'End', type: 'end' });
      engine.addEdge(start, process, 'enter');
      engine.addEdge(process, decision, 'evaluate');
      engine.addEdge(decision, end, 'done');
      const json = engine.toJSON();
      return snapshotFromJSON(json, { nodeCount: json.nodes.length, edgeCount: json.edges.length });
    }
    case 'L1':
      return {
        nodes: [
          { id: 'l1-input', name: 'Input', type: 'function' },
          { id: 'l1-transform', name: 'Transform', type: 'transform' },
          { id: 'l1-output', name: 'Output', type: 'function' },
        ],
        edges: [
          { source: 'l1-input', target: 'l1-transform', type: 'data' },
          { source: 'l1-transform', target: 'l1-output', type: 'data' },
        ],
        metrics: { nodeCount: 3, edgeCount: 2, projection: 'schema-fixture' },
      };
    case 'L2': {
      const engine = new StateMachine('Visualizer FSM', [
        { id: 'idle', label: 'Idle', type: 'initial' },
        { id: 'running', label: 'Running' },
        { id: 'done', label: 'Done', type: 'final' },
      ], [
        { from: 'idle', to: 'running', event: 'start' },
        { from: 'running', to: 'done', event: 'finish' },
      ], 'idle');
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L3': {
      const engine = new DependencyResolver();
      const app = generateId();
      const core = generateId();
      const runtime = generateId();
      const graphId = engine.createGraph('Visualizer Dependencies', [
        { id: app, name: 'app', type: 'package' },
        { id: core, name: 'core', type: 'library' },
        { id: runtime, name: 'runtime', type: 'module' },
      ], [
        { source: app, target: core, type: 'depends_on' },
        { source: app, target: runtime, type: 'depends_on' },
      ]);
      const graph = engine.getGraph(graphId)!;
      return { nodes: graph.nodes, edges: graph.edges, metrics: { nodeCount: graph.nodes.length, edgeCount: graph.edges.length } };
    }
    case 'L4': {
      const engine = new CallGraphBuilder();
      const graphId = engine.createGraph('Visualizer Calls');
      const main = engine.enterCall(graphId, 'main', 'function');
      const parse = engine.enterCall(graphId, 'parse', 'function');
      engine.exitCall(graphId, parse);
      engine.exitCall(graphId, main);
      const graph = engine.getGraph(graphId)!;
      return { nodes: graph.nodes, edges: graph.edges, metrics: engine.metrics(graphId) };
    }
    case 'L5': {
      const engine = new CFGBuilder();
      const cfgId = engine.createCFG('Visualizer CFG');
      engine.buildIfThenElse(cfgId, 'ready', 'process', 'recover', 'merge');
      const cfg = engine.getCFG(cfgId)!;
      return { nodes: cfg.blocks, edges: cfg.edges, metrics: engine.metrics(cfgId) };
    }
    case 'L6': {
      const engine = new DataFlowGraph();
      engine.buildETLPipeline();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L7': {
      const engine = new ComputationalGraph();
      engine.buildMLP();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L8': {
      const engine = new KnowledgeGraphEngine();
      engine.buildAIEcosystem();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L9': {
      const engine = new SemanticGraph();
      engine.buildAnimalTaxonomy();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L10': {
      const engine = new EmbeddingGraph();
      engine.addNode({ id: 'emb-a', label: 'Graph', vector: [1, 0, 0] });
      engine.addNode({ id: 'emb-b', label: 'Memory', vector: [0.9, 0.1, 0] });
      engine.addNode({ id: 'emb-c', label: 'Vision', vector: [0, 1, 0] });
      engine.buildKNN(2);
      return { nodes: engine.nodes, edges: engine.edges, metrics: engine.metrics() };
    }
    case 'L11': {
      const engine = new GraphRAGEngine();
      engine.buildDemo();
      return {
        nodes: engine.entities.map(entity => ({ id: entity.id, label: entity.name, type: entity.type })),
        edges: engine.relations,
        metrics: engine.metrics(),
      };
    }
    case 'L12': {
      const engine = new MemoryGraphEngine('Visualizer Memory');
      engine.buildConversation();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L13': {
      const engine = new AgentGraphEngine('Visualizer Agents');
      engine.buildDevTeam();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L14': {
      const engine = new ToolGraphEngine('Visualizer Tools');
      engine.buildToolEcosystem();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L15': {
      const engine = new WorkflowGraphEngine('Visualizer Workflow');
      engine.buildSupportWorkflow();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L16': {
      const engine = new NetworkGraphEngine('Visualizer Network');
      engine.buildInfrastructure();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L17': {
      const engine = new SocialGraphEngine('Visualizer Social');
      engine.buildTechNetwork();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L18': {
      const engine = new BiologicalGraphEngine('Visualizer Biological');
      engine.buildNeuralCircuit();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    case 'L19': {
      const engine = new MolecularGraphEngine('Visualizer Molecule');
      engine.buildWater();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }
    default:
      return { nodes: [], edges: [], metrics: { error: `Unknown level ${levelId}` } };
  }
}

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
  const targetLevels = levels || Object.keys(LEVEL_META);
  const data: Array<{ id: string; name: string; color: string; nodes: any[]; edges: any[]; metrics: any }> = [];

  for (const levelId of targetLevels) {
    const info = LEVEL_META[levelId];
    if (!info) continue;
    try {
      const snapshot = buildLevelSnapshot(levelId);
      data.push({
        id: levelId,
        name: info.name,
        color: info.color,
        nodes: snapshot.nodes.map((n: any) => ({
          id: String(n.id),
          label: n.label || n.name || n.element || n.concept || n.type || String(n.id),
          type: n.type || n.role || '',
        })),
        edges: snapshot.edges.map((e: any) => ({
          source: String(e.source ?? e.from ?? ''),
          target: String(e.target ?? e.to ?? ''),
          type: e.type || e.event || e.relation || '',
        })),
        metrics: snapshot.metrics,
      });
    } catch (err) {
      data.push({ id: levelId, name: info.name, color: info.color, nodes: [], edges: [], metrics: { error: (err as Error).message } });
    }
  }

  void config;
  return generateHTML(data);
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