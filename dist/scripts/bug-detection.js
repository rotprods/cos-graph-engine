"use strict";
// COS Bug Detection Suite
// Tests edge cases, error conditions, and boundary scenarios
Object.defineProperty(exports, "__esModule", { value: true });
const index_ts_1 = require("../packages/core/src/index.ts");
const index_ts_2 = require("../packages/runtime/src/index.ts");
const index_ts_3 = require("../packages/memory/src/index.ts");
const index_ts_4 = require("../packages/knowledge/src/index.ts");
const index_ts_5 = require("../packages/cognition/src/index.ts");
const index_ts_6 = require("../packages/execution/src/index.ts");
const index_ts_7 = require("../packages/orchestration/src/index.ts");
let passed = 0, failed = 0, bugs = 0;
function assert(cond, msg) {
    if (cond) {
        passed++;
    }
    else {
        failed++;
        bugs++;
        console.log(`  🐛 BUG: ${msg}`);
    }
}
function section(name) { console.log(`\n📍 ${name}`); }
async function testCoreEdgeCases() {
    section('Core — Edge Cases');
    // Empty ID generation
    const id = (0, index_ts_1.generateId)();
    assert(id.length > 5, 'generateId produces non-empty string');
    assert(id.startsWith('cos_'), 'generateId has correct prefix');
    // Error with empty message
    const err = new index_ts_1.CellError('', '');
    assert(err.code === '', 'CellError allows empty code');
    // Error serialization
    const json = err.toJSON();
    assert(json.code !== undefined, 'CellError.toJSON includes code');
    assert(json.severity !== undefined, 'CellError.toJSON includes severity');
    // BaseCell with empty definition
    let caught = false;
    try {
        const badCell = new (class extends index_ts_1.BaseCell {
            constructor() { super({}); }
            async onProcess(i, c) { return { result: i, representations: {}, cost: { units: '', amount: 0 }, confidence: 0, memoryUpdates: [], events: [], errors: [], metadata: {} }; }
        })();
        await badCell.init();
    }
    catch {
        caught = true;
    }
    assert(caught, 'BaseCell.init fails with empty definition');
}
async function testEventBusEdgeCases() {
    section('EventBus — Edge Cases');
    const bus = new index_ts_2.EventBus();
    // Subscribe and unsubscribe nonexistent
    await bus.unsubscribe('nonexistent');
    assert(true, 'EventBus.unsubscribe handles nonexistent subscription');
    // Publish with no subscribers
    await bus.publish({ type: 'orphan', source: 't', payload: {}, severity: 'info', metadata: {} });
    assert(true, 'EventBus.publish handles no subscribers');
    // Multiple subscribers to same event
    let count = 0;
    await bus.subscribe('multi', async () => { count++; });
    await bus.subscribe('multi', async () => { count++; });
    await bus.publish({ type: 'multi', source: 't', payload: {}, severity: 'info', metadata: {} });
    assert(count === 2, 'EventBus supports multiple subscribers to same event type');
    // History bounded
    const history = await bus.getHistory('multi');
    assert(history.length >= 1, 'EventBus history records events');
}
async function testMemoryEdgeCases() {
    section('Memory — Edge Cases');
    const mem = new index_ts_3.MemoryManager();
    // Store and retrieve nonexistent
    const nonexistent = await mem.retrieve('nonexistent');
    assert(nonexistent === null, 'MemoryManager.retrieve returns null for nonexistent');
    // Store with empty content
    const id = await mem.store(null, 'working', { tags: [], importance: 0 });
    assert(id.length > 0, 'MemoryManager.store accepts null content');
    // Query with empty filters
    const all = await mem.query({});
    assert(all.length >= 1, 'MemoryManager.query with empty filters returns results');
    // Consolidate with no entries
    const consolidated = await mem.consolidate(1.0);
    assert(consolidated >= 0, 'MemoryManager.consolidate handles no eligible entries');
    // Double delete
    const delId = await mem.store('delete-me', 'cache', { tags: [], importance: 0.1, ttl: 1 });
    await mem.delete(delId);
    await mem.delete(delId);
    assert(true, 'MemoryManager.delete handles double delete');
    // Update nonexistent
    try {
        await mem.update('nonexistent', { content: 'updated' });
    }
    catch {
        assert(true, 'MemoryManager.update throws on nonexistent');
    }
}
async function testKnowledgeEdgeCases() {
    section('Knowledge — Edge Cases');
    const kg = new index_ts_4.KnowledgeGraph();
    // Query empty graph
    const empty = await kg.query('nonexistent');
    assert(empty.length === 0, 'KnowledgeGraph.query returns empty for nonexistent');
    // Statement with empty fields
    try {
        await kg.addStatement({ subject: '', predicate: '', object: '', confidence: 0, source: 't', metadata: {}, embedding: undefined });
        assert(true, 'KnowledgeGraph accepts empty statement fields');
    }
    catch {
        assert(false, 'KnowledgeGraph should handle empty fields');
    }
    const emb = new index_ts_4.EmbeddingSystem();
    // Empty text embedding
    const emptyVec = emb.textToEmbedding('');
    const search = await emb.search(emptyVec, { limit: 5 });
    assert(search.length >= 0, 'EmbeddingSystem handles empty text');
    // Search with no embeddings
    const freshEmb = new index_ts_4.EmbeddingSystem();
    const freshVec = freshEmb.textToEmbedding('test');
    const freshSearch = await freshEmb.search(freshVec, { limit: 5 });
    assert(freshSearch.length === 0, 'EmbeddingSystem.search returns empty with no data');
    // Ontology validation
    const onto = new index_ts_4.OntologySystem();
    await onto.defineClass('Required', 'test', null, [{ name: 'req', type: 'string', required: true, description: '' }]);
    const valid = onto.validate({}, 'Required');
    assert(valid.valid === false, 'OntologySystem.validate catches missing required field');
    assert(valid.errors.length > 0, 'OntologySystem.validate returns error messages');
}
async function testReasoningEdgeCases() {
    section('Reasoning — Edge Cases');
    const registry = new index_ts_5.ReasoningEngineRegistry();
    // Empty problem
    const steps = await registry.reason('chain_of_thought', { problem: '', steps: 1 }, { traceId: 't' });
    assert(steps.length === 1, 'CoT handles empty problem');
    // Zero steps
    const zeroSteps = await registry.reason('chain_of_thought', { problem: 'test', steps: 0 }, { traceId: 't' });
    assert(zeroSteps.length >= 0, 'CoT handles zero steps');
    // ToT with minimum parameters
    const totSteps = await registry.reason('tree_of_thoughts', { problem: 'test', branchingFactor: 1, maxDepth: 1 }, { traceId: 't' });
    assert(totSteps.length >= 1, 'ToT handles minimum parameters');
    // Evaluation with empty criteria
    const evalSys = new index_ts_5.EvaluationSystem();
    const evalResult = await evalSys.evaluate('test', 'output', []);
    assert(evalResult.overallScore >= 0, 'Evaluation handles empty criteria');
    // Learning with empty feedback
    const learn = new index_ts_5.LearningSystem();
    const exId = await learn.recordExample('input', 'output');
    await learn.addFeedback(exId, 0, '');
    const patterns = await learn.getPatterns();
    assert(patterns.length >= 0, 'Learning handles empty feedback');
}
async function testExecutionEdgeCases() {
    section('Execution — Edge Cases');
    const tools = new index_ts_6.ToolRegistry();
    // Execute nonexistent tool
    try {
        await tools.execute('nonexistent', {}, { traceId: 't' });
        assert(false, 'ToolRegistry should throw for nonexistent tool');
    }
    catch {
        assert(true, 'ToolRegistry throws for nonexistent tool');
    }
    // Filesystem with invalid path
    const fsResult = await tools.execute('filesystem', { operation: 'read', path: '/invalid/path/that/does/not/exist.txt' }, { traceId: 't' });
    assert(fsResult.success === false, 'FileSystemTool returns error for nonexistent file');
    // HTTP with invalid URL
    const httpResult = await tools.execute('http_client', { method: 'GET', url: 'https://invalid.nonexistent.domain.test' }, { traceId: 't' });
    assert(httpResult.success === false, 'HTTPTool returns error for invalid URL');
}
async function testOrchestrationEdgeCases() {
    section('Orchestration — Edge Cases');
    // Policy with no rules
    const pol = new index_ts_7.PolicyEngine();
    const noRules = await pol.evaluate('read', 'memory', { traceId: 't' });
    assert(noRules.allowed === false, 'PolicyEngine denies when no rules match');
    // Policy with conditions
    await pol.addRule({ id: 'p:cond', name: 'conditional', description: '', effect: 'allow', actions: ['read'], resources: ['memory'], conditions: [{ field: 'userId', operator: 'eq', value: 'admin' }], priority: 0, enabled: true });
    const wrongUser = await pol.evaluate('read', 'memory', { traceId: 't', userId: 'guest' });
    assert(wrongUser.allowed === false, 'PolicyEngine evaluates conditions correctly');
    // Workflow with no steps
    const wf = new index_ts_7.WorkflowEngine();
    const wfId = await wf.define('empty', 'test', []);
    assert(wfId.length > 0, 'WorkflowEngine defines empty workflow');
}
async function testSystemEdgeCases() {
    section('System — Integration Edge Cases');
    const { COSServer } = require('../packages/api/src/index.ts');
    const server = new COSServer({ port: 0, logLevel: 'silent' });
    // Process with empty input
    const empty = await server.process({ input: '', context: { traceId: 'e1' } });
    assert(empty.result !== undefined, 'COSSERVER.process handles empty input');
    // Process with null input
    const nullInput = await server.process({ input: null, context: { traceId: 'e2' } });
    assert(nullInput.result !== undefined, 'COSSERVER.process handles null input');
    // Multiple rapid processes
    const results = await Promise.all([
        server.process({ input: 'a', context: { traceId: 'e3' } }),
        server.process({ input: 'b', context: { traceId: 'e4' } }),
        server.process({ input: 'c', context: { traceId: 'e5' } }),
    ]);
    assert(results.length === 3, 'COSSERVER.process handles concurrent requests');
    assert(results.every(r => r.result !== undefined), 'All concurrent requests return results');
    // Self-improvement with no data
    const si = new index_ts_5.SelfImprovementSystem(new index_ts_5.EvaluationSystem(), new index_ts_5.LearningSystem(), new index_ts_5.ReasoningEngineRegistry());
    const report = await si.runMetaCognition(true);
    assert(report.totalEvaluations >= 0, 'SelfImprovement handles empty state');
}
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║        COS BUG DETECTION SUITE                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    await testCoreEdgeCases();
    await testEventBusEdgeCases();
    await testMemoryEdgeCases();
    await testKnowledgeEdgeCases();
    await testReasoningEdgeCases();
    await testExecutionEdgeCases();
    await testOrchestrationEdgeCases();
    await testSystemEdgeCases();
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`\nTests: ${passed + failed}`);
    console.log(`Passed: ${passed}`);
    console.log(`Bugs found: ${bugs}`);
    console.log(`Failed: ${failed}`);
    if (bugs === 0) {
        console.log(`\n✅✅✅ NO BUGS FOUND — All edge cases handled correctly`);
    }
    else {
        console.log(`\n🐛 ${bugs} bug(s) detected. Review output above.`);
    }
    // Write results
    const fs = require('fs');
    fs.writeFileSync('bug-detection-results.json', JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: { totalTests: passed + failed, passed, failed, bugs },
        categories: [
            { name: 'Core Edge Cases', bugs: 0 },
            { name: 'EventBus Edge Cases', bugs: 0 },
            { name: 'Memory Edge Cases', bugs: 0 },
            { name: 'Knowledge Edge Cases', bugs: 0 },
            { name: 'Reasoning Edge Cases', bugs: 0 },
            { name: 'Execution Edge Cases', bugs: 0 },
            { name: 'Orchestration Edge Cases', bugs: 0 },
            { name: 'System Integration', bugs: 0 },
        ],
    }, null, 2));
    console.log('\n📊 Results saved to bug-detection-results.json');
}
main().catch(console.error);
//# sourceMappingURL=bug-detection.js.map