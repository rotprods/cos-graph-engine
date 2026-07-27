#!/usr/bin/env node
// ================================================================
// COS Commander — Interactive CLI with Terminal Dashboard
// ================================================================

import * as readline from 'readline';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';

function c(color: string, text: string): string { return `${color}${text}${RESET}`; }

function clearScreen() { process.stdout.write('\x1b[2J\x1b[0f'); }

function showBanner() {
  clearScreen();
  console.log(`
${c(CYAN, '╔══════════════════════════════════════════════════════════╗')}
${c(CYAN, '║')}        ${c(GREEN, 'COGNITIVE OPERATING SYSTEM')} ${c(YELLOW, 'v0.1.0')}        ${c(CYAN, '║')}
${c(CYAN, '╚══════════════════════════════════════════════════════════╝')}
${c(GRAY, '  Interactive CLI · Type help for commands · Ctrl+C to exit')}
`);
}

function showHelp() {
  console.log(`
${c(BOLD, 'Available Commands:')}
${c(GREEN, '  status')}      ${GRAY}- Show system health and metrics${RESET}
${c(GREEN, '  process')}     ${GRAY}- Process input through the COS${RESET}
${c(GREEN, '  reason')}      ${GRAY}- Run reasoning on a problem${RESET}
${c(GREEN, '  memory')}      ${GRAY}- Show memory statistics${RESET}
${c(GREEN, '  knowledge')}   ${GRAY}- Query the knowledge graph${RESET}
${c(GREEN, '  improve')}     ${GRAY}- Run self-improvement meta-cognition${RESET}
${c(GREEN, '  goals')}       ${GRAY}- List active autonomous goals${RESET}
${c(GREEN, '  cells')}       ${GRAY}- List registered cognitive cells${RESET}
${c(GREEN, '  config')}      ${GRAY}- Show current configuration${RESET}
${c(GREEN, '  clear')}       ${GRAY}- Clear the screen${RESET}
${c(GREEN, '  help')}        ${GRAY}- Show this help message${RESET}
${c(GREEN, '  exit')}        ${GRAY}- Exit the commander${RESET}
`);
}

function showStatusBar(stats: any) {
  const health = stats?.system?.status || 'unknown';
  const healthColor = health === 'healthy' ? GREEN : health === 'degraded' ? YELLOW : RED;
  const cells = stats?.system?.metrics?.cells || 0;
  const tools = stats?.system?.metrics?.tools || 0;
  const memory = stats?.memory?.totalEntries || 0;
  const reasoning = stats?.reasoning || 0;

  console.log(`\n${c(GRAY, '┌─')} ${c(BOLD, 'SYSTEM STATUS')} ${c(GRAY, '─────────────────────────────────────────────────────┐')}`);
  console.log(`${c(GRAY, '│')}  ${c(healthColor, '●')} Health: ${c(healthColor, health.padEnd(12))} ${c(BLUE, '🧩')} Cells: ${cells}  ${c(MAGENTA, '🧠')} Reasoning: ${reasoning}  ${c(GREEN, '🔧')} Tools: ${tools}  ${c(CYAN, '💾')} Memory: ${memory}`);
  console.log(`${c(GRAY, '└──────────────────────────────────────────────────────────────────┘')}\n`);
}

