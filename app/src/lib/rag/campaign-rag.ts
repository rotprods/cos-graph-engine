import { COSGraph } from "../cos-graph";

export interface RAGResult {
  answer: string;
  sources: Array<{ id: string; label: string }>;
  queryTime: number;
}

export class GraphRAG {
  private graph: COSGraph;

  constructor() {
    this.graph = new COSGraph();
  }

  async query(question: string, options?: { campaignId?: string; limit?: number }): Promise<RAGResult> {
    const start = Date.now();
    const limit = options?.limit || 5;
    const result = await this.graph.query({ search: { query: question, limit } });
    let sources = result.nodes;

    if (options?.campaignId) {
      const neighbors = await this.graph.query({ path: { from: "campaign:" + options.campaignId, to: "campaign:" + options.campaignId, maxDepth: 2 } });
      sources = [...sources, ...neighbors.nodes];
    }

    const context = sources.map(n => "[" + n.label + "] (" + n.source + ", L" + n.type + "): " + JSON.stringify(n.properties).slice(0, 200)).join("\n");

    let answer = "No se pudo generar respuesta.";
    try {
      const res = await fetch("https://ollama-cloud-integration.higgsfield.app/api/infer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama3", prompt: "Contexto:\n" + context + "\n\nPregunta: " + question + "\n\nResponde:", stream: false }),
      });
      const data = await res.json();
      answer = data.response || answer;
    } catch {
      answer = "Contexto encontrado: " + sources.length + " fuentes relacionadas.";
    }

    return { answer, sources: sources.map(n => ({ id: n.id, label: n.label })), queryTime: Date.now() - start };
  }

  async optimize(campaignId: string): Promise<{ suggestions: string[]; similarCampaigns: string[] }> {
    const campaign = await this.graph.getNode("campaign:" + campaignId);
    if (!campaign) throw new Error("Campaign " + campaignId + " not found");
    const budget = (campaign.properties as any).budget || 0;
    const platform = (campaign.properties as any).platform || "unknown";
    const similar = await this.graph.query({ search: { query: "campaign " + platform + " budget", limit: 3 } });
    return {
      suggestions: [
        budget < 1000 ? "Considera aumentar el presupuesto" : "Presupuesto adecuado",
        platform === "meta" ? "Prueba Google Ads para diversificar" : "Plataforma correcta",
        similar.nodes.length + " campañas similares encontradas",
      ],
      similarCampaigns: similar.nodes.map(n => n.label),
    };
  }
}