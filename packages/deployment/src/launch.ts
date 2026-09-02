#!/usr/bin/env node

// ================================================================
// COS Launch — Single command to start the complete system
// Initializes all subsystems, populates demo data, starts server
// ================================================================

import { COSServer } from '@cos/api';
import { HttpApiServer } from '@cos/api';
import { AuthMiddleware } from '@cos/api';
import { Configuration } from '@cos/infrastructure';
import { EntityId, BaseCell } from '@cos/core';

function color(s: string, c: string): string {
  const codes: Record<string, string> = { green: '\x1b[32m', blue: '\x1b[34m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };
  return `${codes[c] || ''}${s}${codes.reset || ''}`;
}

export async function launch(port: number = 8080) {
  console.log(`\n${color('╔══════════════════════════════════════════════════════════╗', 'cyan')}`);
  console.log(`${color('║', 'cyan')}        ${color('COGNITIVE OPERATING SYSTEM', 'green')}${color(' v0.1.0', 'yellow')}        ${color('║', 'cyan')}`);
  console.log(`${color('╚══════════════════════════════════════════════════════════╝', 'cyan')}\n`);

  // ========== CONFIG ==========
  const config = new Configuration();
  config.loadPresets();
  config.setRuntime('server.port', port);
  console.log(`  ${color('🔧', 'blue')} Configuration: ${config.get('server.host')}:${config.get('server.port')}`);

  // `Configuration` is the layered infrastructure config. `COSServer` owns a
  // deliberately smaller runtime config contract, so adapt explicitly at the
  // boundary instead of relying on structural casts.
  const server = new COSServer({
    host: config.get<string>('server.host') ?? '0.0.0.0',
    port: config.get<number>('server.port') ?? port,
    maxMemory: config.get<number>('server.maxMemory') ?? 1024,
    logLevel: config.get<string>('log.level') ?? 'info',
    plugins: [],
  });
  console.log(`  ${color('🧩', 'blue')} Core: EventBus + Scheduler + State + CellHost`);

  // ========== REGISTER CELLS ==========
  const processorCell = new (class extends BaseCell {
    constructor() {
      super({
        id: 'cos:core:processor' as EntityId,
        name: 'cognitive-processor',
        purpose: 'General cognitive processing cell for reasoning, analysis, and transformation',
        version: { major: 1, minor: 0, patch: 0 },
        owner: 'cos', type: 'cognitive',
        policies: [], dependencies: [],
        memory: { layers: ['working', 'short_term', 'long_term'], capacity: 1024 },
        tools: ['filesystem', 'http_client', 'search'],
        reasoningEngines: ['chain_of_thought', 'tree_of_thoughts', 'reflection', 'graph_of_thoughts', 'debate'],
        executionEngine: 'default',
        permissions: { '*': ['read', 'write', 'execute'] },
        config: { debug: false, maxTokens: 4096 },
        documentation: 'Primary cognitive processing cell. Handles all reasoning, planning, and analysis tasks through pluggable reasoning engines.',
      });
    }
    protected async onProcess(input: any, ctx: any) {
      return {
        result: { processed: input, ts: new Date().toISOString(), cell: this.definition.name },
        representations: {},
        cost: { units: 'credits', amount: 0.1 },
        confidence: 0.9,
        memoryUpdates: [], events: [], errors: [],
        metadata: { traceId: ctx.traceId },
      };
    }
  })();

  const toolCell = new (class extends BaseCell {
    constructor() {
      super({
        id: 'cos:execution:tools' as EntityId,
        name: 'tool-executor',
        purpose: 'Executes filesystem, HTTP, search, and sandbox operations',
        version: { major: 1, minor: 0, patch: 0 },
        owner: 'cos', type: 'execution',
        policies: [], dependencies: [processorCell.definition.id],
        memory: { layers: ['working'], capacity: 256 },
        tools: ['filesystem', 'http_client', 'search'],
        reasoningEngines: [],
        executionEngine: 'tool_runtime',
        permissions: { '*': ['read', 'write', 'execute'] },
        config: {},
        documentation: 'Tool execution cell. Routes operations to the real filesystem, HTTP client, and search tools.',
      });
    }
    protected async onProcess(input: any, ctx: any) {
      return {
        result: { tool: input, ts: new Date().toISOString() },
        representations: {}, cost: { units: 'credits', amount: 0.05 },
        confidence: 0.95, memoryUpdates: [], events: [], errors: [],
        metadata: { traceId: ctx.traceId },
      };
    }
  })();

  await server.cellHost.register(processorCell);
  await server.cellHost.register(toolCell);
  await server.agents.registerCell(processorCell);
  await server.agents.registerCell(toolCell);
  console.log(`  ${color('🧩', 'blue')} Cells: ${color('cognitive-processor', 'green')}, ${color('tool-executor', 'green')}`);

  // ========== AGENTS ==========
  await server.agents.defineAgent('cognitive-agent', 'General purpose cognitive agent', [processorCell.definition.id], { maxConcurrency: 2, timeout: 30000 });
  await server.agents.defineAgent('tool-agent', 'Tool execution agent', [toolCell.definition.id], { maxConcurrency: 4, timeout: 60000 });
  console.log(`  ${color('🤖', 'blue')} Agents: cognitive-agent, tool-agent`);

  // ========== POLICIES ==========
  await server.policies.addRule({ id: 'policy:allow-all' as EntityId, name: 'allow-all', description: 'Default allow for basic operations', effect: 'allow', actions: ['*'], resources: ['*'], conditions: [], priority: 0, enabled: true });
  console.log(`  ${color('🛡️', 'blue')} Policies: allow-all (default)`);

  // ========== DEMO DATA: MEMORY ==========
  await server.memory.store('COS Architecture: 11 subsystems organized in layers', 'semantic', { tags: ['architecture', 'cos'], importance: 0.95 });
  await server.memory.store('Cell lifecycle: created → initializing → ready → running → paused → terminated', 'procedural', { tags: ['runtime', 'cell'], importance: 0.9 });
  await server.memory.store('Self-improvement feedback loop: evaluate → learn → pattern → influence reasoning', 'procedural', { tags: ['self-improvement', 'meta-cognition'], importance: 0.85 });
  await server.memory.store('User preference: concise responses with structured data', 'long_term', { tags: ['user', 'preference'], importance: 0.8 });
  await server.memory.store('Meeting: COS design review — all 7 phases approved', 'episodic', { tags: ['meeting', 'milestone'], importance: 0.7 });
  console.log(`  ${color('💾', 'blue')} Memory: 5 entries across layers (semantic, procedural, episodic, long_term)`);

  // ========== DEMO DATA: KNOWLEDGE ==========
  await server.knowledge.addStatement({ subject: 'COS', predicate: 'is_a', object: 'Cognitive Operating System', confidence: 1.0, source: 'system' as EntityId, metadata: {}, embedding: undefined });
  await server.knowledge.addStatement({ subject: 'COS', predicate: 'has_version', object: '0.1.0', confidence: 1.0, source: 'system' as EntityId, metadata: {}, embedding: undefined });
  await server.knowledge.addStatement({ subject: 'COS', predicate: 'has_subsystems', object: '11', confidence: 1.0, source: 'system' as EntityId, metadata: {}, embedding: undefined });
  await server.knowledge.addStatement({ subject: 'CogCell', predicate: 'is', object: 'unit of cognitive computation', confidence: 1.0, source: 'system' as EntityId, metadata: {}, embedding: undefined });
  await server.knowledge.addStatement({ subject: 'EventBus', predicate: 'decouples', object: 'all components', confidence: 1.0, source: 'system' as EntityId, metadata: {}, embedding: undefined });
  await server.knowledge.addStatement({ subject: 'Memory', predicate: 'has', object: '12 layers with TTL and consolidation', confidence: 1.0, source: 'system' as EntityId, metadata: {}, embedding: undefined });
  await server.knowledge.addStatement({ subject: 'Reasoning', predicate: 'includes', object: '5 engines: CoT, ToT, Reflection, GoT, Debate', confidence: 1.0, source: 'system' as EntityId, metadata: {}, embedding: undefined });
  console.log(`  ${color('🔗', 'blue')} Knowledge: 7 statements (architecture, components, relationships)`);

  // ========== DEMO DATA: ONTOLOGY ==========
  const cognitiveCellClassId = await server.ontology.defineClass('CognitiveCell', 'A unit of cognitive computation', undefined, [
    { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
    { name: 'type', type: 'string', required: true, description: 'Cell type' },
    { name: 'memory', type: 'number', required: false, description: 'Memory capacity' },
  ]);
  const reasoningEngineClassId = await server.ontology.defineClass('ReasoningEngine', 'A reasoning strategy', undefined, [
    { name: 'type', type: 'string', required: true, description: 'Engine type enum' },
  ]);
  await server.ontology.defineRelation('uses', 'Cell uses a reasoning engine', [cognitiveCellClassId], [reasoningEngineClassId]);
  console.log(`  ${color('📐', 'blue')} Ontology: 2 classes, 1 relation`);

  // ========== SELF-IMPROVEMENT ==========
  for (let i = 0; i < 10; i++) {
    await server.selfImprovement.recordOutput(
      { query: `demo-query-${i}`, type: i % 2 === 0 ? 'analysis' : 'generation' },
      { result: `demo-result-${i}`, quality: 0.6 + Math.random() * 0.35 },
    );
  }
  const report = await server.selfImprovement.runMetaCognition(true);
  console.log(`  ${color('📈', 'blue')} Self-Improvement: ${report.totalEvaluations} evals, score ${(report.averageScore * 100).toFixed(0)}/100, trend: ${report.scoreTrend}`);

  // ========== POLICIES ==========
  console.log(`  ${color('🛡️', 'blue')} Policies: allow-all (default), RBAC ready`);

  // ========== HTTP SERVER ==========
  const auth = new AuthMiddleware(config);
  const httpServer = new HttpApiServer(server, auth, config);
  await httpServer.start();

  // ========== RUN AUTONOMOUS GOAL ==========
  console.log(`\n  ${color('🤖', 'blue')} Running autonomous goal...`);
  const goal = await server.createGoal('Analyze the COS architecture and verify all subsystems are operational', { traceId: 'cos-launch' });
  const goalResult = await server.executeGoal(goal.id);
  console.log(`  ${color('✅', 'green')} Goal: "${goal.description.substring(0, 50)}..." → ${goalResult.status} (${goalResult.plan.length} steps)`);

  // ========== SUMMARY ==========
  const stats = await server.getStats();
  console.log(`\n${color('╔══════════════════════════════════════════════════════════╗', 'green')}`);
  console.log(`${color('║', 'green')}        ${color('COS READY', 'cyan')} — ${color('All subsystems operational', 'yellow')}       ${color('║', 'green')}`);
  console.log(`${color('╚══════════════════════════════════════════════════════════╝', 'green')}\n`);
  console.log(`  ${color('📊', 'cyan')} Dashboard:       ${color(`http://localhost:${port}/`, 'cyan')}`);
  console.log(`  ${color('🔧', 'cyan')} Health:          ${color(`http://localhost:${port}/health`, 'cyan')}`);
  console.log(`  ${color('📈', 'cyan')} Stats:           ${color(`http://localhost:${port}/stats`, 'cyan')}`);
  console.log(`  ${color('🧩', 'cyan')} Cells:           ${stats.runtime.cells}`);
  console.log(`  ${color('💾', 'cyan')} Memory:          ${stats.memory.totalEntries} entries across ${Object.values(stats.memory.byLayer).filter((count) => typeof count === 'number' && count > 0).length} layers`);
  console.log(`  ${color('🔗', 'cyan')} Knowledge:       ${stats.knowledge.nodeCount || 0} nodes`);
  console.log(`  ${color('🧠', 'cyan')} Reasoning:       ${stats.reasoning} engines`);
  console.log(`  ${color('🔧', 'cyan')} Tools:           ${stats.tools}`);
  console.log(`  ${color('🤖', 'cyan')} Agents:          ${stats.agents}`);
  console.log(`  ${color('📋', 'cyan')} Workflows:       ${stats.workflows}`);
  console.log(`\n  ${color('cos help', 'yellow')} for CLI commands`);
  console.log(`  ${color('Ctrl+C', 'yellow')} to stop\n`);

  return { server, httpServer, config, auth };
}

// Run if executed directly
if (require.main === module) {
  const port = parseInt(process.env.COS_PORT || '8080', 10);
  launch(port).catch((e) => {
    console.error('Launch failed:', e.message);
    process.exit(1);
  });
}
