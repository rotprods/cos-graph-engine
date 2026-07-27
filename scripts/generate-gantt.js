const fs = require('fs');
const md = fs.readFileSync('/home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/cos/docs/sprint-plan.md', 'utf-8');

// Parse tasks from markdown table rows
const lines = md.split('\n');
const tasks = [];
let currentPhase = '';
let currentSprint = '';
let sprintNum = 0;

for (const line of lines) {
  const phaseMatch = line.match(/^# PHASE [\da-z]+.*$/);
  if (phaseMatch) currentPhase = phaseMatch[0].replace('# ', '').trim();

  const sprintMatch = line.match(/^## Sprint (\d+)/);
  if (sprintMatch) {
    sprintNum = parseInt(sprintMatch[1]);
    currentSprint = sprintMatch[0].replace('## ', '').trim();
  }

  // Match table rows with task data: | num | task | SP | owner | deps | AC |
  const taskMatch = line.match(/^\|\s*(\d+\.\d+)\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
  if (taskMatch && sprintNum > 0) {
    const taskNum = taskMatch[1];
    const desc = taskMatch[2].trim();
    const sp = parseInt(taskMatch[3]);
    const owner = taskMatch[4].trim();
    const deps = taskMatch[5].trim();
    const ac = taskMatch[6].trim();
    const isCritical = ac.includes('🔥');
    const isTest = desc.includes('🧪');
    const isDoc = desc.includes('📄');

    tasks.push({
      id: taskNum,
      desc: desc.replace(/[🧪📄🚀]/g, '').trim().substring(0, 70),
      sp,
      owner,
      deps: deps === 'None' ? [] : deps.split(',').map(d => d.trim()).filter(d => d !== 'None' && d !== ''),
      isCritical,
      isTest,
      isDoc,
      phase: currentPhase,
      sprint: currentSprint,
      sprintNum,
    });
  }
}

// Phase colors
const phaseColors = {
  'PHASE 0: FOUNDATION (Sprint 1)': { bg: '#1a1a2e', bar: '#4ecca3', text: '#e0e0e0' },
  'PHASE 1: MVP RUNTIME (Sprints 2-3)': { bg: '#16213e', bar: '#0f3460', text: '#e0e0e0' },
  'PHASE 2a: MEMORY SYSTEM (Sprints 4-5)': { bg: '#1b262c', bar: '#3282b8', text: '#e0e0e0' },
  'PHASE 2b: KNOWLEDGE LAYER (Sprints 6-7)': { bg: '#222831', bar: '#00adb5', text: '#e0e0e0' },
  'PHASE 3: COGNITION (Sprints 8-10)': { bg: '#1a1a2e', bar: '#e23e57', text: '#e0e0e0' },
  'PHASE 4: EXECUTION & ORCHESTRATION (Sprints 11-13)': { bg: '#16213e', bar: '#f39c12', text: '#e0e0e0' },
  'PHASE 5: PRODUCTION SYSTEMS (Sprints 14-17)': { bg: '#0f3460', bar: '#53d769', text: '#e0e0e0' },
};

// Group by phase
const phases = {};
for (const t of tasks) {
  if (!phases[t.phase]) phases[t.phase] = { tasks: [], color: phaseColors[t.phase] || { bg: '#333', bar: '#888', text: '#fff' } };
  phases[t.phase].tasks.push(t);
}

// Generate HTML
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>COS Gantt Chart — 17 Sprints</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#0a0a0f; font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif; color:#e0e0e0; padding:30px; }
h1 { font-size:22px; font-weight:300; letter-spacing:2px; color:#888; margin-bottom:4px; }
h2 { font-size:13px; font-weight:300; color:#555; margin-bottom:30px; }
.legend { display:flex; gap:25px; margin-bottom:25px; flex-wrap:wrap; font-size:11px; }
.legend div { display:flex; align-items:center; gap:6px; }
.legend .swatch { width:14px; height:14px; border-radius:3px; }
.legend .swatch.critical { background:#ff4444; }
.legend .swatch.normal { background:#4ecca3; }
.legend .swatch.milestone { background:#ffd700; width:14px; height:14px; border-radius:50%; }
.legend .swatch.phase0 { background:#4ecca3; }
.legend .swatch.phase1 { background:#0f3460; }
.legend .swatch.phase2a { background:#3282b8; }
.legend .swatch.phase2b { background:#00adb5; }
.legend .swatch.phase3 { background:#e23e57; }
.legend .swatch.phase4 { background:#f39c12; }
.legend .swatch.phase5 { background:#53d769; }
.gantt-wrap { overflow-x:auto; }
.gantt { min-width:1600px; position:relative; }
.header { display:grid; grid-template-columns:40px 200px 900px; gap:0; position:sticky; top:0; z-index:10; }
.week-header { display:grid; grid-template-columns:repeat(17,53px); }
.week-header div { font-size:10px; color:#666; padding:4px 0; text-align:center; border-bottom:1px solid #222; }
.sprint-row { display:grid; grid-template-columns:40px 200px 900px; font-size:10px; border-bottom:1px solid #111; }
.task-num { color:#555; padding:2px 4px; text-align:right; }
.task-name { padding:2px 8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.task-name .owner-badge { display:inline-block; font-size:8px; padding:1px 4px; border-radius:2px; margin-left:4px; opacity:0.7; }
.task-name .critical-mark { color:#ff4444; }
.task-name .test-mark { color:#ffd700; }
.task-name .doc-mark { color:#53d769; }
.task-bars { display:grid; grid-template-columns:repeat(17,53px); position:relative; }
.task-bar { height:16px; margin:1px 2px; border-radius:2px; position:relative; min-width:4px; }
.task-bar.critical { background:#ff4444; box-shadow:0 0 6px rgba(255,68,68,0.4); }
.task-bar.normal { opacity:0.85; }
.task-bar:hover { opacity:1; transform:scaleY(1.2); cursor:pointer; }
.task-bar .tooltip { display:none; position:absolute; bottom:22px; left:0; background:#1a1a1a; border:1px solid #333; padding:6px 8px; border-radius:4px; font-size:10px; white-space:nowrap; z-index:100; max-width:400px; }
.task-bar:hover .tooltip { display:block; }
.phase-header { display:contents; }
.phase-header .phase-label { grid-column:1/3; padding:6px 8px; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; }
.phase-header .phase-bars { display:grid; grid-template-columns:repeat(17,53px); }
.phase-header .phase-bars div { height:3px; margin-top:6px; }
.milestone-marker { position:absolute; top:0; width:2px; height:100%; background:#ffd700; z-index:5; opacity:0.6; }
.stats { margin-top:30px; display:grid; grid-template-columns:repeat(5,1fr); gap:15px; font-size:12px; }
.stat-card { background:#111; border:1px solid #222; border-radius:6px; padding:12px; }
.stat-card .num { font-size:24px; font-weight:600; }
.stat-card .label { color:#666; margin-top:2px; }
.mvp-badge { display:inline-block; background:#ffd700; color:#000; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:600; margin-left:8px; }
</style></head><body>
<h1>Cognitive Operating System — Implementation Gantt</h1>
<h2>17 sprints · 7 phases · ${tasks.length} tasks · 420 story points</h2>
<div class="legend">
  <div><div class="swatch critical"></div> Critical Path (🔥)</div>
  <div><div class="swatch normal"></div> Standard Task</div>
  <div><div class="swatch milestone"></div> Milestone</div>
  <div><div class="swatch phase0"></div> Phase 0: Foundation</div>
  <div><div class="swatch phase1"></div> Phase 1: MVP Runtime</div>
  <div><div class="swatch phase2a"></div> Phase 2a: Memory</div>
  <div><div class="swatch phase2b"></div> Phase 2b: Knowledge</div>
  <div><div class="swatch phase3"></div> Phase 3: Cognition</div>
  <div><div class="swatch phase4"></div> Phase 4: Execution/Orch</div>
  <div><div class="swatch phase5"></div> Phase 5: Production</div>
</div>
<div class="gantt-wrap"><div class="gantt">`;

// Week headers
html += '<div class="header"><div></div><div></div><div class="week-header">';
for (let w = 1; w <= 17; w++) {
  let label = `W${w}`;
  if ([3, 7, 10, 13, 17].includes(w)) label += ' 🎯';
  html += `<div>${label}</div>`;
}
html += '</div></div>';

// For each phase
let rowIdx = 0;
for (const [phaseName, phase] of Object.entries(phases)) {
  const color = phase.color || { bg: '#333', bar: '#888', text: '#fff' };
  const shortName = phaseName.replace(/\(.*\)/, '').trim();

  // Phase header row
  const phaseSprints = [...new Set(phase.tasks.map(t => t.sprintNum))];
  const minSprint = Math.min(...phaseSprints);
  const maxSprint = Math.max(...phaseSprints);

  html += `<div class="phase-header">
    <div class="phase-label" style="background:${color.bg};color:${color.text}">${shortName}</div>
    <div class="phase-bars">`;
  for (let w = 1; w <= 17; w++) {
    const active = w >= minSprint && w <= maxSprint;
    html += `<div style="background:${active ? color.bar : 'transparent'};opacity:${active ? '0.3' : '0'}"></div>`;
  }
  html += '</div></div>';

  // Milestone markers (sprint end = last week of that sprint)
  const milestones = [];
  if (phaseName.includes('PHASE 0')) milestones.push(1); // end of sprint 1
  if (phaseName.includes('PHASE 1')) milestones.push(3); // MVP
  if (phaseName.includes('PHASE 2a')) milestones.push(5);
  if (phaseName.includes('PHASE 2b')) milestones.push(7);
  if (phaseName.includes('PHASE 3')) milestones.push(10);
  if (phaseName.includes('PHASE 4')) milestones.push(13);
  if (phaseName.includes('PHASE 5')) milestones.push(17);

  // Sort tasks by sprint then critical
  const sortedTasks = [...phase.tasks].sort((a, b) => {
    if (a.sprintNum !== b.sprintNum) return a.sprintNum - b.sprintNum;
    if (a.isCritical !== b.isCritical) return b.isCritical ? 1 : -1;
    return 0;
  });

  for (const task of sortedTasks) {
    const barColor = task.isCritical ? '#ff4444' : color.bar;
    const ownerColors = { Core:'#4ecca3', Runtime:'#0f3460', Memory:'#3282b8', Knowledge:'#00adb5', Cognition:'#e23e57', Execution:'#f39c12', Orchestration:'#f1c40f', API:'#9b59b6', Infra:'#e67e22', DevOps:'#53d769', Observability:'#1abc9c' };
    const ownerColor = ownerColors[task.owner] || '#888';

    html += `<div class="sprint-row" style="background:${rowIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}">
      <div class="task-num">${task.id}</div>
      <div class="task-name">
        ${task.isCritical ? '<span class="critical-mark">🔥</span>' : ''}
        ${task.isTest ? '<span class="test-mark">🧪</span>' : ''}
        ${task.isDoc ? '<span class="doc-mark">📄</span>' : ''}
        ${escapeHtml(task.desc)}
        <span class="owner-badge" style="background:${ownerColor}">${task.owner} ${task.sp}pt</span>
      </div>
      <div class="task-bars">`;
    
    for (let w = 1; w <= 17; w++) {
      const isActive = w === task.sprintNum;
      if (isActive) {
        html += `<div class="task-bar ${task.isCritical ? 'critical' : 'normal'}" style="background:${barColor};width:49px">
          <div class="tooltip">${task.id}: ${escapeHtml(task.desc)} | ${task.owner} | ${task.sp}sp | Deps: ${task.deps.length ? task.deps.join(', ') : 'none'}</div>
        </div>`;
      } else {
        html += '<div></div>';
      }
    }
    html += '</div></div>';
    rowIdx++;
  }
}

html += '</div></div>';

// Stats
const criticalCount = tasks.filter(t => t.isCritical).length;
const testCount = tasks.filter(t => t.isTest).length;
const docCount = tasks.filter(t => t.isDoc).length;
const totalSP = tasks.reduce((s, t) => s + t.sp, 0);

html += `<div class="stats">
  <div class="stat-card"><div class="num" style="color:#4ecca3">${tasks.length}</div><div class="label">Total Tasks</div></div>
  <div class="stat-card"><div class="num" style="color:#ff4444">${criticalCount}</div><div class="label">Critical Path Tasks</div></div>
  <div class="stat-card"><div class="num" style="color:#ffd700">${totalSP}</div><div class="label">Story Points</div></div>
  <div class="stat-card"><div class="num" style="color:#53d769">17</div><div class="label">Sprints / Weeks</div></div>
  <div class="stat-card"><div class="num" style="color:#f39c12">${Object.keys(phases).length}</div><div class="label">Phases</div></div>
</div>`;

// Milestone table
html += `<div style="margin-top:25px;">
  <h3 style="color:#888;font-size:13px;font-weight:400;margin-bottom:10px;">Key Milestones</h3>
  <table style="font-size:11px;border-collapse:collapse;width:100%;max-width:800px;">
    <tr style="color:#555;border-bottom:1px solid #222;"><td style="padding:4px 8px;width:60px;">Week</td><td style="padding:4px 8px;">Milestone</td></tr>
    <tr><td style="padding:4px 8px;color:#ffd700;">1</td><td style="padding:4px 8px;">Phase 0 Gate: Core types, errors, BaseCell compile and pass tests</td></tr>
    <tr><td style="padding:4px 8px;color:#ffd700;">3</td><td style="padding:4px 8px;"><b>🚀 MVP COMPLETE</b> — system boots, processes input, observable events</td></tr>
    <tr><td style="padding:4px 8px;color:#ffd700;">5</td><td style="padding:4px 8px;">Memory Gate: 12 layers operational, consolidation/forgetting working</td></tr>
    <tr><td style="padding:4px 8px;color:#ffd700;">7</td><td style="padding:4px 8px;">Knowledge Gate: Property graph, embeddings, ontology all operational</td></tr>
    <tr><td style="padding:4px 8px;color:#ffd700;">10</td><td style="padding:4px 8px;">Cognition Gate: CoT, ToT, Reflection, Planning, Eval, Learning all working</td></tr>
    <tr><td style="padding:4px 8px;color:#ffd700;">13</td><td style="padding:4px 8px;">Execution Gate: Tools, Sandbox, Agents, Workflows, Policies all operational</td></tr>
    <tr><td style="padding:4px 8px;color:#ffd700;">17</td><td style="padding:4px 8px;"><b>🚀 PRODUCTION RELEASE</b> — API, Auth, Docker, CLI, benchmarks passed</td></tr>
  </table>
</div>`;

html += `</body></html>`;

fs.writeFileSync('/home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/cos/docs/gantt.html', html);
console.log(`Generated Gantt chart: ${tasks.length} tasks parsed`);
console.log(`Critical: ${criticalCount}, Tests: ${testCount}, Docs: ${docCount}, Total SP: ${totalSP}`);
console.log(`Phases: ${Object.keys(phases).join(', ')}`);