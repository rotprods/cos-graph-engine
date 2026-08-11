// Demo: carga el grafo REAL del ecosistema (cos-graph.json), aplica estados y consulta.
// Uso: npx tsx packages/hub/scripts/demo.ts <path-al-cos-graph.json>
import { CosHub } from '../src/hub';
import { HubQueries } from '../src/query';
import { HubRAG } from '../src/rag';
import { handleGitHubEvent } from '../src/webhook';
import { loadEcosystemFile } from '../src/ecosystem';
import { MemoryStore } from '../src/store';

const path = process.argv[2];
if (!path) {
  console.error('Uso: npx tsx packages/hub/scripts/demo.ts <cos-graph.json>');
  process.exit(1);
}

async function main() {
  const hub = new CosHub(new MemoryStore());
  const stats = hub.loadEcosystem(loadEcosystemFile(path));
  console.log(`\n══════════════ COS HUB — ecosistema real ══════════════`);
  console.log(`Cargado: ${stats.repos} repos × ${stats.dimensions} dimensiones, ${stats.relations} relaciones in_dimension`);

  hub.seedAgents();
  hub.seedWorkflow('ecosystem-watch', [
    { name: 'Webhook ingest', type: 'webhook', service: 'github' },
    { name: 'State update', type: 'action', service: 'cos-hub' },
    { name: 'Notify', type: 'notification', service: 'slack' },
  ]);

  const q = new HubQueries(hub);

  // Resumen
  const s = q.summary();
  console.log(`\nEstados por repo: ${JSON.stringify(s.byState)}`);

  // Cobertura por dimension (top)
  const cov = q.dimensionCoverage();
  const top = Object.entries(cov).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`\nTop dimensiones por nº de repos:`);
  for (const [dim, n] of top) console.log(`  ${dim.padEnd(4)} ${n} repos`);

  // Simular vida del ecosistema: inicializar todos (PENDING->DEV) y desplegar una parte (DEV->LIVE)
  let live = 0;
  for (const row of q.all()) {
    await hub.setRepoState(row.id, 'init');            // PENDING -> DEV
    if (Math.random() < 0.4) {                          // un 40% "desplegado"
      await hub.setRepoState(row.id, 'deploy');         // DEV -> LIVE
      live++;
    }
  }
  console.log(`\nSimulación: ${q.all().length} repos inicializados, ${live} en LIVE, ${s.byState['LIVE'] || 0}→${q.summary().byState['LIVE']}`);

  // Webhook en vivo: un push a cos-graph-engine (LIVE -> DEV)
  const before = hub.getRepoState('R-cos-graph-engine');
  const r = await handleGitHubEvent(hub, { event: 'push', repo: 'cos-graph-engine' });
  console.log(`\nWebhook push a cos-graph-engine: ${before} -> ${hub.getRepoState('R-cos-graph-engine')} (evento ${r.event})`);

  // Streaming: contar parches
  let patches = 0;
  const unsub = hub.stream.subscribe(() => { patches++; });
  hub.seedAgents();
  unsub();
  console.log(`Streaming: ${patches} parches emitidos desde suscripción`);

  // Muestra: repos de la dimension L13 (Agent)
  console.log(`\nRepos en L13 (Agent): ${q.byDimension('L13').length}`);
  console.log(`Repos en L0 (Visual): ${q.byDimension('L0').length}`);

  // --- Tier 3: GraphRAG (L11) — consulta semántica ---
  const rag = new HubRAG();
  const indexed = rag.build(hub);
  console.log(`\n═══ TIER 3 · GraphRAG (${indexed} chunks indexados, L11) ═══`);
  const queries = [
    'orquestación de agentes',
    'molecular',
    'motor de video y edición',
    'grafos de conocimiento',
  ];
  for (const q of queries) {
    const hits = rag.search(q, [], 3);
    console.log(`\n  ? "${q}"`);
    for (const h of hits) console.log(`     ${h.repo.padEnd(26)} score=${h.score.toFixed(3)}`);
  }

  console.log(`\n✅ Demo OK — hub + GraphRAG semántico sobre el grafo real del ecosistema.`);
}

main().catch(e => { console.error(e); process.exit(1); });