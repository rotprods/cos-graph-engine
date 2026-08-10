// Tests de la capa GraphRAG (L11) sobre el ecosistema.
import { CosHub } from '../src/hub';
import { HubRAG, hashTextEmbedding } from '../src/rag';
import { MemoryStore } from '../src/store';
import { loadEcosystemData } from '../src/ecosystem';

let p = 0;
let f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

const sample = {
  nodes: [
    { id: 'R-agents', label: 'agents', type: 'repo', metadata: { url: 'https://x/agents', description: 'agent orchestration and delegation', language: 'TypeScript' } },
    { id: 'R-mol', label: 'mol', type: 'repo', metadata: { url: 'https://x/mol', description: 'molecular chemistry and drug discovery', language: 'Python' } },
    { id: 'R-social', label: 'social', type: 'repo', metadata: { url: 'https://x/social', description: 'social media growth and audience', language: 'Rust' } },
  ],
  edges: [
    { id: 'e1', source: 'R-agents', target: 'L13', weight: 1.0 },
    { id: 'e2', source: 'R-mol', target: 'L19', weight: 1.0 },
    { id: 'e3', source: 'R-social', target: 'L17', weight: 1.0 },
  ],
};

function main() {
  const hub = new CosHub(new MemoryStore());
  hub.loadEcosystem(loadEcosystemData(sample));
  const rag = new HubRAG();

  const n = rag.build(hub);
  assert(n === 3, 'L11: 3 repos indexados como chunks');

  // Embedding consistente entre index y query
  assert(hashTextEmbedding('hola').length === 96, 'L11: embedding de dim fija');
  assert(Math.abs(hashTextEmbedding('repos de agentes').reduce((a, b) => a + b, 0)) > 0, 'L11: embedding no vacio');

  // Consulta semantica: agentes
  const agentHits = rag.search('agent orchestration');
  assert(agentHits.length >= 1, 'L11: query agentes devuelve resultados');
  assert(agentHits[0].repo === 'R-agents', 'L11: el repo de agentes es el top hit');

  // Consulta: molecular
  const molHits = rag.search('molecular chemistry drug');
  assert(molHits[0].repo === 'R-mol', 'L11: el repo molecular es el top hit');

  // Consulta: social
  const socHits = rag.search('social media audience growth');
  assert(socHits[0].repo === 'R-social', 'L11: el repo social es el top hit');

  // Score en [0,1]
  assert(agentHits.every(h => h.score >= 0 && h.score <= 1), 'L11: scores en [0,1]');

  console.log(`\n📊 RAG: ${p} tests, ${p + f} total, ${f} failed`);
  process.exit(f > 0 ? 1 : 0);
}

main();