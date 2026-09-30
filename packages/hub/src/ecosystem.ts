// Carga el grafo del ecosistema (cos-graph.json, formato VisualGraph del engine).
import { readFileSync } from 'fs';

export interface RepoNode {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  weight?: number;
}

export interface EcosystemGraph {
  id?: string;
  title?: string;
  nodes: RepoNode[];
  edges: GraphEdge[];
}

export function loadEcosystemFile(path: string): EcosystemGraph {
  return JSON.parse(readFileSync(path, 'utf8')) as EcosystemGraph;
}

export function loadEcosystemData(data: unknown): EcosystemGraph {
  return data as EcosystemGraph;
}