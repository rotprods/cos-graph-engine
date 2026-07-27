"use strict";
// T-8.3: 40+ Tests for Pipeline L12 -> L13 -> L14 -> L15
// Memory -> Agent -> Tool -> Workflow pipeline
Object.defineProperty(exports, "__esModule", { value: true });
const pipeline_l12l13l14l15_1 = require("../packages/graph/src/pipeline-l12l13l14l15");
const level12_memory_1 = require("../packages/graph/src/level12-memory");
const level13_agent_1 = require("../packages/graph/src/level13-agent");
const level14_tool_1 = require("../packages/graph/src/level14-tool");
const level15_workflow_1 = require("../packages/graph/src/level15-workflow");
let p = 0, f = 0;
function assert(cond, msg) { if (cond) {
    p++;
}
else {
    f++;
    console.error(`  ❌ ${msg}`);
} }
// ========== TEST: Pipeline Creation ==========
(function testPipelineCreation() {
    console.log('\n=== Pipeline Creation ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    assert(pipe instanceof pipeline_l12l13l14l15_1.PipelineL12L13L14L15, 'Pipeline instantiated');
    assert(pipe.memoryGraph instanceof level12_memory_1.MemoryGraphEngine, 'Has L12 Memory');
    assert(pipe.agentGraph instanceof level13_agent_1.AgentGraphEngine, 'Has L13 Agent');
    assert(pipe.toolGraph instanceof level14_tool_1.ToolGraphEngine, 'Has L14 Tool');
    assert(pipe.workflowGraph instanceof level15_workflow_1.WorkflowGraphEngine, 'Has L15 Workflow');
})();
// ========== TEST: Build Memory Graph ==========
(function testBuildMemoryGraph() {
    console.log('\n=== L12: Build Memory Graph ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    pipe.buildMemoryGraph([
        { name: 'Chat', type: 'conversation', content: 'User chat', confidence: 0.9 },
        { name: 'Topic', type: 'topic', content: 'Main topic', confidence: 0.8 },
        { name: 'Entity', type: 'entity', content: 'Important entity', confidence: 0.85 },
    ], []);
    assert(pipe.memoryGraph.getNodes().length === 3, 'L12: 3 memory nodes');
    const v = pipe.memoryGraph.validate();
    assert(v.length === 0, 'L12: No validation errors');
})();
// ========== TEST: Memory to Agent ==========
(function testMemoryToAgent() {
    console.log('\n=== L13: Memory -> Agent ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    pipe.buildMemoryGraph([
        { name: 'Chat', type: 'conversation', content: 'User chat', confidence: 0.9 },
        { name: 'Topic', type: 'topic', content: 'Main topic', confidence: 0.8 },
        { name: 'Fact', type: 'fact', content: 'Known fact', confidence: 0.85 },
    ], []);
    pipe.memoryToAgent();
    assert(pipe.agentGraph.getNodes().length === 3, 'L13: 3 agents created');
    assert(pipe.agentGraph.getEdges().length >= 2, 'L13: Delegation edges created');
    const v = pipe.agentGraph.validate();
    assert(v.length === 0, 'L13: No validation errors');
})();
// ========== TEST: Agent to Tool ==========
(function testAgentToTool() {
    console.log('\n=== L14: Agent -> Tool ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    pipe.buildMemoryGraph([
        { name: 'Chat', type: 'conversation', content: 'Chat', confidence: 0.9 },
        { name: 'Topic', type: 'topic', content: 'Topic', confidence: 0.8 },
    ], []);
    pipe.memoryToAgent();
    pipe.agentToTool();
    assert(pipe.toolGraph.getNodes().length >= 2, 'L14: Tools created from agent capabilities');
    const v = pipe.toolGraph.validate();
    assert(v.length === 0, 'L14: No validation errors');
})();
// ========== TEST: Tool to Workflow ==========
(function testToolToWorkflow() {
    console.log('\n=== L15: Tool -> Workflow ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    pipe.buildMemoryGraph([
        { name: 'Chat', type: 'conversation', content: 'Chat', confidence: 0.9 },
        { name: 'Topic', type: 'topic', content: 'Topic', confidence: 0.8 },
    ], []);
    pipe.memoryToAgent();
    pipe.agentToTool();
    pipe.toolToWorkflow();
    assert(pipe.workflowGraph.getNodes().length >= 3, 'L15: Workflow nodes (trigger + tools + end)');
    assert(pipe.workflowGraph.getEdges().length >= 2, 'L15: Workflow edges');
    const v = pipe.workflowGraph.validate();
    assert(v.length === 0, 'L15: No validation errors');
})();
// ========== TEST: End-to-End Pipeline ==========
(function testEndToEnd() {
    console.log('\n=== E2E: Full Pipeline ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    const result = pipe.runPipeline([
        { name: 'Chat', type: 'conversation', content: 'Chat', confidence: 0.9 },
        { name: 'Topic', type: 'topic', content: 'Topic', confidence: 0.8 },
        { name: 'Entity', type: 'entity', content: 'Entity', confidence: 0.85 },
        { name: 'Fact', type: 'fact', content: 'Fact', confidence: 0.75 },
    ], []);
    assert(result.memoryGraph.getNodes().length === 4, 'E2E: 4 memory nodes');
    assert(result.agentGraph.getNodes().length === 4, 'E2E: 4 agents');
    assert(result.toolGraph.getNodes().length >= 4, 'E2E: 4+ tools');
    assert(result.workflowGraph.getNodes().length >= 3, 'E2E: Workflow nodes');
    assert(result.executionPath.length > 0, 'E2E: Execution path present');
    assert(result.metrics.l12.nodeCount === 4, 'E2E: L12 metrics');
    assert(result.metrics.l13.nodeCount === 4, 'E2E: L13 metrics');
    assert(result.metrics.l14.nodeCount >= 4, 'E2E: L14 metrics');
    assert(result.metrics.l15.nodeCount >= 3, 'E2E: L15 metrics');
})();
// ========== TEST: Build Demo ==========
(function testBuildDemo() {
    console.log('\n=== Demo: Build Demo Pipeline ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    const demo = pipe.buildDemo();
    assert(demo.memoryGraph.getNodes().length === 5, 'Demo: 5 memory nodes');
    assert(demo.agentGraph.getNodes().length === 5, 'Demo: 5 agents');
    assert(demo.toolGraph.getNodes().length >= 5, 'Demo: 5+ tools');
    assert(demo.workflowGraph.getNodes().length >= 3, 'Demo: Workflow nodes');
})();
// ========== TEST: Empty Pipeline ==========
(function testEmptyPipeline() {
    console.log('\n=== Edge: Empty Pipeline ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    const result = pipe.runPipeline([], []);
    assert(result.memoryGraph.getNodes().length === 0, 'Empty: 0 memory nodes');
    assert(result.agentGraph.getNodes().length === 0, 'Empty: 0 agents');
    assert(result.toolGraph.getNodes().length === 0, 'Empty: 0 tools');
    assert(result.workflowGraph.getNodes().length === 0, 'Empty: 0 workflow nodes');
    assert(result.metrics.l12.nodeCount === 0, 'Empty: L12 metrics 0');
    assert(result.metrics.l13.nodeCount === 0, 'Empty: L13 metrics 0');
})();
// ========== TEST: Single Memory Node ==========
(function testSingleNode() {
    console.log('\n=== Edge: Single Memory Node ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    const result = pipe.runPipeline([
        { name: 'Chat', type: 'conversation', content: 'Chat', confidence: 0.9 },
    ], []);
    assert(result.agentGraph.getNodes().length === 1, 'Single: 1 agent');
    assert(result.workflowGraph.getNodes().length >= 2, 'Single: trigger + tool + end');
    const v = pipe.validate();
    assert(v.l12.length === 0, 'Single: L12 clean');
    assert(v.l13.length === 0, 'Single: L13 clean');
    assert(v.l14.length === 0, 'Single: L14 clean');
    assert(v.l15.length === 0, 'Single: L15 clean');
})();
// ========== TEST: Access Underlying Engines ==========
(function testAccessors() {
    console.log('\n=== Access: Engine Getters ===');
    const pipe = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
    pipe.buildMemoryGraph([
        { name: 'Chat', type: 'conversation', content: 'Chat', confidence: 0.9 },
    ], []);
    assert(pipe.getMemoryGraph() instanceof level12_memory_1.MemoryGraphEngine, 'Access: getMemoryGraph');
    assert(pipe.getAgentGraph() instanceof level13_agent_1.AgentGraphEngine, 'Access: getAgentGraph');
    assert(pipe.getToolGraph() instanceof level14_tool_1.ToolGraphEngine, 'Access: getToolGraph');
    assert(pipe.getWorkflowGraph() instanceof level15_workflow_1.WorkflowGraphEngine, 'Access: getWorkflowGraph');
})();
// ========== REPORT ==========
console.log(`\n=== Pipeline L12-L13-L14-L15 Report ===`);
console.log(`Passed: ${p}, Failed: ${f}`);
if (f > 0)
    process.exit(1);
//# sourceMappingURL=test-pipeline-l12131415.js.map