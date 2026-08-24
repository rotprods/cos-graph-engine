import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type ResilienceNodeType =
  | 'failure_mode'
  | 'latent_condition'
  | 'defense'
  | 'near_miss'
  | 'incident'
  | 'degraded_state'
  | 'recovery_path'
  | 'adaptation'
  | 'change_risk';

export type ResilienceRelationType =
  | 'contributes_to'
  | 'masked_by'
  | 'defended_by'
  | 'bypasses'
  | 'degrades'
  | 'recovers_via'
  | 'adapted_by'
  | 'amplifies'
  | 'couples_with'
  | 'precedes'
  | 'near_miss_of'
  | 'introduced_by_change'
  | 'mitigates';

export interface ResilienceNode {
  id: EntityId;
  type: ResilienceNodeType;
  title: string;
  description: string;
  projectId?: string;
  severity: number;
  likelihood: number;
  detectability: number;
  status: 'active' | 'mitigated' | 'resolved' | 'observed';
  sourceRef: string;
  createdAt: Timestamp;
  metadata: Record<string, string | number | boolean | null>;
}

export interface ResilienceRelation {
  id: EntityId;
  type: ResilienceRelationType;
  from: EntityId;
  to: EntityId;
  confidence: number;
  sourceRef: string;
  createdAt: Timestamp;
}

export interface ChangeRiskAssessment {
  changeId: EntityId;
  removedFailureModes: ResilienceNode[];
  introducedConditions: ResilienceNode[];
  defenses: ResilienceNode[];
  nearMissSignals: ResilienceNode[];
  recoveryPaths: ResilienceNode[];
  coupledNodes: ResilienceNode[];
  blastRadius: ResilienceNode[];
  riskScore: number;
  warnings: string[];
}

/**
 * Runtime model for Cook-style complex-system reasoning.
 *
 * It intentionally does not expose a `rootCause` field. Incidents and changes
 * are represented as interacting conditions/defenses/couplings so callers are
 * structurally discouraged from collapsing systemic failure into one cause.
 */
export class ResilienceRegistry {
  private nodes = new Map<EntityId, ResilienceNode>();
  private relations = new Map<EntityId, ResilienceRelation>();
  private outgoing = new Map<EntityId, Set<EntityId>>();
  private incoming = new Map<EntityId, Set<EntityId>>();

  addNode(input: Omit<ResilienceNode, 'id' | 'createdAt'> & { id?: EntityId; createdAt?: Timestamp }): EntityId {
    this.assertProbabilityLike(input.severity, 'severity');
    this.assertProbabilityLike(input.likelihood, 'likelihood');
    this.assertProbabilityLike(input.detectability, 'detectability');
    if (!input.sourceRef.trim()) throw new Error('Resilience evidence requires sourceRef');

    const id = input.id || generateId();
    if (this.nodes.has(id)) throw new Error(`Resilience node ${String(id)} already exists`);
    this.nodes.set(id, {
      ...input,
      id,
      title: input.title.trim(),
      description: input.description.trim(),
      createdAt: input.createdAt || new Date().toISOString(),
      metadata: { ...input.metadata },
    });
    return id;
  }

  addRelation(input: Omit<ResilienceRelation, 'id' | 'createdAt'> & { id?: EntityId; createdAt?: Timestamp }): EntityId {
    if (!this.nodes.has(input.from) || !this.nodes.has(input.to)) throw new Error('Resilience relation cannot reference a missing node');
    this.assertProbabilityLike(input.confidence, 'confidence');
    if (!input.sourceRef.trim()) throw new Error('Resilience relation requires sourceRef');

    const id = input.id || generateId();
    if (this.relations.has(id)) throw new Error(`Resilience relation ${String(id)} already exists`);
    const relation: ResilienceRelation = {
      ...input,
      id,
      createdAt: input.createdAt || new Date().toISOString(),
    };
    this.relations.set(id, relation);
    this.index(this.outgoing, relation.from, id);
    this.index(this.incoming, relation.to, id);
    return id;
  }

  getNode(id: EntityId): ResilienceNode | null {
    const node = this.nodes.get(id);
    return node ? { ...node, metadata: { ...node.metadata } } : null;
  }

  listNearMisses(projectId?: string): ResilienceNode[] {
    return Array.from(this.nodes.values())
      .filter(node => node.type === 'near_miss' && (!projectId || node.projectId === projectId))
      .map(node => ({ ...node, metadata: { ...node.metadata } }));
  }

