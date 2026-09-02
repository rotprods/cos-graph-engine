// ================================================================
// PIPELINE L16 -> L17 -> L18 -> L19
// Cross-level integration: Network -> Social -> Bio -> Molecular
// Fase 8: Integracion Cruzada
// ================================================================

import { NetworkGraphEngine, NetworkNode, NetworkNodeType, NetworkEdgeType } from './level16-network';
import { SocialGraphEngine, SocialNodeType, SocialEdgeType } from './level17-social';
import { BiologicalGraphEngine, BioEdgeType } from './level18-biological';
import { MolecularGraphEngine, AtomType, BondType } from './level19-molecular';
import { EntityId } from '@cos/core';

// ===== Pipeline Types =====

export interface NetworkToMolecularResult {
  networkGraph: NetworkGraphEngine;
  socialGraph: SocialGraphEngine;
  biologicalGraph: BiologicalGraphEngine;
  molecularGraph: MolecularGraphEngine;
  metrics: {
    l16: { nodeCount: number; edgeCount: number };
    l17: { nodeCount: number; edgeCount: number };
    l18: { nodeCount: number; edgeCount: number };
    l19: { nodeCount: number; edgeCount: number };
  };
}

// ===== Pipeline L16 -> L17 -> L18 -> L19 =====

export class PipelineL16L17L18L19 {
  networkGraph: NetworkGraphEngine;
  socialGraph: SocialGraphEngine;
  biologicalGraph: BiologicalGraphEngine;
  molecularGraph: MolecularGraphEngine;

  constructor() {
    this.networkGraph = new NetworkGraphEngine('Pipeline Network');
    this.socialGraph = new SocialGraphEngine('Pipeline Social');
    this.biologicalGraph = new BiologicalGraphEngine('Pipeline Biological');
    this.molecularGraph = new MolecularGraphEngine('Pipeline Molecule');
  }

  /** Step 1: Build Network topology */
  buildNetworkGraph(
    nodes: Array<Omit<NetworkNode, 'id' | 'createdAt'>>,
    edges: Array<{ source: EntityId; target: EntityId; type: NetworkEdgeType }>,
  ): void {
    for (const n of nodes) {
      this.networkGraph.addNode(n);
    }
    for (const e of edges) {
      this.networkGraph.addEdge(e.source, e.target, e.type);
    }
  }

  /** Step 2: Convert Network nodes into Social personas */
  networkToSocial(): SocialGraphEngine {
    this.socialGraph = new SocialGraphEngine('Pipeline Social');

    const socialTypeMap: Record<string, SocialNodeType> = {
      server: 'person',
      router: 'influencer',
      cdn: 'page',
      client: 'person',
      load_balancer: 'company',
      pod: 'group',
      service: 'person',
      gateway: 'influencer',
      database: 'company',
      cache: 'page',
    };

    // Each level owns its own generated EntityIds. Keep an explicit identity
    // projection rather than fabricating IDs such as `s_${networkId}`.
    const networkToSocialId = new Map<EntityId, EntityId>();
    for (const n of this.networkGraph.getNodes()) {
      const socialId = this.socialGraph.addNode({
        name: `${n.name}_persona`,
        type: socialTypeMap[n.type] || 'person',
        verified: n.healthy,
        followers: Math.floor((n.throughput || 100) / 10),
        influence: (n.latency || 100) > 50 ? 0.3 : 0.8,
        interests: [`infra_${n.type}`, 'tech'],
        location: n.region,
      });
      networkToSocialId.set(n.id, socialId);
    }

    for (const e of this.networkGraph.getEdges()) {
      const source = networkToSocialId.get(e.source);
      const target = networkToSocialId.get(e.target);
      if (!source || !target) continue;
      this.socialGraph.addEdge(source, target, this.mapNetworkToSocialEdge(e.type), 0.7);
    }

    return this.socialGraph;
  }

  /** Step 3: Convert Social into a Biological neural circuit */
  socialToBiological(): BiologicalGraphEngine {
    this.biologicalGraph = new BiologicalGraphEngine('Pipeline Neural Circuit');
    const socialNodes = this.socialGraph.getNodes();
    const socialToBioId = new Map<EntityId, EntityId>();

    for (const n of socialNodes) {
      const bioId = this.biologicalGraph.addNode({
        name: `neuron_${n.name}`,
        type: 'neuron',
        weight: (n.influence || 0.5) * 2,
        threshold: 0.5,
        firingRate: (n.followers || 100) / 1000,
      });
      socialToBioId.set(n.id, bioId);
    }

    for (const e of this.socialGraph.getEdges()) {
      const source = socialToBioId.get(e.source);
      const target = socialToBioId.get(e.target);
      if (!source || !target) continue;

      const bioEdgeId = this.biologicalGraph.addEdge(
        source,
        target,
        this.mapSocialToBioEdge(e.type),
        e.strength || 0.5,
      );
      const bioEdge = this.biologicalGraph.getEdges().find(edge => edge.id === bioEdgeId);
      if (bioEdge) bioEdge.plasticity = 0.1;
    }

    return this.biologicalGraph;
  }

