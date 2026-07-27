import { EntityId, RepresentationType } from '@cos/core';
import { generateId } from '@cos/core';

export interface EmbeddingVector {
  id: EntityId;
  vector: Float32Array;
  dimension: number;
  sourceId: EntityId;
  sourceType: string;
  model: string;
  createdAt: string;
}

export interface SimilarityResult {
  targetId: EntityId;
  score: number;
  sourceType: string;
}

export class EmbeddingSystem {
  private embeddings: Map<EntityId, EmbeddingVector> = new Map();
  private sourceIndex: Map<EntityId, EntityId> = new Map(); // sourceId -> embeddingId

  // Store an embedding
  async store(
    sourceId: EntityId,
    vector: Float32Array,
    sourceType: string,
    model: string = 'default',
  ): Promise<EntityId> {
    const id = generateId();
    const embedding: EmbeddingVector = {
      id,
      vector,
      dimension: vector.length,
      sourceId,
      sourceType,
      model,
      createdAt: new Date().toISOString(),
    };

    // Remove old embedding for this source
    const oldId = this.sourceIndex.get(sourceId);
    if (oldId) this.embeddings.delete(oldId);

    this.embeddings.set(id, embedding);
    this.sourceIndex.set(sourceId, id);

    return id;
  }

  // Get embedding by source ID
  async getBySource(sourceId: EntityId): Promise<EmbeddingVector | null> {
    const embeddingId = this.sourceIndex.get(sourceId);
    if (!embeddingId) return null;
    return this.embeddings.get(embeddingId) || null;
  }

  // Find most similar embeddings
  async search(
    queryVector: Float32Array,
    options: { limit?: number; threshold?: number; sourceType?: string } = {},
  ): Promise<SimilarityResult[]> {
    const limit = options.limit || 10;
    const threshold = options.threshold || 0.0;

    const results: SimilarityResult[] = [];

    for (const embedding of this.embeddings.values()) {
      if (options.sourceType && embedding.sourceType !== options.sourceType) continue;

      const score = this.cosineSimilarity(queryVector, embedding.vector);
      if (score >= threshold) {
        results.push({
          targetId: embedding.sourceId,
          score,
          sourceType: embedding.sourceType,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // Delete embedding
  async delete(sourceId: EntityId): Promise<void> {
    const embeddingId = this.sourceIndex.get(sourceId);
    if (embeddingId) {
      this.embeddings.delete(embeddingId);
      this.sourceIndex.delete(sourceId);
    }
  }

  // Calculate cosine similarity
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  // Simple text embedding (bag-of-words with TF weighting)
  // Production: replace with model-based embedding
  textToEmbedding(text: string, dimension: number = 128): Float32Array {
    const vector = new Float32Array(dimension);
    const words = text.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 2);

    for (const word of words) {
      const hash = this.hashString(word);
      const index = hash % dimension;
      vector[index] += 1.0;
    }

    // Normalize
    let magnitude = 0;
    for (let i = 0; i < dimension; i++) magnitude += vector[i] * vector[i];
    magnitude = Math.sqrt(magnitude);
    if (magnitude > 0) {
      for (let i = 0; i < dimension; i++) vector[i] /= magnitude;
    }

    return vector;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  get stats() {
    return {
      totalEmbeddings: this.embeddings.size,
      totalSources: this.sourceIndex.size,
    };
  }
}