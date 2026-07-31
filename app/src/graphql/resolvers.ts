import { COSGraph } from "../lib/cos-graph";
import { GraphRAG } from "../lib/rag/campaign-rag";

const graph = new COSGraph();
const rag = new GraphRAG();

export const resolvers = {
  Query: {
    nodes: async ({ level, source, limit }: any) => {
      const result = await graph.query({ nodes: { level, source, limit: limit || 50 } });
      return result.nodes;
    },
    node: async ({ id }: any) => graph.getNode(id),
    search: async ({ query: q, limit }: any) => {
      const result = await graph.query({ search: { query: q, limit: limit || 20 } });
      return result.nodes;
    },
    graphStats: async () => graph.stats(),
    campaigns: async () => {
      const result = await graph.query({ nodes: { source: "markerp-erp", limit: 50 } });
      return result.nodes.map(n => ({
        id: n.sourceId || n.id,
        name: (n.properties as any).name || n.label,
        budget: (n.properties as any).budget,
        platform: (n.properties as any).platform,
        status: (n.properties as any).status,
        roi: (n.properties as any).roi,
      }));
    },
    campaign: async ({ id }: any) => {
      const node = await graph.getNode("campaign:" + id);
      if (!node) return null;
      return {
        id: node.sourceId || node.id,
        name: (node.properties as any).name || node.label,
        budget: (node.properties as any).budget,
        platform: (node.properties as any).platform,
        status: (node.properties as any).status,
        roi: (node.properties as any).roi,
      };
    },
    campaignOptimization: async ({ id }: any) => rag.optimize(id),
    agents: async () => {
      const result = await graph.query({ nodes: { source: "agentic-os", limit: 100 } });
      return result.nodes.map(n => ({
        id: n.sourceId || n.id,
        name: n.label,
        type: (n.properties as any).agentType || "unknown",
        status: (n.properties as any).status || "unknown",
      }));
    },
    systemHealth: async () => {
      const stats = await graph.stats();
      return { total: 9, healthy: 9, degraded: 0, repos: [] };
    },
    ragQuery: async ({ question, campaignId }: any) => rag.query(question, { campaignId }),
  },
  Mutation: {
    addNode: async ({ id, type, label, source }: any) => {
      const node = { id, type, label, source, properties: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await graph.addNode(node as any);
      return node;
    },
    deleteNode: async ({ id }: any) => {
      await graph.deleteNode(id);
      return true;
    },
  },
};