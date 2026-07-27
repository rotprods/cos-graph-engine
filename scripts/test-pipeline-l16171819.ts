// T-8.4: 40+ Tests for Pipeline L16 -> L17 -> L18 -> L19
// Network -> Social -> Bio -> Molecular pipeline

import { PipelineL16L17L18L19 } from '../packages/graph/src/pipeline-l16l17l18l19';
import { NetworkGraphEngine } from '../packages/graph/src/level16-network';
import { SocialGraphEngine } from '../packages/graph/src/level17-social';
import { BiologicalGraphEngine } from '../packages/graph/src/level18-biological';
import { MolecularGraphEngine } from '../packages/graph/src/level19-molecular';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

// ========== TEST: Pipeline Creation ==========
(function testPipelineCreation() {
  console.log('\n=== Pipeline Creation ===');
  const pipe = new PipelineL16L17L18L19();
  assert(pipe instanceof PipelineL16L17L18L19, 'Pipeline instantiated');
  assert(pipe.networkGraph instanceof NetworkGraphEngine, 'Has L16 Network');
  assert(pipe.socialGraph instanceof SocialGraphEngine, 'Has L17 Social');
  assert(pipe.biologicalGraph instanceof BiologicalGraphEngine, 'Has L18 Bio');
  assert(pipe.molecularGraph instanceof MolecularGraphEngine, 'Has L19 Molecular');
})();

// ========== TEST: Build Network Graph ==========
(function testBuildNetworkGraph() {
  console.log('\n=== L16: Build Network Graph ===');
  const pipe = new PipelineL16L17L18L19();
  pipe.buildNetworkGraph([
    { name: 'Web-1', type: 'server', healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 },
    { name: 'DB-1', type: 'database', healthy: true, region: 'us-east', latency: 10, throughput: 1000, cpu: 60, memory: 80, replicas: 1 },
    { name: 'Cache-1', type: 'cache', healthy: true, region: 'us-east', latency: 2, throughput: 5000, cpu: 30, memory: 90, replicas: 2 },
  ], []);

  assert(pipe.networkGraph.getNodes().length === 3, 'L16: 3 network nodes');
  const v = pipe.networkGraph.validate();
  assert(v.length === 0, 'L16: No validation errors');
})();

// ========== TEST: Network to Social ==========
(function testNetworkToSocial() {
  console.log('\n=== L17: Network -> Social ===');
  const pipe = new PipelineL16L17L18L19();
  pipe.buildNetworkGraph([
    { name: 'Web-1', type: 'server', healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 },
    { name: 'LB-1', type: 'load_balancer', healthy: true, region: 'us-east', latency: 5, throughput: 2000, cpu: 20, memory: 30, replicas: 2 },
  ], []);
  pipe.networkToSocial();

  assert(pipe.socialGraph.getNodes().length === 2, 'L17: 2 social personas created');
  assert(pipe.socialGraph.getNodes()[0].type === 'person', 'L17: server -> person');
  assert(pipe.socialGraph.getNodes()[1].type === 'company', 'L17: load_balancer -> company');
  const v = pipe.socialGraph.validate();
  assert(v.length === 0, 'L17: No validation errors');
})();

// ========== TEST: Social to Biological ==========
(function testSocialToBiological() {
  console.log('\n=== L18: Social -> Bio ===');
  const pipe = new PipelineL16L17L18L19();
  pipe.buildNetworkGraph([
    { name: 'Web-1', type: 'server', healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 },
    { name: 'DB-1', type: 'database', healthy: true, region: 'us-east', latency: 10, throughput: 1000, cpu: 60, memory: 80, replicas: 1 },
  ], []);
  pipe.networkToSocial();
  pipe.socialToBiological();

  assert(pipe.biologicalGraph.getNodes().length === 2, 'L18: 2 neurons created');
  const v = pipe.biologicalGraph.validate();
  assert(v.length === 0, 'L18: No validation errors');
})();

// ========== TEST: Bio to Molecular ==========
(function testBioToMolecular() {
  console.log('\n=== L19: Bio -> Molecular ===');
  const pipe = new PipelineL16L17L18L19();
  pipe.buildNetworkGraph([
    { name: 'Web-1', type: 'server', healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 },
    { name: 'DB-1', type: 'database', healthy: true, region: 'us-east', latency: 10, throughput: 1000, cpu: 60, memory: 80, replicas: 1 },
    { name: 'Cache-1', type: 'cache', healthy: true, region: 'us-east', latency: 2, throughput: 5000, cpu: 30, memory: 90, replicas: 2 },
  ], []);
  pipe.networkToSocial();
  pipe.socialToBiological();
  pipe.biologicalToMolecular();

  assert(pipe.molecularGraph.getAtoms().length === 3, 'L19: 3 atoms created');
  assert(pipe.molecularGraph.getAtoms()[0].element === 'C', 'L19: First atom is Carbon');
  const v = pipe.molecularGraph.validate();
  assert(v.length === 0, 'L19: No validation errors');
})();

