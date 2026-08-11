// Capa GraphRAG (L11) sobre el ecosistema: indexa cada repo como chunk de texto
// con embeddings TF-IDF reales sobre el vocabulario de descripciones, y permite
// consulta semántica ("¿qué repos son de orquestación de agentes?").
import { GraphRAGEngine } from '@cos/graph';
import { CosHub } from './hub';

const STOPWORDS = new Set([
  // español
  'el', 'la', 'los', 'las', 'de', 'del', 'para', 'por', 'con', 'sin', 'y', 'o', 'a', 'en', 'que',
  'es', 'un', 'una', 'al', 'como', 'su', 'sus', 'se', 'lo', 'mas', 'más', 'este', 'esta', 'todo',
  // inglés
  'the', 'of', 'and', 'to', 'for', 'in', 'on', 'a', 'an', 'with', 'from', 'at', 'is', 'are',
  'was', 'were', 'be', 'this', 'that', 'it', 'its', 'as', 'by', 'or', 'not', 'no', 'all', 'into',
]);

/** Normaliza tokens: minúsculas + sin diacríticos (para emparejar orquestación/orquestacion). */
export function normalizeToken(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9ñ]+/i)
    .map(normalizeToken)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

/** Vectorizador TF-IDF sobre el corpus de textos de repos (vocabulario real). */
export class TfidfVectorizer {
  private vocab = new Map<string, number>();
  private idf: number[] = [];
  private nDocs = 0;

  /** Ajusta el vocabulario e IDF sobre el corpus. */
  fit(docs: string[]): void {
    const df = new Map<string, number>();
    for (const d of docs) {
      const terms = new Set(tokenize(d));
      for (const t of terms) df.set(t, (df.get(t) || 0) + 1);
    }
    this.nDocs = docs.length;
    const terms = [...df.keys()].sort();
    terms.forEach((t, i) => this.vocab.set(t, i));
    // IDF suavizado: log((1+N)/(1+df)) + 1
    this.idf = terms.map(t => Math.log((1 + this.nDocs) / (1 + (df.get(t) || 0))) + 1);
  }

  get dim(): number {
    return this.idf.length;
  }

  /** Embedding TF-IDF de un texto (tf normalizada × idf). */
  transform(text: string): number[] {
    const vec = new Array(this.idf.length).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return vec;
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [t, count] of tf) {
      const idx = this.vocab.get(t);
      if (idx !== undefined) vec[idx] = (count / tokens.length) * this.idf[idx];
    }
    return vec;
  }
}

/** Nombre de cada nivel del engine (para enriquecer el texto del chunk). */
const DIM_NAMES: Record<string, string> = {
  L0: 'Visual', L1: 'Execution', L2: 'State', L3: 'Dependency', L4: 'Call', L5: 'CFG',
  L6: 'DataFlow', L7: 'Compute', L8: 'Knowledge', L9: 'Semantic', L10: 'Embedding',
  L11: 'GraphRAG', L12: 'Memory', L13: 'Agent', L14: 'Tool', L15: 'Workflow',
  L16: 'Network', L17: 'Social', L18: 'Biological', L19: 'Molecular',
};

export interface RAGHit {
  repo: string;
  score: number;
  text: string;
}

export class HubRAG {
  readonly rag = new GraphRAGEngine(); // L11
  private readonly repoByChunk = new Map<string, string>();
  private readonly vectorizer = new TfidfVectorizer();

  /** Indexa los repos del hub como chunks TF-IDF (nombre + descripción + lenguaje + dimensiones). */
  build(hub: CosHub): number {
    const chunks: Array<{ id: string; text: string; repoId: string; dims: string[] }> = [];
    for (const e of hub.kg.entities) {
      if (e.type !== 'repo') continue;
      const meta = hub.getRepoMeta(e.id);
      const dims = hub.kg.relations.filter(r => r.source === e.id && r.target.startsWith('L')).map(r => r.target);
      const lang = typeof meta['language'] === 'string' ? (meta['language'] as string) : '';
      const desc = typeof meta['description'] === 'string' ? (meta['description'] as string) : '';
      const dimText = dims.map(d => `${d} ${DIM_NAMES[d] || d}`).join(', ');
      const text = `${e.name}. ${desc} Language: ${lang}. Dimensions: ${dimText}.`;
      chunks.push({ id: `chunk-${e.id}`, text, repoId: e.id, dims });
    }
    this.vectorizer.fit(chunks.map(c => c.text));
    for (const c of chunks) {
      this.rag.addChunk({ id: c.id, text: c.text, source: c.repoId, embedding: this.vectorizer.transform(c.text), entities: c.dims });
      this.repoByChunk.set(c.id, c.repoId);
    }
    for (const e of hub.kg.entities) {
      if (e.type === 'dimension') this.rag.addEntity(e.id, e.name);
    }
    return chunks.length;
  }

  /** Consulta semántica: recupera los repos más relevantes para `query` (TF-IDF + re-rank por entidades). */
  search(query: string, queryEntities: string[] = [], topK = 6): RAGHit[] {
    const qe = this.vectorizer.transform(query);
    const res = this.rag.retrieve(qe, queryEntities);
    return res.chunks.slice(0, topK).map(c => {
      const score = Math.round(GraphRAGEngine.cosineSim(c.embedding, qe) * 1000) / 1000;
      return { repo: this.repoByChunk.get(c.id) || c.source, score, text: c.text };
    });
  }
}