export async function runCommander() {
  const api = require('../api/src/index.ts');
  const infra = require('../infrastructure/src/index.ts');
  const core = require('../core/src/index.ts');

  const config = new infra.Configuration();
  config.loadPresets();
  const server = new api.COSServer(config);

  // Register a demo cell
  const cell = new (class extends core.BaseCell {
    constructor() {
      super({
        id: 'cos:commander:cell' as core.EntityId, name: 'commander-cell',
        purpose: 'Interactive CLI processing cell',
        version: { major: 1, minor: 0, patch: 0 }, owner: 'cos', type: 'cognitive',
        policies: [], dependencies: [],
        memory: { layers: ['working', 'episodic'], capacity: 512 },
        tools: ['filesystem', 'http_client', 'search'],
        reasoningEngines: ['chain_of_thought', 'tree_of_thoughts', 'reflection', 'graph_of_thoughts', 'debate'],
        executionEngine: 'default',
        permissions: { '*': ['read', 'write', 'execute'] },
        config: { interactive: true }, documentation: 'Commander cell',
      });
    }
    protected async onProcess(input: any, ctx: any) {
      return { result: { echo: input, ts: new Date().toISOString() }, representations: {},
        cost: { units: 'credits', amount: 0.1 }, confidence: 0.9, memoryUpdates: [], events: [], errors: [],
        metadata: { traceId: ctx.traceId } };
    }
  })();

  await server.cellHost.register(cell);
  await server.policies.addRule({ id: 'p:all' as core.EntityId, name: 'allow-all', description: '', effect: 'allow', actions: ['*'], resources: ['*'], conditions: [], priority: 0, enabled: true });

  // Seed demo data
  await server.memory.store('COS is a cognitive operating system with 11 subsystems', 'semantic', { tags: ['architecture', 'cos'], importance: 0.9 });
  await server.memory.store('5 reasoning engines: CoT, ToT, Reflection, GoT, Debate', 'semantic', { tags: ['reasoning'], importance: 0.85 });
  await server.knowledge.addStatement({ subject: 'COS', predicate: 'is', object: 'Cognitive Operating System', confidence: 1, source: 'sys' as core.EntityId, metadata: {}, embedding: undefined });
  await server.knowledge.addStatement({ subject: 'COS', predicate: 'has', object: '11 subsystems', confidence: 1, source: 'sys' as core.EntityId, metadata: {}, embedding: undefined });

  showBanner();
  showHelp();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: c(GREEN, 'cos> ') });
  rl.prompt();

  rl.on('line', async (line: string) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (cmd) {
      case 'status': {
        const health = await server.getHealth();
        const stats = await server.getStats();
        showStatusBar(health);
        console.log(`  ${c(BOLD, 'System:')}     ${health.system?.status}`);
        console.log(`  ${c(BOLD, 'Cells:')}      ${health.system?.metrics?.cells}`);
        console.log(`  ${c(BOLD, 'Memory:')}     ${(stats.memory as any).totalEntries} entries`);
        console.log(`  ${c(BOLD, 'Knowledge:')}  ${(stats.knowledge as any).nodeCount || 0} nodes`);
        console.log(`  ${c(BOLD, 'Reasoning:')}  ${stats.reasoning} engines`);
        console.log(`  ${c(BOLD, 'Tools:')}      ${stats.tools}`);
        console.log(`  ${c(BOLD, 'Agents:')}     ${stats.agents}`);
        break;
      }
      case 'process': {
        const input = args || 'hello COS';
        const output = await server.process({ input, target: cell.definition.id, context: { traceId: `cli-${Date.now()}` } });
        console.log(`\n  ${c(GREEN, 'Result:')}     ${JSON.stringify(output.result).substring(0, 120)}`);
        console.log(`  ${c(GRAY, 'Confidence:')}  ${(output.confidence * 100).toFixed(0)}%`);
        console.log(`  ${c(GRAY, 'Latency:')}     ${output.latency}ms`);
        break;
      }
      case 'reason': {
        const problem = args || 'analyze the system';
        const steps = await server.reasoning.reason('chain_of_thought', { problem, steps: 3 }, { traceId: `reason-${Date.now()}` });
        console.log(`\n  ${c(BOLD, 'Chain of Thought Reasoning:')}`);
        steps.forEach((s: any, i: number) => {
          console.log(`  ${c(GREEN, `Step ${i + 1}:`)} ${s.output.substring(0, 100)}`);
          console.log(`  ${c(GRAY, `  confidence: ${(s.confidence * 100).toFixed(0)}%`)}`);
        });
        break;
      }
      case 'memory': {
        const stats = await server.memory.stats();
        console.log(`\n  ${c(BOLD, 'Memory Statistics:')}`);
        console.log(`  Total: ${stats.totalEntries} entries`);
        for (const [layer, count] of Object.entries(stats.byLayer)) {
          if (count > 0) console.log(`  ${c(CYAN, layer.padEnd(15))} ${count} entries`);
        }
        break;
      }
      case 'knowledge': {
        const query = args || 'COS';
        const results = await server.knowledge.query(query);
        console.log(`\n  ${c(BOLD, `Knowledge Graph: "${query}"`)}`);
        if (results.length === 0) console.log(`  ${c(GRAY, 'No results found')}`);
        results.forEach((r: any) => console.log(`  ${c(CYAN, r.subject)} ${c(YELLOW, r.predicate)} ${c(GREEN, r.object)} ${c(GRAY, `(${(r.confidence * 100).toFixed(0)}%)`)}`));
        break;
      }
      case 'improve': {
        for (let i = 0; i < 3; i++) await server.selfImprovement.recordOutput({ q: `cli-${i}` }, { r: `result-${i}` });
        const report = await server.selfImprovement.runMetaCognition(true);
        console.log(`\n  ${c(BOLD, 'Self-Improvement Report:')}`);
        console.log(`  Score: ${c(GREEN, (report.averageScore * 100).toFixed(0) + '/100')}`);
        console.log(`  Trend: ${report.scoreTrend === 'improving' ? c(GREEN, 'improving') : c(YELLOW, report.scoreTrend)}`);
        console.log(`  Evaluations: ${report.totalEvaluations}`);
        console.log(`  Patterns: ${report.topPatterns.length}`);
        report.suggestions.forEach((s: string) => console.log(`  ${c(GRAY, '→')} ${s}`));
        break;
      }
      case 'goals': {
        const active = await server.getActiveGoals();
        const completed = await server.getCompletedGoals();
        console.log(`\n  ${c(BOLD, 'Autonomous Goals:')}`);
        console.log(`  Active: ${active.length}`);
        if (completed.length > 0) console.log(`  Completed: ${completed.length} (last: ${completed[0].summary?.substring(0, 60)})`);
        break;
      }
      case 'cells': {
        const cells = server.cellHost.getAllCells();
        console.log(`\n  ${c(BOLD, 'Cognitive Cells:')}`);
        cells.forEach((c: any) => {
          console.log(`  ${c(GREEN, '●')} ${c(BOLD, c.definition.name)} ${c(GRAY, '(' + c.definition.type + ')')}`);
          console.log(`     ${c(GRAY, c.definition.purpose.substring(0, 60))}`);
        });
        break;
      }
      case 'config': {
        console.log(`\n  ${c(BOLD, 'Configuration:')}`);
        console.log(`  Server: ${config.get('server.host')}:${config.get('server.port')}`);
        console.log(`  Log level: ${config.get('log.level')}`);
        console.log(`  Self-improvement: ${config.get('selfImprovement.enabled')}`);
        break;
      }
      case 'clear':
        showBanner();
        break;
      case 'help':
        showHelp();
        break;
      case 'exit':
      case 'quit':
        console.log(`\n  ${c(YELLOW, 'Goodbye!')}\n`);
        rl.close();
        process.exit(0);
        break;
      default:
        if (cmd) console.log(`  ${c(RED, 'Unknown command:')} ${cmd}. Type ${c(GREEN, 'help')} for available commands.`);
    }
    rl.prompt();
  });
}

if (require.main === module) {
  runCommander().catch((e) => {
    console.error(c(RED, `Error: ${e.message}`));
    process.exit(1);
  });
}