// Capa GraphRAG (L11) sobre el ecosistema: indexa cada repo como chunk de texto
// y permite consulta semántica ("¿qué repos son de orquestación de agentes?").
import { GraphRAGEngine } from '@cos/graph';
import { CosHub } from './hub';

/** Embedding de texto por bag-of-characters hashed (consistent bias entre index y query). */
export function hashTextEmbedding(text: string, dim = 96): number[] {
  const vec = new Array(dim).fill(0);
  const s = text.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    vec[c % dim] += 1;
    if (i + 1 < s.length) vec[(c * 31 + s.charCodeAt(i + 1)) % dim] += 1;
  }
  return vec;
}

export interface RAGHit {
  repo: string;
  score: number;
  text: string;
}

export class HubRAG {
  readonly rag = new GraphRAGEngine(); // L11
  private readonly repoByChunk = new Map<string, string>();

  /** Indexa los repos del hub como chunks (nombre + descripción + lenguaje + dimensiones). */
  build(hub: CosHub): number {
    let n = 0;
    for (const e of hub.kg.entities) {
      if (e.type !== 'repo') continue;
      const meta = hub.getRepoMeta(e.id);
      const dims = hub.kg.relations.filter(r => r.source === e.id && r.target.startsWith('L')).map(r => r.target);
      const lang = typeof meta['language'] === 'string' ? (meta['language'] as string) : '';
      const desc = typeof meta['description'] === 'string' ? (meta['description'] as string) : '';
      const text = `${e.name}. ${desc} Language: ${lang}. Dimensions: ${dims.join(', ')}.`;
      const chunkId = `chunk-${e.id}`;
      this.rag.addChunk({ id: chunkId, text, source: e.id, embedding: hashTextEmbedding(text), entities: dims });
      this.repoByChunk.set(chunkId, e.id);
      n++;
    }
    for (const e of hub.kg.entities) {
      if (e.type === 'dimension') this.rag.addEntity(e.id, e.name);
    }
    return n;
  }

  /** Consulta semántica: recupera los repos más relevantes para `query`. */
  search(query: string, queryEntities: string[] = [], topK = 6): RAGHit[] {
    const qe = hashTextEmbedding(query);
    const res = this.rag.retrieve(qe, queryEntities);
    return res.chunks.slice(0, topK).map(c => {
      const score = Math.round(GraphRAGEngine.cosineSim(c.embedding, qe) * 1000) / 1000;
      return { repo: this.repoByChunk.get(c.id) || c.source, score, text: c.text };
    });
  }
}