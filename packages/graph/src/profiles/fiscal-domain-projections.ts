import type { EntityId } from '@cos/core';
import { NetworkGraphEngine, type NetworkNodeType } from '../level16-network';
import { SocialGraphEngine, type SocialNodeType } from '../level17-social';

export type FiscalProviderHealth = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
export type FiscalProviderKind = 'bank' | 'broker' | 'exchange' | 'wallet' | 'storage' | 'database' | 'authority' | 'adviser' | 'runtime' | 'api';

export interface FiscalProviderNode {
  id: string;
  name: string;
  kind: FiscalProviderKind;
  health: FiscalProviderHealth;
  region?: string;
  latencyMs?: number;
  authorityClass?: string;
  sensitivity?: string;
  canonical?: boolean;
}

export interface FiscalProviderLink {
  source: string;
  target: string;
  relation: 'DEPENDS_ON' | 'MIRRORS' | 'READS_FROM' | 'WRITES_TO' | 'FALLBACK_TO' | 'CUSTODIES_AT' | 'SETTLES_THROUGH';
}

function networkType(kind: FiscalProviderKind): NetworkNodeType {
  if (kind === 'storage') return 'service';
  if (kind === 'database') return 'database';
  if (kind === 'runtime') return 'server';
  if (kind === 'api' || kind === 'authority' || kind === 'adviser') return 'gateway';
  return 'service';
}

/** L16 provider/infrastructure projection with domain relation sidecar. */
export class FiscalProviderNetwork {
  readonly graph = new NetworkGraphEngine('Fiscal / Financial Provider Network');
  private readonly nativeIds = new Map<string, EntityId>();
  private readonly nodes = new Map<string, FiscalProviderNode>();
  private readonly links: FiscalProviderLink[] = [];

  addProvider(provider: FiscalProviderNode): void {
    if (this.nodes.has(provider.id)) throw new Error(`Duplicate fiscal provider ${provider.id}`);
    const nativeId = this.graph.addNode({
      name: provider.name,
      type: networkType(provider.kind),
      healthy: provider.health === 'HEALTHY',
      region: provider.region,
      latency: provider.latencyMs,
    });
    this.nativeIds.set(provider.id, nativeId);
    this.nodes.set(provider.id, structuredClone(provider));
  }

  addLink(link: FiscalProviderLink): void {
    const source = this.nativeIds.get(link.source);
    const target = this.nativeIds.get(link.target);
    if (!source || !target) throw new Error(`Unknown fiscal provider link: ${link.source} -> ${link.target}`);
    this.graph.addEdge(source, target, link.relation === 'FALLBACK_TO' ? 'connects_to' : 'depends_on');
    this.links.push(structuredClone(link));
  }

  singlePointsOfFailure(): FiscalProviderNode[] {
    const incoming = new Map<string, number>();
    const fallbacks = new Set(this.links.filter(l => l.relation === 'FALLBACK_TO').map(l => l.source));
    for (const node of this.nodes.keys()) incoming.set(node, 0);
    for (const link of this.links) incoming.set(link.target, (incoming.get(link.target) ?? 0) + 1);
    return [...this.nodes.values()].filter(node =>
      node.canonical === true && !fallbacks.has(node.id) && (incoming.get(node.id) ?? 0) > 0
    ).map(v => structuredClone(v));
  }

  validate(): string[] {
    return this.graph.validate();
  }

  snapshot() {
    return { native: this.graph.toJSON(), nodes: [...this.nodes.values()], links: [...this.links] };
  }
}

export type FiscalCounterpartyKind = 'person' | 'legal_entity' | 'authority' | 'adviser' | 'bank' | 'broker' | 'exchange' | 'supplier' | 'client';
export type FiscalCounterpartyRelation = 'CLIENT_OF' | 'SUPPLIER_TO' | 'ADVISES' | 'REGULATES' | 'BANKS_FOR' | 'BROKERS_FOR' | 'CUSTODIES_FOR' | 'PAYS' | 'PAID_BY';

export interface FiscalCounterpartyNode {
  id: string;
  name: string;
  kind: FiscalCounterpartyKind;
  verified: boolean;
  jurisdiction?: string;
  legalEntityId?: string;
}

export interface FiscalCounterpartyLink {
  source: string;
  target: string;
  relation: FiscalCounterpartyRelation;
  strength?: number;
}

function socialType(kind: FiscalCounterpartyKind): SocialNodeType {
  return kind === 'person' ? 'person' : 'company';
}

/**
 * L17 uses SocialGraph only for relationship topology. Fiscal relationship semantics
 * remain in the sidecar and are never coerced into `friend_of`/`follows` meaning.
 */
export class FiscalCounterpartyProjection {
  readonly graph = new SocialGraphEngine('Fiscal Counterparty / Institution Network');
  private readonly nativeIds = new Map<string, EntityId>();
  private readonly nodes = new Map<string, FiscalCounterpartyNode>();
  private readonly links: FiscalCounterpartyLink[] = [];

