// Generate training performance report as SVG

const fs = require('fs');
const path = require('path');
const resultsPath = path.join(__dirname, '..', 'training-results.json');

if (!fs.existsSync(resultsPath)) {
  console.log('No training results found. Run training-demo.ts first.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
const { scoreProgression, baselineScore, finalScore, improvement, patternsExtracted, evaluations, iterations } = results;

const W = 800, H = 600;
const M = { top: 60, right: 60, bottom: 80, left: 80 };
const chartW = W - M.left - M.right;
const chartH = H - M.top - M.bottom;

const minScore = Math.max(0, Math.floor(Math.min(...scoreProgression.map(s => s.score)) / 10) * 10);
const maxScore = Math.min(100, Math.ceil(Math.max(...scoreProgression.map(s => s.score)) / 10) * 10 + 10);
const scoreRange = maxScore - minScore;

function toX(i) { return M.left + (i / (scoreProgression.length - 1 || 1)) * chartW; }
function toY(s) { return M.top + chartH - ((s - minScore) / scoreRange) * chartH; }

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="background:#0d1117;font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#58a6ff" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#58a6ff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Title -->
  <text x="${W/2}" y="30" fill="#c9d1d9" font-size="18" font-weight="600" text-anchor="middle">COS Training Performance</text>
  <text x="${W/2}" y="48" fill="#8b949e" font-size="12" text-anchor="middle">${iterations} iterations · ${evaluations} evaluations · ${patternsExtracted} patterns learned · Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)} points</text>

  <!-- Chart area -->
  <rect x="${M.left}" y="${M.top}" width="${chartW}" height="${chartH}" fill="none" stroke="#21262d" stroke-width="1"/>

  <!-- Grid lines -->
  ${[0, 0.25, 0.5, 0.75, 1].map(p => {
    const y = toY(minScore + scoreRange * p);
    const score = Math.round(minScore + scoreRange * p);
    return `<line x1="${M.left}" y1="${y}" x2="${W - M.right}" y2="${y}" stroke="#21262d" stroke-width="1"/>
      <text x="${M.left - 8}" y="${y + 4}" fill="#8b949e" font-size="11" text-anchor="end">${score}</text>`;
  }).join('\n  ')}

  <!-- X-axis labels -->
  ${scoreProgression.map((s, i) => {
    const x = toX(i);
    const label = i % 2 === 0 || i === scoreProgression.length - 1 ? `I${s.iteration}` : '';
    return `<text x="${x}" y="${M.top + chartH + 16}" fill="#8b949e" font-size="9" text-anchor="middle" transform="rotate(-45,${x},${M.top + chartH + 16})">${label}</text>`;
  }).join('\n  ')}

  <!-- Area under curve -->
  <polygon points="${scoreProgression.map((s, i) => `${toX(i)},${toY(s.score)}`).join(' ')} ${toX(scoreProgression.length - 1)},${M.top + chartH} ${toX(0)},${M.top + chartH}" fill="url(#grad)"/>

  <!-- Line -->
  <polyline points="${scoreProgression.map((s, i) => `${toX(i)},${toY(s.score)}`).join(' ')}" fill="none" stroke="#58a6ff" stroke-width="2.5" stroke-linejoin="round"/>

  <!-- Data points -->
  ${scoreProgression.map((s, i) => {
    const x = toX(i), y = toY(s.score);
    const trend = s.trend === 'improving' ? '#3fb950' : s.trend === 'declining' ? '#f85149' : '#d29922';
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="#0d1117" stroke="${trend}" stroke-width="2"/>
      <text x="${x}" y="${y - 10}" fill="${trend}" font-size="9" text-anchor="middle">${s.score.toFixed(1)}</text>`;
  }).join('\n  ')}

  <!-- Baseline reference line -->
  <line x1="${M.left}" y1="${toY(baselineScore)}" x2="${toX(scoreProgression.length - 1)}" y2="${toY(baselineScore)}" stroke="#8b949e" stroke-width="1" stroke-dasharray="6,4" opacity="0.5"/>
  <text x="${W - M.right + 4}" y="${toY(baselineScore) + 4}" fill="#8b949e" font-size="9" opacity="0.7">baseline ${baselineScore.toFixed(1)}</text>

  <!-- Legend -->
  <rect x="${M.left + 10}" y="${H - 40}" width="10" height="10" rx="2" fill="#58a6ff"/>
  <text x="${M.left + 26}" y="${H - 31}" fill="#8b949e" font-size="11">Score</text>
  <line x1="${M.left + 100}" y1="${H - 35}" x2="${M.left + 130}" y2="${H - 35}" stroke="#8b949e" stroke-width="1" stroke-dasharray="6,4"/>
  <text x="${M.left + 136}" y="${H - 31}" fill="#8b949e" font-size="11">Baseline</text>

  <!-- Trend indicators -->
  <circle cx="${M.left + 240}" cy="${H - 35}" r="4" fill="#0d1117" stroke="#3fb950" stroke-width="1.5"/>
  <text x="${M.left + 250}" y="${H - 31}" fill="#8b949e" font-size="11">Improving</text>
  <circle cx="${M.left + 340}" cy="${H - 35}" r="4" fill="#0d1117" stroke="#d29922" stroke-width="1.5"/>
  <text x="${M.left + 350}" y="${H - 31}" fill="#8b949e" font-size="11">Stable</text>
  <circle cx="${M.left + 430}" cy="${H - 35}" r="4" fill="#0d1117" stroke="#f85149" stroke-width="1.5"/>
  <text x="${M.left + 440}" y="${H - 31}" fill="#8b949e" font-size="11">Declining</text>
</svg>`;

const outPath = path.join(__dirname, '..', 'training-performance.svg');
fs.writeFileSync(outPath, svg);
console.log(`Report generated: ${outPath}`);
console.log(`Dimensions: ${W}x${H}`);
console.log(`Data points: ${scoreProgression.length}`);
console.log(`Baseline: ${baselineScore.toFixed(1)} → Final: ${finalScore.toFixed(1)} (${improvement > 0 ? '+' : ''}${improvement.toFixed(1)})`);
