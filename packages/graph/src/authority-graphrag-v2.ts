import type { RetrievalSensitivity } from './level11-graphrag';
import {
  AuthorityGraphRAGEngine,
  type AuthorityGraphRAGRelation,
  type AuthorityRelationInput,
} from './authority-graphrag';

const SENSITIVITY_ORDER: Record<RetrievalSensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

/**
 * Authority facade that closes two migration hazards in the v1 projection:
 *
 * 1. Relation sensitivity is derived from endpoints before relation identity is
 *    computed, so replay/validation cannot disagree when callers omit it.
 * 2. `recordedAt` is mandatory. Authority projection must never use wall-clock
 *    time implicitly because a replay on another machine must reproduce the
 *    exact same relation representation.
 *
 * The base implementation stays available for compatibility until W13 proves
 * the cutover and legacy consumers can be migrated safely.
 */
export class VerifiedAuthorityGraphRAGEngine extends AuthorityGraphRAGEngine {
  override addRelation(input: AuthorityRelationInput): AuthorityGraphRAGRelation {
    const recordedAt = input.recordedAt?.trim();
    if (!recordedAt) {
      throw new Error('AUTHORITY_RELATION_RECORDED_AT_REQUIRED');
    }
    if (!Number.isFinite(Date.parse(recordedAt))) {
      throw new Error(`Invalid authority relation recordedAt: ${recordedAt}`);
    }

    const source = this.getEntity(input.source);
    const target = this.getEntity(input.target);
    if (!source) throw new Error(`Relation source ${input.source} not found`);
    if (!target) throw new Error(`Relation target ${input.target} not found`);

    const sensitivity = input.sensitivity || maxSensitivity(
      source.sensitivity || 'internal',
      target.sensitivity || 'internal',
    );

    return super.addRelation({
      ...input,
      sensitivity,
      recordedAt: new Date(recordedAt).toISOString(),
    });
  }
}

function maxSensitivity(
  left: RetrievalSensitivity,
  right: RetrievalSensitivity,
): RetrievalSensitivity {
  return SENSITIVITY_ORDER[left] >= SENSITIVITY_ORDER[right] ? left : right;
}
