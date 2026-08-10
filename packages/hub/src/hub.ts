// CosHub — runtime del grafo del ecosistema ROT sobre el engine de 20 niveles.
// Capas: L8 Knowledge (master), L2 State (FSM por repo), L13 Agent, L15 Workflow,
// realtime via GraphStream (L-streaming).
import {
  KnowledgeGraphEngine,
  StateMachine,
  AgentGraphEngine,
  WorkflowGraphEngine,
  GraphStream,
  GraphPatch,
} from '@cos/graph';
import { EcosystemGraph } from './ecosystem';
import { Store, HubSnapshot } from './store';

export type RepoState = 'PENDING' | 'DEV' | 'LIVE' | 'BLOCKED' | 'DEAD';
export type RepoEvent = 'init' | 'deploy' | 'change' | 'fail' | 'unblock' | 'archive';

const REPO_STATES: RepoState[] = ['PENDING', 'DEV', 'LIVE', 'BLOCKED', 'DEAD'];
const REPO_TRANSITIONS: Array<{ from: RepoState; to: RepoState; event: RepoEvent }> = [
  { from: 'PENDING', to: 'DEV', event: 'init' },
  { from: 'DEV', to: 'LIVE', event: 'deploy' },
  { from: 'LIVE', to: 'DEV', event: 'change' },
  { from: 'DEV', to: 'BLOCKED', event: 'fail' },
  { from: 'LIVE', to: 'BLOCKED', event: 'fail' },
  { from: 'BLOCKED', to: 'DEV', event: 'unblock' },
  { from: 'LIVE', to: 'DEAD', event: 'archive' },
  { from: 'DEV', to: 'DEAD', event: 'archive' },
];

export interface LoadStats {
  repos: number;
  dimensions: number;
  relations: number;
}

export class CosHub {
  readonly kg = new KnowledgeGraphEngine();          // L8
  readonly agents = new AgentGraphEngine();          // L13
  readonly workflows = new WorkflowGraphEngine();    // L15
  readonly stream = new GraphStream();               // realtime
  private states = new Map<string, StateMachine>();  // L2 por repo
  private repoMeta = new Map<string, Record<string, unknown>>();

  constructor(private readonly store?: Store) {}

  loadEcosystem(g: EcosystemGraph): LoadStats {
    const dimIds = new Set<string>();
    for (const e of g.edges) {
      if (e.target.startsWith('L')) dimIds.add(e.target);
      if (e.source.startsWith('L')) dimIds.add(e.source);
    }
    for (const d of dimIds) {
      if (!this.kg.getEntity(d)) {
        this.kg.addEntity({ id: d, name: d, type: 'dimension' });
      }
    }
    let repos = 0;
    for (const n of g.nodes) {
      if (n.type !== 'repo') continue;
      const meta = n.metadata || {};
      if (!this.kg.getEntity(n.id)) {
        this.kg.addEntity({
          id: n.id,
          name: n.label,
          type: 'repo',
          description: typeof meta.description === 'string' ? meta.description : '',
          aliases: typeof meta.url === 'string' ? [meta.url] : [],
        });
      }
      this.repoMeta.set(n.id, meta);
      if (!this.states.has(n.id)) {
        this.states.set(
          n.id,
          new StateMachine(
            n.label,
            REPO_STATES.map(s => ({ id: s, label: s })),
            REPO_TRANSITIONS,
            'PENDING',
          ),
        );
      }
      repos++;
    }
    let relations = 0;
    for (const e of g.edges) {
      if (e.source.startsWith('R-') && e.target.startsWith('L') && !this.kg.getRelation(e.id)) {
        this.kg.addRelation({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'in_dimension',
          confidence: typeof e.weight === 'number' ? e.weight : 1,
        });
        relations++;
      }
    }
    this.emit('ecosystem_loaded', { repos, dimensions: dimIds.size, relations });
    return { repos, dimensions: dimIds.size, relations };
  }

  async setRepoState(repoId: string, event: RepoEvent): Promise<boolean> {
    const sm = this.states.get(repoId);
    if (!sm) return false;
    const ok = await sm.send(event);
    if (ok) this.emit('repo_state', { repo: repoId, event, state: sm.state });
    return ok;
  }

  getRepoState(repoId: string): RepoState | null {
    return (this.states.get(repoId)?.state as RepoState) || null;
  }

  getRepoMeta(repoId: string): Record<string, unknown> {
    return this.repoMeta.get(repoId) || {};
  }

  reposInDimension(dim: string): string[] {
    return this.kg.entities
      .filter(e => e.type === 'repo')
      .map(e => e.id)
      .filter(id => this.kg.relations.some(r => r.source === id && r.target === dim));
  }

  repoCountByState(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const sm of this.states.values()) {
      const s = sm.state as string;
      out[s] = (out[s] || 0) + 1;
    }
    return out;
  }

  seedAgents(): void {
    const chief = this.agents.addNode({ name: 'Chief', role: 'ceo', capabilities: ['planning', 'oversight'], tools: [], memoryIds: [], confidence: 0.95 });
    const researcher = this.agents.addNode({ name: 'Researcher', role: 'researcher', capabilities: ['analysis', 'search'], tools: [], memoryIds: [], confidence: 0.85 });
    const maintainer = this.agents.addNode({ name: 'Maintainer', role: 'developer', capabilities: ['code', 'refactor'], tools: [], memoryIds: [], confidence: 0.88 });
    this.agents.addEdge(chief, researcher, 'delegates_to', 8);
    this.agents.addEdge(chief, maintainer, 'delegates_to', 9);
    this.emit('agents_seeded', { count: this.agents.getNodes().length });
  }

  seedWorkflow(name: string, steps: Array<{ name: string; type: string; service?: string }>): void {
    let prev: string | null = null;
    for (const s of steps) {
      const id = this.workflows.addNode({ name: s.name, type: s.type as never, service: s.service });
      if (prev) this.workflows.addEdge(prev, id, 'on_success');
      prev = id;
    }
    this.emit('workflow_seeded', { name, steps: steps.length });
  }

  /** Publica un parche en el stream (realtime) y lo distribuye a suscriptores. */
  private emit(type: string, data: Record<string, unknown>): void {
    const patch: GraphPatch = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: type as GraphPatch['type'],
      level: 8,
      graphId: 'cos-ecosystem',
      data,
      timestamp: Date.now(),
    };
    this.stream.sendPatch(patch);
  }

  snapshot(): HubSnapshot {
    const repoStates: Record<string, string> = {};
    for (const [id, sm] of this.states.entries()) repoStates[id] = sm.state as string;
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      graph: { entities: this.kg.entities, relations: this.kg.relations },
      repoStates,
      agentIds: this.agents.getNodes().map(n => (n as { id: string }).id),
      workflowIds: this.workflows.getNodes().map(n => (n as { id: string }).id),
    };
  }

  persist(): void {
    if (this.store) this.store.save(this.snapshot());
  }
}