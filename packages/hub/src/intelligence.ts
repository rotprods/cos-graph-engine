// Capa de inteligencia del hub (Tier 3): L10 embeddings + k-means,
// L7 GCN (clasificación de roles + predicción de links).
import { EmbeddingGraph, GCN } from '@cos/graph';
import { CosHub } from './hub';

export interface RepoIntelligence {
  nodeId: string;
  label: string;
  role: number;
  confidence: number;
  cluster: number;
  neighbors: string[];
}

export interface LinkPrediction {
  from: string;
  to: string;
  score: number;
}

export class HubIntelligence {
  readonly embeddings = new EmbeddingGraph(); // L10
  private readonly gcn = new GCN();            // L7
  private langIndex: string[] = [];
  private readonly vectorLen = 20 + 40 + 30;   // dims(20) + langs(40) + desc hash(30)

  /** Construye embeddings (feature vector por repo) + KNN. Devuelve nº de repos. */
  build(hub: CosHub): number {
    const repos = hub.kg.entities.filter(e => e.type === 'repo');
    const langs = new Set<string>();
    for (const e of repos) {
      const l = hub.getRepoMeta(e.id)['language'];
      if (typeof l === 'string' && l) langs.add(l);
    }
    this.langIndex = [...langs].sort().slice(0, 40);

    for (const e of repos) {
      const meta = hub.getRepoMeta(e.id);
      const vec = new Array(this.vectorLen).fill(0);
      // dimensiones (L0-L19)
      for (const r of hub.kg.relations) {
        if (r.source === e.id && r.target.startsWith('L')) {
          const idx = parseInt(r.target.slice(1), 10);
          if (idx >= 0 && idx < 20) vec[idx] = 1;
        }
      }
      // lenguaje (one-hot)
      const lang = meta['language'];
      if (typeof lang === 'string' && lang) {
        const li = this.langIndex.indexOf(lang);
        if (li >= 0) vec[20 + li] = 1;
      }
      // descripción (bag-of-chars hash)
      const desc = typeof meta['description'] === 'string' ? (meta['description'] as string) : '';
      const base = 20 + this.langIndex.length;
      for (let i = 0; i < desc.length; i++) {
        vec[base + (desc.charCodeAt(i) % 30)] += 0.1;
      }
      this.embeddings.addNode({ id: e.id, label: e.name, vector: vec });
    }
    this.embeddings.buildKNN(5);
    return repos.length;
  }

  /** Clusters k-means sobre los embeddings (L10). */
  clusters(k = 6): Record<number, string[]> {
    const out: Record<number, string[]> = {};
    for (const [cid, nodes] of this.embeddings.cluster(k)) {
      out[cid] = nodes.map(n => n.id);
    }
    return out;
  }

  /** Vecinos más cercanos de un repo (L10 KNN). */
  neighbors(repoId: string): string[] {
    return this.embeddings.edges.filter(e => e.source === repoId).map(e => e.target);
  }

  /** Clasificación de rol por nodo (L7 GCN) + cluster + vecinos. */
  roles(): RepoIntelligence[] {
    const classRes = this.gcn.classifyNodesEmbedding(this.embeddings);
    const clusters = this.clusters(6);
    const clusterOf: Record<string, number> = {};
    for (const [cid, ids] of Object.entries(clusters)) for (const id of ids) clusterOf[id] = Number(cid);
    return classRes.map(c => ({
      nodeId: c.nodeId,
      label: c.label,
      role: c.predictedClass,
      confidence: c.confidence,
      cluster: clusterOf[c.nodeId] ?? -1,
      neighbors: this.neighbors(c.nodeId),
    }));
  }

  /** Predicción de links (L7): repos parecidos pero sin dimensión compartida. */
  predictLinks(hub: CosHub, topN = 10): LinkPrediction[] {
    const nodes = this.embeddings.nodes.slice().sort((a, b) => a.id.localeCompare(b.id));
    const n = nodes.length;
    if (n === 0) return [];
    const features = nodes.map(nd => {
      const p = new Array(5).fill(0);
      for (let i = 0; i < Math.min(nd.vector.length, 5); i++) p[i] = nd.vector[i];
      p.push(nd.clusterId !== undefined ? nd.clusterId / 10 : 0);
      return p;
    });
    const adj = Array.from({ length: n }, () => new Array(n).fill(0));
    const dimsOf = (id: string): Set<string> => {
      const s = new Set<string>();
      for (const r of hub.kg.relations) if (r.source === id && r.target.startsWith('L')) s.add(r.target);
      return s;
    };
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const sa = dimsOf(nodes[a].id);
        for (const t of dimsOf(nodes[b].id)) { if (sa.has(t)) { adj[a][b] = 1; adj[b][a] = 1; break; } }
      }
    }
    const res = this.gcn.predictLinks(features, adj)
      .filter(r => r.isPredicted)
      .slice(0, topN);
    return res.map(r => {
      const i = parseInt(r.source.replace('node_', ''), 10);
      const j = parseInt(r.target.replace('node_', ''), 10);
      return { from: nodes[i].id, to: nodes[j].id, score: Math.round(r.score * 1000) / 1000 };
    });
  }
}