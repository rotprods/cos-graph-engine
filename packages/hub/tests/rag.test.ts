// Tests de la capa GraphRAG (L11) con embeddings TF-IDF reales.
import { CosHub } from '../src/hub';
import { HubRAG, TfidfVectorizer, tokenize, normalizeToken } from '../src/rag';
import { MemoryStore } from '../src/store';
import { loadEcosystemData } from '../src/ecosystem';

let p = 0;
let f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

// Repo molecular (L19) y repo de orquestación (L13) para probar los ejemplos del usuario.
const sample = {
  nodes: [
    { id: 'R-agents', label: 'agents', type: 'repo', metadata: { url: 'https://x/agents', description: 'orquestación y delegación de agentes', language: 'TypeScript' } },
    { id: 'R-mol', label: 'mol', type: 'repo', metadata: { url: 'https://x/mol', description: 'molecular chemistry and drug discovery', language: 'Python' } },
    { id: 'R-social', label: 'social', type: 'repo', metadata: { url: 'https://x/social', description: 'social media growth and audience', language: 'Rust' } },
    { id: 'R-video', label: 'video', type: 'repo', metadata: { url: 'https://x/video', description: 'video editor con ffmpeg', language: 'JavaScript' } },
  ],
  edges: [
    { id: 'e1', source: 'R-agents', target: 'L13', weight: 1.0 },
    { id: 'e2', source: 'R-mol', target: 'L19', weight: 1.0 },
    { id: 'e3', source: 'R-social', target: 'L17', weight: 1.0 },
    { id: 'e4', source: 'R-video', target: 'L0', weight: 1.0 },
  ],
};

function main() {
  // --- TF-IDF vectorizer ---
  const vec = new TfidfVectorizer();
  vec.fit(['agente de orquestación', 'motor de video y edición', 'descubrimiento molecular']);
  assert(vec.dim > 0, 'TF-IDF: vocabulario no vacío');
  const q1 = vec.transform('orquestación');
  const q2 = vec.transform('molecular');
  assert(q1.length === vec.dim && q2.length === vec.dim, 'TF-IDF: transform produce vector del tamaño del vocabulario');
  // normalización de diacríticos: orquestación == orquestacion
  assert(normalizeToken('Orquestación') === 'orquestacion', 'TF-IDF: diacríticos normalizados');
  // tokenize quita stopwords
  assert(!tokenize('el de la orquestación').includes('el'), 'TF-IDF: stopwords eliminadas');

  // --- HubRAG sobre el ecosistema de ejemplo ---
  const hub = new CosHub(new MemoryStore());
  hub.loadEcosystem(loadEcosystemData(sample));
  const rag = new HubRAG();

  const n = rag.build(hub);
  assert(n === 4, 'L11: 4 repos indexados como chunks');

  // 'orquestación' (con tilde) debe devolver el repo de agentes (L13)
  const orqHits = rag.search('orquestación');
  assert(orqHits.length >= 1, 'L11: query orquestación devuelve resultados');
  assert(orqHits[0].repo === 'R-agents', `L11: orquestación -> R-agents (got ${orqHits[0].repo})`);

  // 'molecular' debe devolver el repo molecular (L19) incluso sin descripción que lo mencione
  // (enriquecido por el nombre de dimensión "L19 Molecular")
  const molHits = rag.search('molecular');
  assert(molHits.length >= 1, 'L11: query molecular devuelve resultados');
  assert(molHits[0].repo === 'R-mol', `L11: molecular -> R-mol (got ${molHits[0].repo})`);

  // 'video' -> repo de video
  const vidHits = rag.search('video editor');
  assert(vidHits[0].repo === 'R-video', `L11: video -> R-video (got ${vidHits[0].repo})`);

  // 'social' -> repo social
  const socHits = rag.search('social media');
  assert(socHits[0].repo === 'R-social', `L11: social -> R-social (got ${socHits[0].repo})`);

  // Scores en [0,1]
  assert(orqHits.every(h => h.score >= 0 && h.score <= 1), 'L11: scores en [0,1]');

  console.log(`\n📊 RAG TF-IDF: ${p} tests, ${p + f} total, ${f} failed`);
  process.exit(f > 0 ? 1 : 0);
}

main();