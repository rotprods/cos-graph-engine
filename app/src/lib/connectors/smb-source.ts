import { SMBClient } from "@cos/smb-client";
import { COSGraph } from "../cos-graph";
import type { COSNode, GraphLevel } from "../cos-graph-types";

const CATEGORY_LEVEL_MAP: Record<string, GraphLevel> = {
  "preference": 9, "project": 13, "fact": 2, "prompt": 1,
  "workflow": 15, "context": 14, "counter": 8, "log": 4,
  "agent_state": 13, "session": 12, "graph_node": 0, "graph_edge": 0,
  "auth": 7, "notification": 1, "pipeline_result": 15, "test": 0,
};

export class SMBSourceIndexer {
  private smb: SMBClient;
  private graph: COSGraph;

  constructor() {
    this.smb = new SMBClient({ baseUrl: "https://shared-memory-bus.higgsfield.app", token: process.env.SMB_TOKEN! });
    this.graph = new COSGraph();
  }

  async indexCategory(category: string, batchSize = 100): Promise<{ indexed: number; skipped: number }> {
    const notes = await this.smb.listNotes(category);
    let indexed = 0, skipped = 0;
    for (const batch of this.chunks(notes, batchSize)) {
      const nodes: COSNode[] = [];
      for (const note of batch) {
        if (await this.graph.getNode(`smb:${note.key}`)) { skipped++; continue; }
        nodes.push({
          id: `smb:${note.key}`,
          type: CATEGORY_LEVEL_MAP[note.category || ""] ?? 0,
          label: note.key,
          properties: { value: (note.value || "").slice(0, 1000), category: note.category, version: note.version },
          source: "shared-memory-bus",
          sourceId: note.key,
          createdAt: note.created_at,
          updatedAt: note.updated_at,
        });
      }
      if (nodes.length) {
        const result = await this.graph.bulkAddNodes(nodes);
        indexed += result.added;
      }
    }
    return { indexed, skipped };
  }

  async indexAll(categories?: string[]): Promise<{ indexed: number; skipped: number }> {
    const cats = categories || Object.keys(CATEGORY_LEVEL_MAP);
    let totalIndexed = 0, totalSkipped = 0;
    for (const cat of cats) {
      const { indexed, skipped } = await this.indexCategory(cat);
      totalIndexed += indexed; totalSkipped += skipped;
    }
    return { indexed: totalIndexed, skipped: totalSkipped };
  }

  private chunks<T>(arr: T[], size: number): T[][] {
    const r: T[][] = [];
    for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));
    return r;
  }
}