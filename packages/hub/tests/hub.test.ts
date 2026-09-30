// Tests del CosHub: carga del grafo del ecosistema, estados (L2), dimensiones (L8),
// agentes (L13), workflows (L15) y streaming.
import { CosHub } from '../src/hub';
import { HubQueries } from '../src/query';
import { handleGitHubEvent } from '../src/webhook';
import { MemoryStore } from '../src/store';
import { loadEcosystemData } from '../src/ecosystem';

let p = 0;
let f = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); }
}

// Grafo de ejemplo del ecosistema (2 repos, 2 dimensiones).
const sample = {
  nodes: [
    { id: 'R-aaa', label: 'aaa', type: 'repo', metadata: { url: 'https://github.com/rotprods/aaa', description: 'A repo' } },
    { id: 'R-bbb', label: 'bbb', type: 'repo', metadata: { url: 'https://github.com/rotprods/bbb', description: 'B repo' } },
  ],
  edges: [
    { id: 'e1', source: 'R-aaa', target: 'L13', weight: 1.0 },
    { id: 'e2', source: 'R-aaa', target: 'L15', weight: 0.6 },
    { id: 'e3', source: 'R-bbb', target: 'L8', weight: 1.0 },
  ],
};

async function main() {
  const hub = new CosHub(new MemoryStore());
  const stats = hub.loadEcosystem(loadEcosystemData(sample));
  assert(stats.repos === 2, 'ecosystem: 2 repos cargados');
  assert(stats.dimensions === 3, 'ecosystem: 3 dimensiones (L13, L15, L8)');
  assert(stats.relations === 3, 'ecosystem: 3 relaciones repo->dimension');

  // L8 Knowledge: entidades y relaciones
  assert(hub.kg.entities.length === 5, 'L8: 2 repos + 3 dims = 5 entidades');
  assert(hub.kg.relations.length === 3, 'L8: 3 relaciones in_dimension');

  // L2 State: transiciones
  const st0 = hub.getRepoState('R-aaa');
  assert(st0 === 'PENDING', `L2: estado inicial PENDING (got ${st0})`);
  await hub.setRepoState('R-aaa', 'init');
  assert(hub.getRepoState('R-aaa') === 'DEV', 'L2: init -> DEV');
  const deployed = await hub.setRepoState('R-aaa', 'deploy');
  assert(deployed && hub.getRepoState('R-aaa') === 'LIVE', 'L2: deploy -> LIVE');
  const bad = await hub.setRepoState('R-bbb', 'deploy'); // PENDING no tiene transicion deploy
  assert(!bad && hub.getRepoState('R-bbb') === 'PENDING', 'L2: transicion invalida rechazada');

  // Query por dimension
  const q = new HubQueries(hub);
  const inL13 = q.byDimension('L13');
  assert(inL13.length === 1 && inL13[0].id === 'R-aaa', 'query: solo R-aaa en L13');
  const coverage = q.dimensionCoverage();
  assert(coverage['L8'] === 1 && coverage['L13'] === 1, 'query: coverage por dimension');

  // L13 Agent
  hub.seedAgents();
  assert(hub.agents.getNodes().length === 3, 'L13: 3 agentes');
  assert(hub.agents.getEdges().length === 2, 'L13: 2 aristas de delegacion');

  // L15 Workflow
  hub.seedWorkflow('demo', [
    { name: 'in', type: 'webhook', service: 'github' },
    { name: 'act', type: 'action', service: 'cos-hub' },
  ]);
  assert(hub.workflows.getNodes().length >= 2, 'L15: workflow con nodos');

  // Streaming / realtime
  let received = 0;
  const unsub = hub.stream.subscribe(() => { received++; });
  hub.seedAgents();
  assert(received > 0, 'stream: parches recibidos por suscriptores');
  unsub();

  // Webhook
  const r = await handleGitHubEvent(hub, { event: 'push', repo: 'aaa' });
  assert(r.applied && r.event === 'change', 'webhook: push -> change');
  assert(hub.getRepoState('R-aaa') === 'DEV', 'webhook: push pone repo en DEV (LIVE->DEV)');

  // Persistencia
  hub.persist();
  const snap = (hub as unknown as { store: MemoryStore }).store.load();
  assert(snap !== null && snap.repoStates['R-aaa'] === 'DEV', 'store: snapshot persistido');

  console.log(`\n📊 HUB: ${p} tests, ${p + f} total, ${f} failed`);
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });