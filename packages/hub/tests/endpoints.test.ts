// Cobertura de endpoints — superficie publica COMPLETA del hub:
// CosHub, HubQueries, HubIntelligence, HubRAG, webhook, store y createHub.
// Incluye casos borde (vacios, desconocidos, invalidos).
import { writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CosHub } from '../src/hub';
import { HubQueries } from '../src/query';
import { HubIntelligence } from '../src/intelligence';
import { HubRAG, TfidfVectorizer, tokenize, normalizeToken } from '../src/rag';
import { handleGitHubEvent, eventToRepoEvent } from '../src/webhook';
import { MemoryStore, JSONStore } from '../src/store';
import { loadEcosystemData, loadEcosystemFile } from '../src/ecosystem';
import { createHub } from '../src/index';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

const sample = {
  nodes: [
    { id: 'R-a', label: 'a', type: 'repo', metadata: { url: 'https://x/a', description: 'agent orchestration tool', language: 'TypeScript' } },
    { id: 'R-b', label: 'b', type: 'repo', metadata: { url: 'https://x/b', description: 'molecular chemistry engine', language: 'Python' } },
    { id: 'L13', label: 'L13 Agent', type: 'level' },
  ],
  edges: [
    { id: 'e1', source: 'R-a', target: 'L13', label: 'L13' },
    { id: 'e2', source: 'R-b', target: 'L19', label: 'L19' },
  ],
};

async function main() {
  // ---- store ----
  const mem = new MemoryStore();
  assert(mem.load() === null, 'store: MemoryStore vacio -> null');
  mem.save({ version: 1, updatedAt: '', graph: { entities: [], relations: [] }, repoStates: {}, agentIds: [], workflowIds: [] });
  assert(mem.load()?.version === 1, 'store: MemoryStore persiste/lee');
  const tmpFile = join(tmpdir(), `cos-hub-${Date.now()}.json`);
  const js = new JSONStore(tmpFile);
  js.save({ version: 2, updatedAt: '', graph: { entities: [], relations: [] }, repoStates: {}, agentIds: [], workflowIds: [] });
  assert(js.load()?.version === 2, 'store: JSONStore round-trip en disco');
  rmSync(tmpFile, { force: true });

  // ---- ecosystem ----
  assert(loadEcosystemData(sample).nodes.length === 3, 'ecosystem: loadEcosystemData');

  // ---- CosHub ----
  const hub = new CosHub(new MemoryStore());
  const stats = hub.loadEcosystem(loadEcosystemData(sample));
  assert(stats.repos === 2 && stats.relations === 2, 'CosHub.loadEcosystem cuenta repos/relaciones');
  assert(hub.getRepoState('R-a') === 'PENDING', 'CosHub.getRepoState inicial PENDING');
  assert(hub.getRepoState('R-inexistente') === null, 'CosHub.getRepoState desconocido -> null');
  assert(hub.getRepoMeta('R-a')['language'] === 'TypeScript', 'CosHub.getRepoMeta devuelve metadata');
  assert(hub.getRepoMeta('R-x') && Object.keys(hub.getRepoMeta('R-x')).length === 0, 'CosHub.getRepoMeta desconocido -> {}');
  assert(hub.reposInDimension('L13').length === 1, 'CosHub.reposInDimension L13');
  assert(hub.reposInDimension('L99').length === 0, 'CosHub.reposInDimension inexistente -> []');
  assert(await hub.setRepoState('R-a', 'init'), 'CosHub.setRepoState init -> true');
  assert(!(await hub.setRepoState('R-a', 'deploy-invalido-xx')), 'CosHub.setRepoState evento invalido -> false');
  assert(!(await hub.setRepoState('R-inexistente', 'init')), 'CosHub.setRepoState repo desconocido -> false');
  hub.seedAgents();
  assert(hub.agents.getNodes().length === 3, 'CosHub.seedAgents crea 3 agentes');
  hub.seedWorkflow('w', [{ name: 'in', type: 'webhook' }, { name: 'out', type: 'end' }]);
  assert(hub.workflows.getNodes().length >= 2, 'CosHub.seedWorkflow crea nodos');
  const counts = hub.repoCountByState();
  assert(counts['DEV'] === 1, 'CosHub.repoCountByState cuenta DEV');
  const snap = hub.snapshot();
  assert(snap.repoStates['R-a'] === 'DEV' && snap.agentIds.length === 3, 'CosHub.snapshot completo');
  hub.persist(); // no lanza

  // ---- HubQueries ----
  const q = new HubQueries(hub);
  assert(q.byDimension('L13').length === 1, 'HubQueries.byDimension');
  assert(q.all().length === 2, 'HubQueries.all');
  const row = q.row('R-a');
  assert(row.id === 'R-a' && row.state === 'DEV' && row.url === 'https://x/a', 'HubQueries.row completo');
  const cov = q.dimensionCoverage();
  assert(cov['L13'] === 1, 'HubQueries.dimensionCoverage');
  const sum = q.summary();
  assert(sum.repos === 2 && sum.relations === 2, 'HubQueries.summary');

  // ---- HubIntelligence ----
  const ai = new HubIntelligence();
  assert(ai.build(hub) === 2, 'Intelligence.build embebe 2 repos');
  assert(ai.neighbors('R-a').length >= 0, 'Intelligence.neighbors');
  assert(ai.clusters(2) !== null, 'Intelligence.clusters');
  assert(ai.roles().length === 2, 'Intelligence.roles');
  assert(Array.isArray(ai.predictLinks(hub, 3)), 'Intelligence.predictLinks');

  // ---- HubRAG ----
  const rag = new HubRAG();
  assert(rag.build(hub) === 2, 'RAG.build indexa 2 chunks');
  assert(rag.search('orquestacion').length >= 1, 'RAG.search devuelve resultados');
  assert(rag.search('').length >= 0, 'RAG.search vacio no lanza');

  // ---- rag helpers ----
  assert(tokenize('el de la ORQUESTACIÓN').length === 1, 'tokenize quita stopwords + normaliza');
  assert(normalizeToken('MOLÉCULA') === 'molecula', 'normalizeToken sin diacriticos');
  const v = new TfidfVectorizer();
  v.fit(['alpha beta gamma', 'beta gamma delta']);
  assert(v.dim === 4 && v.transform('beta gamma').length === 4, 'TfidfVectorizer dim/transform');

  // ---- webhook ----
  assert(eventToRepoEvent({ event: 'push', repo: 'a' }) === 'change', 'webhook: push -> change');
  assert(eventToRepoEvent({ event: 'nope', repo: 'a' }) === null, 'webhook: evento desconocido -> null');
  await hub.setRepoState('R-a', 'deploy'); // DEV -> LIVE
  const before = hub.getRepoState('R-a');
  const r = await handleGitHubEvent(hub, { event: 'push', repo: 'a' });
  assert(r.applied && hub.getRepoState('R-a') !== before, 'webhook: aplica transicion (LIVE->DEV con push)');
  const r2 = await handleGitHubEvent(hub, { event: 'nope', repo: 'a' });
  assert(!r2.applied, 'webhook: evento desconocido no aplica');
  const r3 = await handleGitHubEvent(hub, { event: 'push', repo: 'zzz-inexistente' });
  assert(!r3.applied, 'webhook: repo desconocido no aplica');

  // ---- createHub (con archivo real) ----
  const ecoFile = join(tmpdir(), `cos-eco-${Date.now()}.json`);
  writeFileSync(ecoFile, JSON.stringify(sample));
  const h2 = createHub(ecoFile, new MemoryStore());
  assert(h2.kg.entities.filter(e => e.type === 'repo').length === 2, 'createHub carga repos');
  assert(h2.agents.getNodes().length === 3, 'createHub siembra agentes');
  assert(h2.workflows.getNodes().length >= 3, 'createHub siembra workflow');
  assert(loadEcosystemFile(ecoFile).nodes.length === 3, 'loadEcosystemFile desde disco');
  rmSync(ecoFile, { force: true });

  console.log(`\n📊 ENDPOINTS: ${p} tests, ${p + f} total, ${f} failed`);
  process.exit(f > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
