"use strict";
// COS Test Suite — Memory Package
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMemoryTests = runMemoryTests;
const index_ts_1 = require("../packages/memory/src/index.ts");
let passed = 0, failed = 0;
function assert(c, m) { if (c) {
    passed++;
    console.log(`  ✅ ${m}`);
}
else {
    failed++;
    console.log(`  ❌ ${m}`);
} }
async function testMemoryStore() {
    const mem = new index_ts_1.MemoryManager();
    const id = await mem.store('test-data', 'working', { tags: ['test'], importance: 0.8, ttl: 3600 });
    assert(id.length > 0, 'MemoryManager.store returns valid ID');
    const retrieved = await mem.retrieve(id);
    assert(retrieved !== null, 'MemoryManager.retrieve finds stored entry');
    assert(retrieved.content === 'test-data', 'MemoryManager.retrieve returns correct content');
    assert(retrieved.layer === 'working', 'MemoryManager stores correct layer');
    assert(retrieved.tags.includes('test'), 'MemoryManager stores tags');
    assert(retrieved.accessCount > 0, 'MemoryManager tracks access count');
}
async function testMemoryLayers() {
    const mem = new index_ts_1.MemoryManager();
    const layers = ['working', 'short_term', 'long_term', 'semantic', 'procedural', 'episodic', 'temporal', 'spatial', 'vector', 'knowledge_graph', 'cache', 'reflection'];
    for (const layer of layers) {
        const id = await mem.store(`layer-${layer}`, layer, { tags: [layer], importance: 0.5 });
        const r = await mem.retrieve(id);
        assert(r !== null && r.layer === layer, `MemoryManager supports layer: ${layer}`);
    }
}
async function testMemoryQuery() {
    const mem = new index_ts_1.MemoryManager();
    await mem.store('q1', 'short_term', { tags: ['a', 'b'], importance: 0.9 });
    await mem.store('q2', 'short_term', { tags: ['a'], importance: 0.5 });
    await mem.store('q3', 'long_term', { tags: ['b'], importance: 0.7 });
    const byLayer = await mem.query({ layer: 'short_term' });
    assert(byLayer.length === 2, 'MemoryManager.query filters by layer');
    const byTag = await mem.query({ tags: ['a'] });
    assert(byTag.length === 2, 'MemoryManager.query filters by tag');
    const byImportance = await mem.query({ layer: 'short_term', sortBy: 'importance', sortOrder: 'desc' });
    assert(byImportance.length === 2, 'MemoryManager.query sorts by importance');
    assert(byImportance[0].importance >= byImportance[1].importance, 'MemoryManager.query sorts descending');
}
async function testMemoryConsolidate() {
    const mem = new index_ts_1.MemoryManager();
    await mem.store('important', 'short_term', { importance: 0.9 });
    await mem.store('unimportant', 'short_term', { importance: 0.3 });
    const consolidated = await mem.consolidate(0.7);
    assert(consolidated >= 1, 'MemoryManager.consolidate promotes high-importance entries');
    const longTerm = await mem.query({ layer: 'long_term' });
    assert(longTerm.length >= 1, 'Consolidated entries appear in long_term');
}
async function testMemoryStats() {
    const mem = new index_ts_1.MemoryManager();
    await mem.store('s1', 'working', { tags: ['s'], importance: 0.5 });
    await mem.store('s2', 'semantic', { tags: ['s'], importance: 0.8 });
    const stats = await mem.stats();
    assert(stats.totalEntries >= 2, 'MemoryManager.stats returns total count');
    assert(stats.byLayer.working >= 1, 'MemoryManager.stats breaks down by layer');
    assert(stats.byLayer.semantic >= 1, 'MemoryManager.stats breaks down by layer');
}
async function runMemoryTests() {
    console.log('\n💾 Memory Package Tests');
    console.log('────────────────────────');
    await testMemoryStore();
    await testMemoryLayers();
    await testMemoryQuery();
    await testMemoryConsolidate();
    await testMemoryStats();
    console.log(`  ────────────────────`);
    console.log(`  ${passed}/${passed + failed} passed, ${failed} failed\n`);
    return { passed, failed };
}
//# sourceMappingURL=memory.test.js.map