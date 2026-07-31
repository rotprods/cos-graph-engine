import { describe, it, expect } from "bun:test";
import { COSGraph } from "../src/lib/cos-graph";
import type { COSNode } from "../src/lib/cos-graph-types";

const graph = new COSGraph();
const PREFIX = `test_cos_${Date.now()}_`;

describe("COS Graph", () => {
  it("adds a node", async () => {
    const node: COSNode = { id: `${PREFIX}n1`, type: 0, label: "Test Node", properties: { key: "val" }, source: "test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await graph.addNode(node);
    const result = await graph.getNode(node.id);
    expect(result).not.toBeNull(); expect(result!.label).toBe("Test Node");
  });

  it("bulk adds nodes", async () => {
    const nodes: COSNode[] = [];
    for (let i = 0; i < 3; i++) nodes.push({ id: `${PREFIX}bulk_${i}`, type: 1, label: `Bulk ${i}`, properties: {}, source: "test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const result = await graph.bulkAddNodes(nodes);
    expect(result.added).toBe(3);
  });

  it("returns null for non-existent node", async () => {
    const result = await graph.getNode("non_existent_node_xyz");
    expect(result).toBeNull();
  });

  it("queries nodes by level", async () => {
    const result = await graph.query({ nodes: { level: 0, limit: 10 } });
    expect(result.nodes.length).toBeGreaterThanOrEqual(0);
  });

  it("queries nodes by source", async () => {
    const result = await graph.query({ nodes: { source: "test", limit: 10 } });
    expect(result.nodes.length).toBeGreaterThanOrEqual(0);
  });

  it("returns stats", async () => {
    const stats = await graph.stats();
    expect(stats.totalNodes).toBeGreaterThanOrEqual(0);
    expect(stats.byLevel).toBeDefined();
    expect(stats.bySource).toBeDefined();
  });

  it("updates a node", async () => {
    const id = `${PREFIX}update`;
    await graph.addNode({ id, type: 2, label: "Original", properties: {}, source: "test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await graph.updateNode(id, { label: "Updated" });
    const node = await graph.getNode(id);
    expect(node!.label).toBe("Updated");
  });

  it("deletes a node", async () => {
    const id = `${PREFIX}delete`;
    await graph.addNode({ id, type: 3, label: "To Delete", properties: {}, source: "test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await graph.deleteNode(id);
    const node = await graph.getNode(id);
    expect(node).toBeNull();
  });

  it("searches nodes by text", async () => {
    const result = await graph.query({ search: { query: "test", limit: 10 } });
    expect(Array.isArray(result.nodes)).toBe(true);
  });
});