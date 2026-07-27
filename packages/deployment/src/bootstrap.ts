#!/usr/bin/env node

// COS Bootstrap — creates and initializes the Cognitive Operating System
import { COSServer } from '@cos/api';
import { generateId, EntityId } from '@cos/core';
import { BaseCell } from '@cos/core';

async function main() {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║  COGNITIVE OPERATING SYSTEM v0.1.0                        ║
  ║  Initializing...                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);

  const server = new COSServer({
    host: process.env.COS_HOST || 'localhost',
    port: parseInt(process.env.COS_PORT || '8080', 10),
    maxMemory: parseInt(process.env.COS_MAX_MEMORY || '1024', 10),
    logLevel: process.env.COS_LOG_LEVEL || 'info',
    plugins: (process.env.COS_PLUGINS || '').split(',').filter(Boolean),
  });

  // Register example cell: a cognitive processor
  const exampleCell = new (class extends BaseCell {
    constructor() {
      super({
        id: 'cos:core:processor' as EntityId,
        name: 'cognitive-processor',
        purpose: 'Default cognitive processing cell for general computation',
        version: { major: 1, minor: 0, patch: 0 },
        owner: 'cos',
        type: 'cognitive',
        policies: [],
        dependencies: [],
        memory: { layers: ['working', 'short_term', 'long_term'], capacity: 1024 },
        tools: ['filesystem', 'http_client', 'search'],
        reasoningEngines: ['chain_of_thought', 'tree_of_thoughts', 'reflection'],
        executionEngine: 'default',
        permissions: { '*': ['read', 'write', 'execute'] },
        config: { debug: false, maxTokens: 4096 },
        documentation: 'Default cognitive processing cell',
      });
    }

    protected async onProcess(input: unknown, context: any) {
      return {
        result: input,
        representations: {},
        cost: { units: 'credits', amount: 0.1 },
        confidence: 1.0,
        memoryUpdates: [],
        events: [],
        errors: [],
        metadata: {},
      };
    }
  })();

  await server.cellHost.register(exampleCell);
  await server.agents.registerCell(exampleCell);

  // Define a default agent
  await server.agents.defineAgent(
    'default-agent',
    'General purpose cognitive agent',
    [exampleCell.definition.id],
    { maxConcurrency: 1, timeout: 30000 },
  );

  // Define example policy
  await server.policies.addRule({
    id: 'policy:default' as EntityId,
    name: 'default-allow',
    description: 'Default allow policy for basic operations',
    effect: 'allow',
    actions: ['*'],
    resources: ['*'],
    conditions: [],
    priority: 0,
    enabled: true,
  });

  // Define default workflow
  await server.workflows.define(
    'cognize',
    'Standard cognitive processing workflow',
    [
      { id: 'step:receive' as EntityId, type: 'cell', target: exampleCell.definition.id },
    ],
    { version: '1.0.0' },
  );

  // Register workflow step handlers
  server.workflows.registerStepType('cell', async (step, input, context) => {
    const cell = server.cellHost.getCell(step.target!);
    return cell!.process(input, context);
  });

  // Start the system
  await server.start();
  const stats = await server.getStats();

  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║  SYSTEM INITIALIZED                                        ║
  ╚═══════════════════════════════════════════════════════════╝

  Cells:       ${stats.runtime.cells}
  Subscribers: ${stats.runtime.subscribers}
  Events:      ${stats.runtime.events}
  Memory:      ${stats.memory.totalEntries} entries
  Tools:       ${stats.tools}
  Agents:      ${stats.agents}
  Workflows:   ${stats.workflows}
  Policies:    ${(server.policies as any).rules?.size || 0}
  Embeddings:  ${server.embeddings.stats.totalEmbeddings}

  API:         http://${server.config.host}:${server.config.port}
  `);

  return server;
}

if (require.main === module) {
  main().catch(console.error);
}

export { main, COSServer };