  blastRadius(start: EntityId, maxDepth = 3): ResilienceNode[] {
    if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 8) throw new Error('blastRadius maxDepth must be 0..8');
    if (!this.nodes.has(start)) return [];

    const relevant = new Set<ResilienceRelationType>([
      'contributes_to', 'degrades', 'amplifies', 'couples_with',
      'introduced_by_change', 'mitigates', 'bypasses',
    ]);
    const seen = new Set<EntityId>([start]);
    const queue: Array<{ id: EntityId; depth: number }> = [{ id: start, depth: 0 }];

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current.depth >= maxDepth) continue;
      for (const relation of this.adjacentRelations(current.id)) {
        if (!relevant.has(relation.type)) continue;
        const next = relation.from === current.id ? relation.to : relation.from;
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push({ id: next, depth: current.depth + 1 });
      }
    }

    seen.delete(start);
    return Array.from(seen, id => this.nodes.get(id)!).map(node => ({ ...node, metadata: { ...node.metadata } }));
  }

  assessChange(changeId: EntityId): ChangeRiskAssessment {
    const change = this.nodes.get(changeId);
    if (!change || change.type !== 'change_risk') throw new Error(`ChangeRisk node ${String(changeId)} not found`);

    const adjacent = this.adjacentRelations(changeId);
    const nodesFor = (types: ResilienceRelationType[], nodeTypes?: ResilienceNodeType[]) => {
      const result = new Map<EntityId, ResilienceNode>();
      for (const relation of adjacent) {
        if (!types.includes(relation.type)) continue;
        const id = relation.from === changeId ? relation.to : relation.from;
        const node = this.nodes.get(id);
        if (!node || (nodeTypes && !nodeTypes.includes(node.type))) continue;
        result.set(id, node);
      }
      return Array.from(result.values()).map(node => ({ ...node, metadata: { ...node.metadata } }));
    };

    const removedFailureModes = nodesFor(['mitigates'], ['failure_mode']);
    const introducedConditions = nodesFor(['introduced_by_change'], ['latent_condition', 'failure_mode', 'degraded_state']);
    const defenses = nodesFor(['defended_by'], ['defense']);
    const nearMissSignals = nodesFor(['near_miss_of'], ['near_miss']);
    const recoveryPaths = nodesFor(['recovers_via'], ['recovery_path']);
    const coupledNodes = nodesFor(['couples_with', 'amplifies']);
    const blastRadius = this.blastRadius(changeId, 3);

    const exposed = [...introducedConditions, ...coupledNodes];
    const rawRisk = exposed.reduce(
      (sum, node) => sum + node.severity * node.likelihood * (1 - node.detectability),
      0,
    );
    const defenseCredit = Math.min(0.5, defenses.length * 0.08 + recoveryPaths.length * 0.05);
    const riskScore = Math.max(0, Math.min(1, rawRisk / Math.max(1, exposed.length) - defenseCredit));

    const warnings: string[] = [];
    if (introducedConditions.length === 0) warnings.push('No introduced failure conditions are modeled; assessment may be incomplete');
    if (defenses.length === 0) warnings.push('No explicit defense is attached to this change');
    if (recoveryPaths.length === 0) warnings.push('No recovery path is attached to this change');
    if (nearMissSignals.length === 0) warnings.push('No near-miss signal is defined for early warning');

    return {
      changeId,
      removedFailureModes,
      introducedConditions,
      defenses,
      nearMissSignals,
      recoveryPaths,
      coupledNodes,
      blastRadius,
      riskScore,
      warnings,
    };
  }

  private adjacentRelations(id: EntityId): ResilienceRelation[] {
    const ids = new Set<EntityId>([...(this.outgoing.get(id) || []), ...(this.incoming.get(id) || [])]);
    return Array.from(ids, relationId => this.relations.get(relationId)!).filter(Boolean);
  }

  private index(index: Map<EntityId, Set<EntityId>>, key: EntityId, value: EntityId): void {
    let bucket = index.get(key);
    if (!bucket) {
      bucket = new Set();
      index.set(key, bucket);
    }
    bucket.add(value);
  }

  private assertProbabilityLike(value: number, name: string): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be in [0,1]`);
  }
}
