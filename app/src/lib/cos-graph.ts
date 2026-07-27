import { SMBClient } from "@cos/smb-client";
import type { COSNode, COSEdge, COSQuery, COSQueryResult, GraphLevel } from "./cos-graph-types";

const PREFIX = "cos:graph:";

export class COSGraph {
  private smb: SMBClient;

  constructor() {
    this.smb = new SMBClient({
      baseUrl: "https://shared-memory-bus.higgsfield.app",
      token: process.env.SMB_TOKEN!,
    });
  }

  // ─── Node CRUD ───────────────────────────────────────────────────────

  async addNode(node: COSNode): Promise<void> {
    const key = `${PREFIX}node:${node.id}`;
    const existing = await this.smb.getNote(key);
    if (existing) throw new Error(`Node ${node.id} already exists`);
    await this.smb.setNote(key, JSON.stringify(node), { category: "graph_node" });
  }

  async bulkAddNodes(nodes: COSNode[]): Promise<{ added: number; errors: string[] }> {
    let added = 0;
    const errors: string[] = [];
    for (const node of nodes) {
      try { await this.addNode(node); added++; }
      catch (err) { errors.push(`${node.id}: ${err instanceof Error ? err.message : String(err)}`); }
    }
    return { added, errors };
  }

  async getNode(id: string): Promise<COSNode | null> {
    const note = await this.smb.getNote(`${PREFIX}node:${id}`);
    return note ? JSON.parse(note.value) : null;
  }

  async updateNode(id: string, updates: Partial<COSNode>): Promise<void> {
    const existing = await this.getNode(id);
    if (!existing) throw new Error(`Node ${id} not found`);
    await this.smb.setNote(`${PREFIX}node:${id}`, JSON.stringify({ ...existing, ...updates, updatedAt: new Date().toISOString() }), { category: "graph_node" });
  }

  async deleteNode(id: string): Promise<void> {
    await this.smb.deleteNote(`${PREFIX}node:${id}`);
    const edges = await this.listEdges(id);
    for (const edge of edges) {
      await this.smb.deleteNote(`${PREFIX}edge:${edge.source}:${edge.target}`);
    }
  }

  // ─── Edge CRUD ───────────────────────────────────────────────────────

  async addEdge(edge: COSEdge): Promise<void> {
    await this.smb.setNote(`${PREFIX}edge:${edge.source}:${edge.target}`, JSON.stringify(edge), { category: "graph_edge" });
  }

  async getEdge(source: string, target: string): Promise<COSE dge | null> {
    const note = await this.smb.getNote(`${PREFIX}edge:${source}:${target}`);
    return note ? JSON.parse(note.value) : null;
  }

  async listEdges(nodeId?: string): Promise<COSE dge[]> {
    const notes = nodeId
      ? await this.smb.searchNotes(`cos:graph:edge:${nodeId}`, "graph_edge")
      : await this.smb.listNotes("graph_edge");
    return notes.map(n => JSON.parse(n.value));
  }

  // ─── Query ───────────────────────────────────────────────────────────

  async query(q: COSQuery): Promise<COSQueryResult> {
    const start = Date.now();
    const allNodes = await this.smb.listNotes("graph_node");
    let nodes = allNodes.map(n => JSON.parse(n.value)).filter((n: COSNode) => {
      if (q.nodes?.level !== undefined && n.type !== q.nodes.level) return false;
      if (q.nodes?.source && n.source !== q.nodes.source) return false;
      return true;
    }).slice(0, q.nodes?.limit || 100);
    const edges = await this.listEdges();

    if (q.search) {
      const text = q.search.query.toLowerCase();
      nodes = allNodes.map(n => JSON.parse(n.value)).filter((n: COSNode) =>
        n.label.toLowerCase().includes(text) ||
        JSON.stringify(n.properties).toLowerCase().includes(text)
      ).slice(0, q.search?.limit || 20);
    }

    if (q.path) {
      nodes = await this.shortestPath(q.path.from, q.path.to, q.path.maxDepth || 5);
    }

    return { nodes, edges, total: nodes.length, queryTime: Date.now() - start };
  }

  // ─── Shortest Path ───────────────────────────────────────────────────

  async shortestPath(from: string, to: string, maxDepth = 5): Promise<COSNode[]> {
    const allEdges = await this.listEdges();
    const adj = new Map<string, string[]>();
    for (const e of allEdges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }
    const visited = new Set<string>([from]);
    const queue: { node: string; path: COSNode[] }[] = [{ node: from, path: [] }];
    let head = 0;
    while (head < queue.length) {
      const { node, path } = queue[head++];
      for (const neighbor of adj.get(node) || []) {
        if (neighbor === to) {
          const fp = [...path];
          const fn = await this.getNode(from);
          const tn = await this.getNode(to);
          if (fn) fp.push(fn);
          if (tn) fp.push(tn);
          return fp;
        }
        if (!visited.has(neighbor) && path.length < maxDepth) {
          visited.add(neighbor);
          const nn = await this.getNode(neighbor);
          if (nn) queue.push({ node: neighbor, path: [...path, nn] });
        }
      }
    }
    return [];
  }

  // ─── Stats ───────────────────────────────────────────────────────────

  async stats(): Promise<{ totalNodes: number; byLevel: Record<string, number>; bySource: Record<string, number> }> {
    const nodes = (await this.smb.listNotes("graph_node")).map(n => JSON.parse(n.value) as COSNode);
    const byLevel: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const n of nodes) {
      byLevel[String(n.type)] = (byLevel[String(n.type)] || 0) + 1;
      bySource[n.source] = (bySource[n.source] || 0) + 1;
    }
    return { totalNodes: nodes.length, byLevel, bySource };
  }
}