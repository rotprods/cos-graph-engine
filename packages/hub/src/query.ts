// Query facade sobre el hub (subconjunto estilo Cypher + grafos por dimensión).
import { CosHub } from './hub';

export interface RepoRow {
  id: string;
  name: string;
  state: string;
  dimensions: string[];
  url?: string;
}

export class HubQueries {
  constructor(private readonly hub: CosHub) {}

  /** Repos que pertenecen a una dimensión (MATCH (r:repo)-[:in_dimension]->(d:L{n})). */
  byDimension(dim: string): RepoRow[] {
    return this.hub.reposInDimension(dim).map(id => this.row(id));
  }

  /** Todos los repos con su estado y dimensiones. */
  all(): RepoRow[] {
    return this.hub.kg.entities
      .filter(e => e.type === 'repo')
      .map(e => this.row(e.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  row(id: string): RepoRow {
    const e = this.hub.kg.getEntity(id);
    const dims = this.hub.kg.relations.filter(r => r.source === id && r.target.startsWith('L')).map(r => r.target);
    const meta = this.hub.getRepoMeta(id);
    return {
      id,
      name: e?.name || id,
      state: this.hub.getRepoState(id) || 'PENDING',
      dimensions: dims,
      url: typeof meta['url'] === 'string' ? (meta['url'] as string) : undefined,
    };
  }

  /** Conteo de repos por dimensión (para la cobertura del ecosistema). */
  dimensionCoverage(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.hub.kg.entities) {
      if (e.type !== 'repo') continue;
      for (const r of this.hub.kg.relations) {
        if (r.source === e.id && r.target.startsWith('L')) out[r.target] = (out[r.target] || 0) + 1;
      }
    }
    return out;
  }

  /** Resumen general del ecosistema. */
  summary(): { repos: number; dimensions: number; relations: number; byState: Record<string, number> } {
    return {
      repos: this.hub.kg.entities.filter(e => e.type === 'repo').length,
      dimensions: this.hub.kg.entities.filter(e => e.type === 'dimension').length,
      relations: this.hub.kg.relations.filter(r => r.type === 'in_dimension').length,
      byState: this.hub.repoCountByState(),
    };
  }
}