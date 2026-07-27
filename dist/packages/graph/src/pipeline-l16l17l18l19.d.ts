import { NetworkGraphEngine, NetworkNode, NetworkEdgeType } from './level16-network';
import { SocialGraphEngine } from './level17-social';
import { BiologicalGraphEngine } from './level18-biological';
import { MolecularGraphEngine } from './level19-molecular';
import { EntityId } from '@cos/core';
export interface NetworkToMolecularResult {
    networkGraph: NetworkGraphEngine;
    socialGraph: SocialGraphEngine;
    biologicalGraph: BiologicalGraphEngine;
    molecularGraph: MolecularGraphEngine;
    metrics: {
        l16: {
            nodeCount: number;
            edgeCount: number;
        };
        l17: {
            nodeCount: number;
            edgeCount: number;
        };
        l18: {
            nodeCount: number;
            edgeCount: number;
        };
        l19: {
            nodeCount: number;
            edgeCount: number;
        };
    };
}
export declare class PipelineL16L17L18L19 {
    networkGraph: NetworkGraphEngine;
    socialGraph: SocialGraphEngine;
    biologicalGraph: BiologicalGraphEngine;
    molecularGraph: MolecularGraphEngine;
    constructor();
    /** Step 1: Build Network topology */
    buildNetworkGraph(nodes: Array<Omit<NetworkNode, 'id' | 'createdAt'>>, edges: Array<{
        source: EntityId;
        target: EntityId;
        type: NetworkEdgeType;
    }>): void;
    /** Step 2: Convert Network nodes into Social personas */
    networkToSocial(): SocialGraphEngine;
    /** Step 3: Convert Social into a Biological neural circuit */
    socialToBiological(): BiologicalGraphEngine;
    /** Step 4: Convert Biological signals into a Molecular structure */
    biologicalToMolecular(): MolecularGraphEngine;
    /** End-to-end pipeline */
    runPipeline(netNodes: Array<Omit<NetworkNode, 'id' | 'createdAt'>>, netEdges: Array<{
        source: EntityId;
        target: EntityId;
        type: NetworkEdgeType;
    }>): NetworkToMolecularResult;
    /** Build demo */
    buildDemo(): NetworkToMolecularResult;
    /** Validate all four graphs */
    validate(): {
        l16: string[];
        l17: string[];
        l18: string[];
        l19: string[];
    };
    /** Access underlying engines */
    getNetworkGraph(): NetworkGraphEngine;
    getSocialGraph(): SocialGraphEngine;
    getBiologicalGraph(): BiologicalGraphEngine;
    getMolecularGraph(): MolecularGraphEngine;
    private mapNetworkToSocialEdge;
    private mapSocialToBioEdge;
    private strengthToBondType;
    private elementToAtomicNumber;
}
//# sourceMappingURL=pipeline-l16l17l18l19.d.ts.map