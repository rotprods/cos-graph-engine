const fs = require('fs');
const md = fs.readFileSync('/home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/cos/docs/sprint-plan.md', 'utf-8');

const lines = md.split('\n');
const tasks = [];
let currentPhase = '';
let currentSprint = '';
let sprintNum = 0;

for (const line of lines) {
  const phaseMatch = line.match(/^# PHASE [\da-z]+.*$/);
  if (phaseMatch) currentPhase = phaseMatch[0].replace('# ', '').trim();
  const sprintMatch = line.match(/^## Sprint (\d+)/);
  if (sprintMatch) { sprintNum = parseInt(sprintMatch[1]); currentSprint = sprintMatch[0].replace('## ', '').trim(); }
  const taskMatch = line.match(/^\|\s*(\d+\.\d+)\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
  if (taskMatch && sprintNum > 0) {
    const desc = taskMatch[2].trim().replace(/[🧪📄🚀]/g, '').trim().substring(0, 60);
    const sp = parseInt(taskMatch[3]);
    const owner = taskMatch[4].trim();
    const ac = taskMatch[6].trim();
    const isCritical = ac.includes('🔥');
    tasks.push({ id: taskMatch[1], desc, sp, owner, isCritical, sprintNum, phase: currentPhase });
  }
}

// Colors per phase
const phaseMeta = {
  'PHASE 0: FOUNDATION (Sprint 1)': { color: '#4ecca3', label: 'Phase 0: Foundation' },
  'PHASE 1: MVP RUNTIME (Sprints 2-3)': { color: '#6495ed', label: 'Phase 1: MVP Runtime' },
  'PHASE 2a: MEMORY SYSTEM (Sprints 4-5)': { color: '#3282b8', label: 'Phase 2a: Memory' },
  'PHASE 2b: KNOWLEDGE LAYER (Sprints 6-7)': { color: '#00adb5', label: 'Phase 2b: Knowledge' },
  'PHASE 3: COGNITION (Sprints 8-10)': { color: '#e23e57', label: 'Phase 3: Cognition' },
  'PHASE 4: EXECUTION & ORCHESTRATION (Sprints 11-13)': { color: '#f39c12', label: 'Phase 4: Execution' },
  'PHASE 5: PRODUCTION SYSTEMS (Sprints 14-17)': { color: '#53d769', label: 'Phase 5: Production' },
};

// Layout constants
const LEFT = 280;
const ROW_H = 20;
const HEADER_H = 60;
const PHASE_H = 28;
const WEEK_W = 54;
const TOTAL_W = LEFT + 17 * WEEK_W + 80;
const TOTAL_ROWS = tasks.reduce((acc, t) => { acc[t.phase] = (acc[t.phase]||0)+1; return acc; }, {});
const totalHeight = HEADER_H + 50 + Object.keys(phaseMeta).length * PHASE_H + tasks.length * ROW_H + 200;

let y = 0;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TOTAL_W} ${totalHeight}" width="${TOTAL_W}" height="${totalHeight}" style="background:#0d1117;font-family:system-ui,-apple-system,sans-serif;">\n`;

// Title
svg += `<text x="30" y="30" fill="#c9d1d9" font-size="20" font-weight="300">Cognitive Operating System — Implementation Gantt</text>`;
svg += `<text x="30" y="48" fill="#8b949e" font-size="12">${tasks.length} tasks · 17 sprints · 7 phases · ${tasks.reduce((s,t)=>s+t.sp,0)} story points</text>`;

y = HEADER_H;

// Legend bar
const legendItems = [
  { color: '#ff4444', label: 'Critical Path (🔥)' },
  { color: '#ffd700', label: 'Milestone' },
  { color: '#4ecca3', label: 'Phase 0' }, { color: '#6495ed', label: 'Phase 1' },
  { color: '#3282b8', label: 'Phase 2a' }, { color: '#00adb5', label: 'Phase 2b' },
  { color: '#e23e57', label: 'Phase 3' }, { color: '#f39c12', label: 'Phase 4' },
  { color: '#53d769', label: 'Phase 5' },
];
let lx = 30;
for (const item of legendItems) {
  svg += `<rect x="${lx}" y="${y-8}" width="12" height="12" rx="2" fill="${item.color}" opacity="0.85"/>`;
  svg += `<text x="${lx+18}" y="${y+2}" fill="#8b949e" font-size="10">${item.label}</text>`;
  lx += measureText(item.label) + 30 || 120;
}
y += 30;

// Y-axis labels column
svg += `<line x1="${LEFT-10}" y1="${y}" x2="${LEFT-10}" y2="${totalHeight-120}" stroke="#21262d" stroke-width="1"/>`;

// X-axis: weeks
for (let w = 1; w <= 17; w++) {
  const x = LEFT + (w-1) * WEEK_W;
  svg += `<line x1="${x}" y1="${y}" x2="${x}" y2="${totalHeight-120}" stroke="#21262d" stroke-width="1" stroke-dasharray="${w % 5 === 0 ? 'none' : '2,4'}"/>`;
  svg += `<text x="${x + WEEK_W/2}" y="${y-8}" fill="#8b949e" font-size="10" text-anchor="middle">S${w}</text>`;
  if (w === 3) svg += `<text x="${x + WEEK_W/2}" y="${y+14}" fill="#ffd700" font-size="8" text-anchor="middle">🎯MVP</text>`;
  if (w === 10) svg += `<text x="${x + WEEK_W/2}" y="${y+14}" fill="#ffd700" font-size="8" text-anchor="middle">🎯COG</text>`;
  if (w === 17) svg += `<text x="${x + WEEK_W/2}" y="${y+14}" fill="#ffd700" font-size="8" text-anchor="middle">🎯PROD</text>`;
  // Milestone diamonds at week end
  if ([1,3,5,7,10,13,17].includes(w)) {
    const mx = x + WEEK_W;
    svg += `<polygon points="${mx-5},${y-14} ${mx},${y-19} ${mx+5},${y-14} ${mx},${y-9}" fill="#ffd700" opacity="0.7"/>`;
  }
}
y += 5;

// Separate tasks by phase, sort by sprint
const phases = {};
for (const t of tasks) {
  if (!phases[t.phase]) phases[t.phase] = [];
  phases[t.phase].push(t);
}
for (const p of Object.keys(phases)) {
  phases[p].sort((a, b) => a.sprintNum - b.sprintNum || a.id.localeCompare(b.id));
}

// Draw rows
for (const [phaseName, phaseTasks] of Object.entries(phases)) {
  const meta = phaseMeta[phaseName] || { color: '#888', label: phaseName };
  
  // Phase header
  svg += `<rect x="0" y="${y}" width="${TOTAL_W}" height="${PHASE_H}" fill="${meta.color}" opacity="0.08"/>`;
  svg += `<text x="16" y="${y+18}" fill="${meta.color}" font-size="11" font-weight="600" letter-spacing="1">${meta.label}</text>`;
  y += PHASE_H;

  for (const task of phaseTasks) {
    const barColor = task.isCritical ? '#ff4444' : meta.color;
    const barOpacity = task.isCritical ? '0.9' : '0.7';
    const textColor = '#c9d1d9';
    const bgRow = tasks.indexOf(task) % 2 === 0;

    // Row background
    if (bgRow) svg += `<rect x="0" y="${y}" width="${TOTAL_W}" height="${ROW_H}" fill="#ffffff" opacity="0.02"/>`;

    // Task label
    const icon = task.isCritical ? '🔥 ' : '';
    svg += `<text x="12" y="${y+14}" fill="${textColor}" font-size="10">${icon}${task.desc}</text>`;
    svg += `<text x="12" y="${y+14}" fill="#484f58" font-size="8" text-anchor="end" transform="translate(270,0)">${task.owner} ${task.sp}pt</text>`;

    // Task bar
    const bx = LEFT + (task.sprintNum - 1) * WEEK_W + 2;
    const bw = WEEK_W - 4;
    svg += `<rect x="${bx}" y="${y+3}" width="${bw}" height="${ROW_H-6}" rx="3" fill="${barColor}" opacity="${barOpacity}"/>`;
    if (task.isCritical) {
      svg += `<rect x="${bx}" y="${y+3}" width="${bw}" height="${ROW_H-6}" rx="3" fill="none" stroke="#ff4444" stroke-width="1" opacity="0.6"/>`;
    }
    // SP label on bar
    svg += `<text x="${bx + bw/2}" y="${y+14}" fill="#fff" font-size="8" text-anchor="middle" opacity="0.9">${task.sp}</text>`;

    y += ROW_H;
  }
}

// Key at bottom
y += 20;
svg += `<text x="30" y="${y}" fill="#8b949e" font-size="13" font-weight="600">Key Milestones</text>`;
y += 5;
const milestones = [
  'S1  🔷 Core types, errors, BaseCell compile',
  'S3  🎯 MVP COMPLETE: System boots, processes input, observable',
  'S5  🔷 Memory: 12 layers working, consolidation/forgetting',
  'S7  🔷 Knowledge: Property graph, embeddings, ontology',
  'S10 🎯 COGNITION: CoT, ToT, Reflection, Planning, Eval, Learning',
  'S13 🎯 EXECUTION: Tools, Sandbox, Agents, Workflows, Policies',
  'S17 🎯 PRODUCTION RELEASE: API, Auth, Docker, CLI, benchmarks',
];
for (const m of milestones) {
  y += 20;
  svg += `<circle cx="36" cy="${y-5}" r="5" fill="#ffd700" opacity="0.8"/>`;
  svg += `<text x="50" y="${y-2}" fill="#8b949e" font-size="11">${m}</text>`;
}

// Stats
y += 40;
svg += `<text x="30" y="${y}" fill="#8b949e" font-size="12">${tasks.length} tasks · ${Object.keys(phases).length} phases · ${tasks.filter(t=>t.isCritical).length} critical path · ${tasks.reduce((s,t)=>s+t.sp,0)} SP · Built from sprint-plan.md</text>`;

svg += '</svg>';

fs.writeFileSync('/home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/gantt.svg', svg);
console.log(`SVG Gantt generated: ${tasks.length} tasks, ${Object.keys(phases).length} phases`);

function measureText(s) { return s.length * 7; }
