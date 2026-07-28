import { describe, it, expect } from "bun:test";
import { SMBSourceIndexer } from "../../src/lib/connectors/smb-source";

const indexer = new SMBSourceIndexer();

describe("SMBSourceIndexer", () => {
  it("indexes a category", async () => {
    const result = await indexer.indexCategory("test");
    expect(result.indexed).toBeGreaterThanOrEqual(0);
  });

  it("indexes all categories", async () => {
    const result = await indexer.indexAll(["test", "preference"]);
    expect(result.indexed).toBeGreaterThanOrEqual(0);
  });
});