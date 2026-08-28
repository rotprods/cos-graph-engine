import type {
  Chunk,
  GraphRAGEntity,
  GraphRAGRelation,
} from './level11-graphrag';
import type { AuthorityGraphRAGIndex } from './authority-graphrag-index';

/**
 * Read-only compatibility snapshot for legacy GraphRAG consumers.
 *
 * This is intentionally a data projection, not a GraphRAGEngine adapter. It
 * exposes no mutation method and every value is deep-copied from the authority
 * index snapshot. Legacy callers can inspect/visualize data without becoming a
 * second authority writer.
 */
export interface LegacyGraphRAGReadSnapshot {
  projectionVersion: number;
  projectionHash: string;
  entities: GraphRAGEntity[];
  relations: GraphRAGRelation[];
  chunks: Chunk[];
}

export function authorityGraphToLegacyReadSnapshot(
  index: AuthorityGraphRAGIndex,
): LegacyGraphRAGReadSnapshot {
  const snapshot = index.snapshot();
  return {
    projectionVersion: snapshot.version,
    projectionHash: snapshot.projectionHash,
    entities: snapshot.entities.map(entity => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      projectId: entity.projectId,
      sensitivity: entity.sensitivity,
    })),
    relations: snapshot.relations.map(relation => ({
      id: relation.id,
      source: relation.source,
      target: relation.target,
      type: relation.type,
      projectId: relation.projectId,
      sensitivity: relation.sensitivity,
      provenanceRef: relation.provenanceRef,
    })),
    chunks: snapshot.chunks.map(chunk => ({
      id: chunk.id,
      text: chunk.text,
      source: chunk.source,
      embedding: [...chunk.embedding],
      entities: [...chunk.entities],
      projectId: chunk.projectId,
      sensitivity: chunk.sensitivity,
      provenanceRef: chunk.provenanceRef,
      authority: chunk.authority,
      validFrom: chunk.validFrom,
      validUntil: chunk.validUntil,
      recordedAt: chunk.recordedAt,
    })),
  };
}