  /** Step 4: Convert Biological signals into a Molecular structure */
  biologicalToMolecular(): MolecularGraphEngine {
    this.molecularGraph = new MolecularGraphEngine('Pipeline Molecule');
    const bioNodes = this.biologicalGraph.getNodes();

    if (bioNodes.length === 0) return this.molecularGraph;

    const atomIds: EntityId[] = [];
    const elements: AtomType[] = ['C', 'N', 'O', 'S', 'P', 'F'];
    for (let i = 0; i < bioNodes.length; i++) {
      const element = elements[i % elements.length];
      const id = this.molecularGraph.addAtom({
        name: `${element}${i + 1}`,
        type: 'atom',
        element,
        atomicNumber: this.elementToAtomicNumber(element),
        x: i * 2,
        y: Math.sin(i) * 2,
        z: 0,
        implicitHydrogens: element === 'C' ? 4 : element === 'N' ? 3 : element === 'O' ? 2 : 1,
      });
      atomIds.push(id);
    }

    for (const e of this.biologicalGraph.getEdges()) {
      const sourceIdx = bioNodes.findIndex(n => n.id === e.source);
      const targetIdx = bioNodes.findIndex(n => n.id === e.target);
      if (sourceIdx >= 0 && targetIdx >= 0) {
        this.molecularGraph.addBond(
          atomIds[sourceIdx],
          atomIds[targetIdx],
          this.strengthToBondType(e.strength || 0.5),
        );
      }
    }

    return this.molecularGraph;
  }

  /** End-to-end pipeline */
  runPipeline(
    netNodes: Array<Omit<NetworkNode, 'id' | 'createdAt'>>,
    netEdges: Array<{ source: EntityId; target: EntityId; type: NetworkEdgeType }>,
  ): NetworkToMolecularResult {
    this.buildNetworkGraph(netNodes, netEdges);
    this.networkToSocial();
    this.socialToBiological();
    this.biologicalToMolecular();

    return {
      networkGraph: this.networkGraph,
      socialGraph: this.socialGraph,
      biologicalGraph: this.biologicalGraph,
      molecularGraph: this.molecularGraph,
      metrics: {
        l16: { nodeCount: this.networkGraph.getNodes().length, edgeCount: this.networkGraph.getEdges().length },
        l17: { nodeCount: this.socialGraph.getNodes().length, edgeCount: this.socialGraph.getEdges().length },
        l18: { nodeCount: this.biologicalGraph.getNodes().length, edgeCount: this.biologicalGraph.getEdges().length },
        l19: { nodeCount: this.molecularGraph.getAtoms().length, edgeCount: this.molecularGraph.getBonds().length },
      },
    };
  }

  /** Build demo */
  buildDemo(): NetworkToMolecularResult {
    const netNodes = [
      { name: 'WebServer-1', type: 'server' as NetworkNodeType, healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 },
      { name: 'LoadBalancer-1', type: 'load_balancer' as NetworkNodeType, healthy: true, region: 'us-east', latency: 5, throughput: 2000, cpu: 20, memory: 30, replicas: 2 },
      { name: 'DB-Primary', type: 'database' as NetworkNodeType, healthy: true, region: 'us-east', latency: 10, throughput: 1000, cpu: 60, memory: 80, replicas: 1 },
      { name: 'Cache-Redis', type: 'cache' as NetworkNodeType, healthy: true, region: 'us-east', latency: 2, throughput: 5000, cpu: 30, memory: 90, replicas: 2 },
    ];

    return this.runPipeline(netNodes, []);
  }

  /** Validate all four graphs */
  validate(): { l16: string[]; l17: string[]; l18: string[]; l19: string[] } {
    return {
      l16: this.networkGraph.validate(),
      l17: this.socialGraph.validate(),
      l18: this.biologicalGraph.validate(),
      l19: this.molecularGraph.validate(),
    };
  }

  getNetworkGraph(): NetworkGraphEngine { return this.networkGraph; }
  getSocialGraph(): SocialGraphEngine { return this.socialGraph; }
  getBiologicalGraph(): BiologicalGraphEngine { return this.biologicalGraph; }
  getMolecularGraph(): MolecularGraphEngine { return this.molecularGraph; }

  private mapNetworkToSocialEdge(type: NetworkEdgeType): SocialEdgeType {
    const map: Record<string, SocialEdgeType> = {
      routes_to: 'friend_of',
      load_balanced_by: 'works_at',
      proxies_to: 'follows',
      depends_on: 'friend_of',
      replicates_to: 'family_of',
      connects_to: 'mentions',
    };
    return map[type] || 'friend_of';
  }

  private mapSocialToBioEdge(type: SocialEdgeType): BioEdgeType {
    const map: Record<string, BioEdgeType> = {
      friend_of: 'connects_to',
      follows: 'activates',
      works_at: 'regulates',
      attended: 'expresses',
      likes: 'activates',
      family_of: 'connects_to',
      mentions: 'binds_to',
    };
    return map[type] || 'connects_to';
  }

  private strengthToBondType(strength: number): BondType {
    if (strength > 0.8) return 'double';
    if (strength > 0.5) return 'single';
    return 'hydrogen';
  }

  private elementToAtomicNumber(element: AtomType): number {
    const map: Record<string, number> = { C: 6, N: 7, O: 8, S: 16, P: 15, F: 9, Cl: 17, Br: 35, I: 53, H: 1 };
    return map[element] || 6;
  }
}