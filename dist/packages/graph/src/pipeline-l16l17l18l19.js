"use strict";
// ================================================================
// PIPELINE L16 -> L17 -> L18 -> L19
// Cross-level integration: Network -> Social -> Bio -> Molecular
// Fase 8: Integracion Cruzada
// ================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineL16L17L18L19 = void 0;
const level16_network_1 = require("./level16-network");
const level17_social_1 = require("./level17-social");
const level18_biological_1 = require("./level18-biological");
const level19_molecular_1 = require("./level19-molecular");
// ===== Pipeline L16 -> L17 -> L18 -> L19 =====
class PipelineL16L17L18L19 {
    networkGraph;
    socialGraph;
    biologicalGraph;
    molecularGraph;
    constructor() {
        this.networkGraph = new level16_network_1.NetworkGraphEngine('Pipeline Network');
        this.socialGraph = new level17_social_1.SocialGraphEngine('Pipeline Social');
        this.biologicalGraph = new level18_biological_1.BiologicalGraphEngine('Pipeline Biological');
        this.molecularGraph = new level19_molecular_1.MolecularGraphEngine('Pipeline Molecule');
    }
    /** Step 1: Build Network topology */
    buildNetworkGraph(nodes, edges) {
        for (const n of nodes) {
            this.networkGraph.addNode(n);
        }
        for (const e of edges) {
            this.networkGraph.addEdge(e.source, e.target, e.type);
        }
    }
    /** Step 2: Convert Network nodes into Social personas */
    networkToSocial() {
        this.socialGraph = new level17_social_1.SocialGraphEngine('Pipeline Social');
        // Map network types to social personas
        const socialTypeMap = {
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
        const netNodes = this.networkGraph.getNodes();
        for (const n of netNodes) {
            const socialType = socialTypeMap[n.type] || 'person';
            this.socialGraph.addNode({
                name: `${n.name}_persona`,
                type: socialType,
                verified: n.healthy,
                followers: Math.floor((n.throughput || 100) / 10),
                influence: (n.latency || 100) > 50 ? 0.3 : 0.8,
                interests: [`infra_${n.type}`, 'tech'],
                location: n.region,
            });
        }
        // Create social edges from network edges
        const netEdges = this.networkGraph.getEdges();
        for (const e of netEdges) {
            const socialEdgeType = this.mapNetworkToSocialEdge(e.type);
            this.socialGraph.addEdge({
                source: `s_${e.source}`,
                target: `s_${e.target}`,
                type: socialEdgeType,
                strength: 0.7,
            });
        }
        return this.socialGraph;
    }
    /** Step 3: Convert Social into a Biological neural circuit */
    socialToBiological() {
        this.biologicalGraph = new level18_biological_1.BiologicalGraphEngine('Pipeline Neural Circuit');
        const socialNodes = this.socialGraph.getNodes();
        // Map social nodes to neurons
        for (const n of socialNodes) {
            this.biologicalGraph.addNode({
                name: `neuron_${n.name}`,
                type: 'neuron',
                weight: (n.influence || 0.5) * 2,
                threshold: 0.5,
                firingRate: (n.followers || 100) / 1000,
            });
        }
        // Map social edges to synaptic connections
        const socialEdges = this.socialGraph.getEdges();
        for (const e of socialEdges) {
            this.biologicalGraph.addEdge({
                source: `bio_${e.source}`,
                target: `bio_${e.target}`,
                type: this.mapSocialToBioEdge(e.type),
                strength: e.strength || 0.5,
                plasticity: 0.1,
            });
        }
        return this.biologicalGraph;
    }
    /** Step 4: Convert Biological signals into a Molecular structure */
    biologicalToMolecular() {
        this.molecularGraph = new level19_molecular_1.MolecularGraphEngine('Pipeline Molecule');
        const bioNodes = this.biologicalGraph.getNodes();
        if (bioNodes.length === 0)
            return this.molecularGraph;
        // Create atoms from bio nodes
        const atomIds = [];
        const elements = ['C', 'N', 'O', 'S', 'P', 'F'];
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
        // Create bonds from bio edges
        const bioEdges = this.biologicalGraph.getEdges();
        for (const e of bioEdges) {
            const sourceIdx = bioNodes.findIndex(n => n.id === e.source);
            const targetIdx = bioNodes.findIndex(n => n.id === e.target);
            if (sourceIdx >= 0 && targetIdx >= 0) {
                const bondType = this.strengthToBondType(e.strength || 0.5);
                this.molecularGraph.addBond(atomIds[sourceIdx], atomIds[targetIdx], bondType);
            }
        }
        return this.molecularGraph;
    }
    /** End-to-end pipeline */
    runPipeline(netNodes, netEdges) {
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
    buildDemo() {
        const netNodes = [
            { name: 'WebServer-1', type: 'server', healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 },
            { name: 'LoadBalancer-1', type: 'load_balancer', healthy: true, region: 'us-east', latency: 5, throughput: 2000, cpu: 20, memory: 30, replicas: 2 },
            { name: 'DB-Primary', type: 'database', healthy: true, region: 'us-east', latency: 10, throughput: 1000, cpu: 60, memory: 80, replicas: 1 },
            { name: 'Cache-Redis', type: 'cache', healthy: true, region: 'us-east', latency: 2, throughput: 5000, cpu: 30, memory: 90, replicas: 2 },
        ];
        return this.runPipeline(netNodes, []);
    }
    /** Validate all four graphs */
    validate() {
        return {
            l16: this.networkGraph.validate(),
            l17: this.socialGraph.validate(),
            l18: this.biologicalGraph.validate(),
            l19: this.molecularGraph.validate(),
        };
    }
    /** Access underlying engines */
    getNetworkGraph() { return this.networkGraph; }
    getSocialGraph() { return this.socialGraph; }
    getBiologicalGraph() { return this.biologicalGraph; }
    getMolecularGraph() { return this.molecularGraph; }
    // ===== Private =====
    mapNetworkToSocialEdge(type) {
        const map = {
            routes_to: 'friend_of',
            load_balanced_by: 'works_at',
            proxies_to: 'follows',
            depends_on: 'friend_of',
            replicates_to: 'family_of',
            connects_to: 'mentions',
        };
        return (map[type] || 'friend_of');
    }
    mapSocialToBioEdge(type) {
        const map = {
            friend_of: 'connects_to',
            follows: 'activates',
            works_at: 'regulates',
            attended: 'expresses',
            likes: 'activates',
            family_of: 'connects_to',
            mentions: 'binds_to',
        };
        return (map[type] || 'connects_to');
    }
    strengthToBondType(strength) {
        if (strength > 0.8)
            return 'double';
        if (strength > 0.5)
            return 'single';
        return 'hydrogen';
    }
    elementToAtomicNumber(element) {
        const map = { C: 6, N: 7, O: 8, S: 16, P: 15, F: 9, Cl: 17, Br: 35, I: 53, H: 1 };
        return map[element] || 6;
    }
}
exports.PipelineL16L17L18L19 = PipelineL16L17L18L19;
//# sourceMappingURL=pipeline-l16l17l18l19.js.map