// ========== TEST: End-to-End Pipeline ==========
(function testEndToEnd() {
  console.log('\n=== E2E: Full Pipeline ===');
  const pipe = new PipelineL16L17L18L19();
  const result = pipe.runPipeline([
    { name: 'Web-1', type: 'server', healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 },
    { name: 'LB-1', type: 'load_balancer', healthy: true, region: 'us-east', latency: 5, throughput: 2000, cpu: 20, memory: 30, replicas: 2 },
    { name: 'DB-1', type: 'database', healthy: true, region: 'us-east', latency: 10, throughput: 1000, cpu: 60, memory: 80, replicas: 1 },
    { name: 'Cache-1', type: 'cache', healthy: true, region: 'us-east', latency: 2, throughput: 5000, cpu: 30, memory: 90, replicas: 2 },
  ], []);

  assert(result.networkGraph.getNodes().length === 4, 'E2E: 4 network nodes');
  assert(result.socialGraph.getNodes().length === 4, 'E2E: 4 social personas');
  assert(result.biologicalGraph.getNodes().length === 4, 'E2E: 4 neurons');
  assert(result.molecularGraph.getAtoms().length === 4, 'E2E: 4 atoms');
  assert(result.metrics.l16.nodeCount === 4, 'E2E: L16 metrics');
  assert(result.metrics.l17.nodeCount === 4, 'E2E: L17 metrics');
  assert(result.metrics.l18.nodeCount === 4, 'E2E: L18 metrics');
  assert(result.metrics.l19.nodeCount === 4, 'E2E: L19 metrics');
})();

// ========== TEST: Build Demo ==========
(function testBuildDemo() {
  console.log('\n=== Demo: Build Demo Pipeline ===');
  const pipe = new PipelineL16L17L18L19();
  const demo = pipe.buildDemo();

  assert(demo.networkGraph.getNodes().length === 4, 'Demo: 4 network nodes');
  assert(demo.socialGraph.getNodes().length === 4, 'Demo: 4 social nodes');
  assert(demo.biologicalGraph.getNodes().length === 4, 'Demo: 4 bio nodes');
  assert(demo.molecularGraph.getAtoms().length === 4, 'Demo: 4 atoms');
})();

// ========== TEST: Empty Pipeline ==========
(function testEmptyPipeline() {
  console.log('\n=== Edge: Empty Pipeline ===');
  const pipe = new PipelineL16L17L18L19();
  const result = pipe.runPipeline([], []);

  assert(result.networkGraph.getNodes().length === 0, 'Empty: 0 network nodes');
  assert(result.socialGraph.getNodes().length === 0, 'Empty: 0 social nodes');
  assert(result.biologicalGraph.getNodes().length === 0, 'Empty: 0 bio nodes');
  assert(result.molecularGraph.getAtoms().length === 0, 'Empty: 0 atoms');
  assert(result.metrics.l16.nodeCount === 0, 'Empty: L16 metrics 0');
  assert(result.metrics.l17.nodeCount === 0, 'Empty: L17 metrics 0');
})();

// ========== TEST: Single Node ==========
(function testSingleNode() {
  console.log('\n=== Edge: Single Network Node ===');
  const pipe = new PipelineL16L17L18L19();
  const result = pipe.runPipeline([
    { name: 'Web-1', type: 'server', healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 },
  ], []);

  assert(result.socialGraph.getNodes().length === 1, 'Single: 1 social');
  assert(result.biologicalGraph.getNodes().length === 1, 'Single: 1 neuron');
  assert(result.molecularGraph.getAtoms().length === 1, 'Single: 1 atom');
  const v = pipe.validate();
  assert(v.l16.length === 0, 'Single: L16 clean');
  assert(v.l17.length === 0, 'Single: L17 clean');
  assert(v.l18.length === 0, 'Single: L18 clean');
  assert(v.l19.length === 0, 'Single: L19 clean');
})();

// ========== TEST: Access Underlying Engines ==========
(function testAccessors() {
  console.log('\n=== Access: Engine Getters ===');
  const pipe = new PipelineL16L17L18L19();
  pipe.buildNetworkGraph([
    { name: 'Web-1', type: 'server', healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 },
  ], []);

  assert(pipe.getNetworkGraph() instanceof NetworkGraphEngine, 'Access: getNetworkGraph');
  assert(pipe.getSocialGraph() instanceof SocialGraphEngine, 'Access: getSocialGraph');
  assert(pipe.getBiologicalGraph() instanceof BiologicalGraphEngine, 'Access: getBiologicalGraph');
  assert(pipe.getMolecularGraph() instanceof MolecularGraphEngine, 'Access: getMolecularGraph');
})();

// ========== TEST: Network with Edges ==========
(function testWithEdges() {
  console.log('\n=== Edge: Network with Edges ===');
  const pipe = new PipelineL16L17L18L19();
  const n1 = pipe.networkGraph.addNode({ name: 'Web-1', type: 'server', healthy: true, region: 'us-east', latency: 15, throughput: 500, cpu: 45, memory: 60, replicas: 3 });
  const n2 = pipe.networkGraph.addNode({ name: 'DB-1', type: 'database', healthy: true, region: 'us-east', latency: 10, throughput: 1000, cpu: 60, memory: 80, replicas: 1 });
  pipe.networkGraph.addEdge(n1, n2, 'connects_to');

  const nodes = pipe.networkGraph.getNodes();
  assert(nodes.length === 2, 'Edges: 2 nodes created');
  const v = pipe.networkGraph.validate();
  assert(v.length === 0, 'Edges: No validation errors');
})();

// ========== REPORT ==========
console.log(`\n=== Pipeline L16-L17-L18-L19 Report ===`);
console.log(`Passed: ${p}, Failed: ${f}`);
if (f > 0) process.exit(1);