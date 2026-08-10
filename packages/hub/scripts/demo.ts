// Demo: carga el grafo REAL del ecosistema (cos-graph.json), aplica estados y consulta.
// Uso: npx tsx packages/hub/scripts/demo.ts <path-al-cos-graph.json>
import { CosHub } from '../src/hub';
import { HubQueries } from '../src/query';
import { HubIntelligence } from '../src/intelligence';
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

  // --- Tier 3: inteligencia (L10 embeddings + L7 GCN) ---
  const ai = new HubIntelligence();
  const emb = ai.build(hub);
  const clusters = ai.clusters(6);
  const roles = ai.roles();
  const preds = ai.predictLinks(hub, 8);

  console.log(`\n═══ TIER 3 · Inteligencia (${emb} repos embebidos, L10 + L7) ═══`);

  console.log(`\nClusters (k-means, L10):`);
  for (const [cid, ids] of Object.entries(clusters)) {
    console.log(`  C${cid} (${ids.length}): ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? '…' : ''}`);
  }

  console.log(`\nRoles por nodo (GCN, L7) — muestra de 6:`);
  const sorted = roles.slice().sort((a, b) => b.confidence - a.confidence);
  for (const r of sorted.slice(0, 6)) {
    console.log(`  ${r.nodeId.padEnd(24)} rol=${r.role} conf=${r.confidence.toFixed(2)} cluster=${r.cluster}`);
  }

  console.log(`\nLinks predichos (GCN, L7) — posible colaboración/dimensión:`);
  for (const l of preds) {
    console.log(`  ${l.from} ↔ ${l.to}  (score ${l.score})`);
  }

  console.log(`\n✅ Demo OK — hub operando + inteligencia sobre el grafo real del ecosistema.`);
}

main().catch(e => { console.error(e); process.exit(1); });