  addNode(node: FiscalCounterpartyNode): void {
    if (this.nodes.has(node.id)) throw new Error(`Duplicate fiscal counterparty ${node.id}`);
    const nativeId = this.graph.addNode({
      name: node.name,
      type: socialType(node.kind),
      verified: node.verified,
      location: node.jurisdiction,
      interests: [`fiscalKind:${node.kind}`, ...(node.legalEntityId ? [`legalEntityId:${node.legalEntityId}`] : [])],
    });
    this.nativeIds.set(node.id, nativeId);
    this.nodes.set(node.id, structuredClone(node));
  }

  addLink(link: FiscalCounterpartyLink): void {
    const source = this.nativeIds.get(link.source);
    const target = this.nativeIds.get(link.target);
    if (!source || !target) throw new Error(`Unknown fiscal counterparty link ${link.source} -> ${link.target}`);
    // Native edge is topology-only. `mentions` is neutral enough for traversal; domain relation is sidecar authority.
    this.graph.addEdge(source, target, 'mentions', link.strength ?? 1);
    this.links.push(structuredClone(link));
  }

  validate(): string[] { return this.graph.validate(); }
  snapshot() { return { native: this.graph.toJSON(), nodes: [...this.nodes.values()], links: [...this.links] }; }
}

export interface DomainProjectionNode<TType extends string> {
  id: string;
  type: TType;
  name: string;
  properties?: Record<string, unknown>;
}

export interface DomainProjectionEdge<TRelation extends string> {
  id: string;
  source: string;
  target: string;
  relation: TRelation;
  properties?: Record<string, unknown>;
}

/**
 * Domain-safe adapter for specialized COS levels whose built-in biological/molecular
 * type vocabularies must NOT be semantically falsified for fiscal use.
 *
 * It keeps level identity and graph invariants while refusing fake mappings such as
 * `TaxRule -> gene` or `Invoice -> atom`.
 */
export class FiscalDomainProjectionGraph<TType extends string, TRelation extends string> {
  readonly kernelLevel: 18 | 19;
  readonly kernelFamily: 'biological' | 'molecular';
  readonly projectionMode = 'DOMAIN_SEMANTIC_ADAPTER' as const;
  readonly nodes: DomainProjectionNode<TType>[] = [];
  readonly edges: DomainProjectionEdge<TRelation>[] = [];

  constructor(level: 18 | 19) {
    this.kernelLevel = level;
    this.kernelFamily = level === 18 ? 'biological' : 'molecular';
  }

  addNode(node: DomainProjectionNode<TType>): void {
    if (this.nodes.some(n => n.id === node.id)) throw new Error(`Duplicate L${this.kernelLevel} projection node ${node.id}`);
    this.nodes.push(structuredClone(node));
  }

  addEdge(edge: DomainProjectionEdge<TRelation>): void {
    if (!this.nodes.some(n => n.id === edge.source)) throw new Error(`L${this.kernelLevel} edge source missing: ${edge.source}`);
    if (!this.nodes.some(n => n.id === edge.target)) throw new Error(`L${this.kernelLevel} edge target missing: ${edge.target}`);
    if (this.edges.some(e => e.id === edge.id)) throw new Error(`Duplicate L${this.kernelLevel} edge ${edge.id}`);
    this.edges.push(structuredClone(edge));
  }

  validate(): string[] {
    const ids = new Set(this.nodes.map(n => n.id));
    const errors: string[] = [];
    for (const edge of this.edges) {
      if (!ids.has(edge.source)) errors.push(`Dangling L${this.kernelLevel} edge source ${edge.source}`);
      if (!ids.has(edge.target)) errors.push(`Dangling L${this.kernelLevel} edge target ${edge.target}`);
    }
    return errors;
  }

  toJSON() {
    return {
      kernelLevel: this.kernelLevel,
      kernelFamily: this.kernelFamily,
      projectionMode: this.projectionMode,
      nodes: structuredClone(this.nodes),
      edges: structuredClone(this.edges),
    };
  }
}

export type FiscalRegulatoryNodeType = 'Jurisdiction' | 'TaxRule' | 'TaxModel' | 'TaxObligation' | 'Deadline' | 'ProfessionalReviewGate';
export type FiscalRegulatoryRelation = 'APPLIES_IN' | 'GOVERNS' | 'REQUIRES' | 'DUE_AT' | 'SUPERSEDES' | 'REVIEWED_UNDER';

export function createFiscalRegulatoryProjection(): FiscalDomainProjectionGraph<FiscalRegulatoryNodeType, FiscalRegulatoryRelation> {
  return new FiscalDomainProjectionGraph(18);
}

export type FiscalAtomicNodeType = 'Invoice' | 'InvoiceLine' | 'Payment' | 'Debt' | 'Asset' | 'TaxLot' | 'Disposal' | 'TaxReturnLine';
export type FiscalAtomicRelation = 'CONTAINS' | 'SETTLED_BY' | 'CONSUMES' | 'LOT_OF' | 'DISPOSES' | 'REPORTED_ON' | 'RECTIFIES';

export function createFiscalAtomicFinancialProjection(): FiscalDomainProjectionGraph<FiscalAtomicNodeType, FiscalAtomicRelation> {
  return new FiscalDomainProjectionGraph(19);
}
