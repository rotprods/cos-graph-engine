// Tests de la capa de inteligencia (L10 embeddings + L7 GCN).
import { CosHub } from '../src/hub';
import { HubIntelligence } from '../src/intelligence';
import { MemoryStore } from '../src/store';
import { loadEcosystemData } from '../src/ecosystem';

let p = 0;
let f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

const sample = {
  nodes: [
    { id: 'R-aaa', label: 'aaa', type: 'repo', metadata: { url: 'https://x/aaa', description: 'agent orchestration tool', language: 'TypeScript' } },
    { id: 'R-bbb', label: 'bbb', type: 'repo', metadata: { url: 'https://x/bbb', description: 'agent orchestration pipeline', language: 'TypeScript' } },
    { id: 'R-ccc', label: 'ccc', type: 'repo', metadata: { url: 'https://x/ccc', description: 'molecular chemistry graph', language: 'Python' } },
    { id: 'R-ddd', label: 'ddd', type: 'repo', metadata: { url: 'https://x/ddd', description: 'social media growth', language: 'Rust' } },
  ],
  edges: [
    { id: 'e1', source: 'R-aaa', target: 'L13', weight: 1.0 },
    { id: 'e2', source: 'R-bbb', target: 'L13', weight: 1.0 },
    { id: 'e3', source: 'R-ccc', target: 'L19', weight: 1.0 },
    { id: 'e4', source: 'R-ddd', target: 'L17', weight: 1.0 },
  ],
};

function main() {
  const hub = new CosHub(new MemoryStore());
  hub.loadEcosystem(loadEcosystemData(sample));
  const ai = new HubIntelligence();

  const n = ai.build(hub);
  assert(n === 4, 'L10: 4 repos embebidos');

  // KNN crea edges
  assert(ai.embeddings.edges.length > 0, 'L10: KNN genera edges');

  // Clusters (k-means)
  const clusters = ai.clusters(3);
  const clusterIds = Object.keys(clusters);
  assert(clusterIds.length >= 1, 'L10: al menos 1 cluster');
  const allIds = Object.values(clusters).flat();
  assert(allIds.length === 4, 'L10: todos los repos en clusters');

  // Vecinos
  const nb = ai.neighbors('R-aaa');
  assert(nb.length > 0, 'L10: R-aaa tiene vecinos');

  // GCN roles
  const roles = ai.roles();
  assert(roles.length === 4, 'L7: 4 roles clasificados');
  const withConf = roles.filter(r => r.confidence >= 0 && r.confidence <= 1);
  assert(withConf.length === 4, 'L7: confianza en [0,1]');

  // Link prediction
  const pred = ai.predictLinks(hub, 5);
  assert(pred.every(l => l.from !== l.to && l.score > 0), 'L7: links predicen repos distintos con score>0');

  console.log(`\n📊 INTELIGENCIA: ${p} tests, ${p + f} total, ${f} failed`);
  process.exit(f > 0 ? 1 : 0);
}

main();