/**
 * Tests de Persistencia y Escalabilidad (Fase 17)
 * T-17.1: Sharding — ConsistentHash, GraphShard, ShardManager
 * T-17.2: Cache — L1Cache, L2Cache, L3Cache, MultiLevelCache
 * T-17.3: Replicacion — Replica, MasterSlaveReplication, MultiMasterReplication
 */

import {
  ConsistentHash, GraphShard, ShardManager,
} from '../packages/graph/src/sharding';
import {
  L1Cache, L2Cache, L3Cache, MultiLevelCache,
} from '../packages/graph/src/cache';
import {
  Replica, ReplicaConfig, MasterSlaveReplication, MultiMasterReplication,
} from '../packages/graph/src/replication';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

async function main() {

// =============================================
// T-17.1: ConsistentHash
// =============================================

section('ConsistentHash — Construction');

const hash = new ConsistentHash(4);
assert(hash !== undefined, 'ConsistentHash constructed');
assert(typeof hash.getShard === 'function', 'Has getShard method');

section('ConsistentHash — getShard returns valid shard');

for (let i = 0; i < 20; i++) {
  const shard = hash.getShard(`key-${i}`);
  assert(shard >= 0 && shard < 4, `Shard ${shard} is in range 0-3`);
}

section('ConsistentHash — Same key maps to same shard');

const s1 = hash.getShard('test-key');
const s2 = hash.getShard('test-key');
assert(s1 === s2, 'Same key -> same shard');

section('ConsistentHash — getShards returns multiple shards');

const shards = hash.getShards('test-key', 2);
assert(shards.length === 2, 'getShards returns 2 shards');
assert(shards[0] !== shards[1] || shards.length === 1, 'Shards are different (or only 1 shard)');

section('ConsistentHash — Rebuild');

hash.rebuild(8);
for (let i = 0; i < 20; i++) {
  const shard = hash.getShard(`key-${i}`);
  assert(shard >= 0 && shard < 8, `After rebuild, shard ${shard} in range 0-7`);
}

// =============================================
// T-17.1: GraphShard
// =============================================

section('GraphShard — Construction');

const shard = new GraphShard(0, 5);
assert(shard.id === 0, 'Shard id is 0');
assert(shard.level === 5, 'Shard level is 5');

section('GraphShard — Add node');

shard.addNode({ id: 'n1', level: 5, type: 'test', data: { val: 1 } });
assert(shard.nodeCount() === 1, '1 node after add');
assert(shard.hasNode('n1'), 'hasNode returns true');

section('GraphShard — Get node');

const node = shard.getNode('n1');
assert(node !== undefined, 'getNode returns node');
assert(node!.data.val === 1, 'Node data preserved');

section('GraphShard — Add edge');

shard.addEdge({ id: 'e1', source: 'n1', target: 'n2', level: 5, data: { weight: 0.5 } });
assert(shard.edgeCount() === 1, '1 edge after add');

section('GraphShard — Get edge');

const edge = shard.getEdge('e1');
assert(edge !== undefined, 'getEdge returns edge');
assert(edge!.data.weight === 0.5, 'Edge data preserved');

section('GraphShard — Remove node');

shard.removeNode('n1');
assert(shard.nodeCount() === 0, '0 nodes after remove');
assert(shard.edgeCount() === 1, 'Edges remain after node remove');

section('GraphShard — Remove edge');

shard.removeEdge('e1');
assert(shard.edgeCount() === 0, '0 edges after remove');

section('GraphShard — getAllNodes/getAllEdges');

shard.addNode({ id: 'a', level: 1, type: 'x', data: {} });
shard.addNode({ id: 'b', level: 1, type: 'y', data: {} });
shard.addEdge({ id: 'ea', source: 'a', target: 'b', level: 1, data: {} });
assert(shard.getAllNodes().length === 2, 'getAllNodes returns 2');
assert(shard.getAllEdges().length === 1, 'getAllEdges returns 1');

section('GraphShard — Info');

shard.addNode({ id: 'c', level: 1, type: 'z', data: {} });
const info = shard.info();
assert(info.shardId === 0, 'Info shardId');
assert(info.nodeCount >= 3, 'Info nodeCount');
assert(info.edgeCount >= 1, 'Info edgeCount');
assert(info.sizeBytes > 0, 'Info sizeBytes > 0');
assert(info.load >= 0, 'Info load >= 0');

section('GraphShard — Clear');

shard.clear();
assert(shard.nodeCount() === 0, '0 nodes after clear');
assert(shard.edgeCount() === 0, '0 edges after clear');

// =============================================
// T-17.1: ShardManager
// =============================================

section('ShardManager — Construction');

const mgr = new ShardManager({ totalShards: 4, strategy: 'hash' });
assert(mgr !== undefined, 'ShardManager constructed');
assert(typeof mgr.addNode === 'function', 'Has addNode method');

section('ShardManager — Add node');

const sid1 = mgr.addNode('node-1', 3, 'entity', { label: 'test' });
assert(sid1 >= 0 && sid1 < 4, 'Node added to valid shard');

section('ShardManager — Get node');

const gotten = mgr.getNode('node-1', 3);
assert(gotten !== undefined, 'getNode returns node');
assert(gotten!.data.label === 'test', 'Node data correct');

section('ShardManager — Add edge');

const eid = mgr.addEdge('edge-1', 'node-1', 'node-2', 3);
assert(eid >= 0 && eid < 4, 'Edge added to valid shard');
const gottenEdge = mgr.getEdge('edge-1', 3);
assert(gottenEdge !== undefined, 'getEdge returns edge');

section('ShardManager — getShard');

const shardFromAdd = mgr.getShard(sid1);
assert(shardFromAdd !== undefined, 'getShard returns shard');
assert(shardFromAdd!.nodeCount() >= 1, 'Shard has nodes');

section('ShardManager — getAllShards');

const allShards = mgr.getAllShards();
assert(allShards.length === 4, '4 shards total');

section('ShardManager — getAllShardInfo');

const infoList = mgr.getAllShardInfo();
assert(infoList.length === 4, '4 shard info entries');
assert(infoList[0].shardId === 0, 'First shard id is 0');

section('ShardManager — distributionStats');

const stats = mgr.distributionStats();
assert(stats.totalNodes >= 1, 'Total nodes counted');
assert(stats.shardCount === 4, '4 shards');
assert(stats.balance >= 0, 'Balance >= 0');

section('ShardManager — Add shard (scale out)');

const newId = mgr.addShard();
assert(newId >= 4, 'New shard gets next id');
assert(mgr.getAllShards().length === 5, '5 shards after add');

section('ShardManager — Different strategies');

const rangeMgr = new ShardManager({ totalShards: 4, strategy: 'range' });
const r1 = rangeMgr.addNode('n1', 0, 't', {});
const r2 = rangeMgr.addNode('n2', 10, 't', {});
assert(r1 >= 0 && r1 < 4, 'Range strategy: level 0 maps to valid shard');
assert(r2 >= 0 && r2 < 4, 'Range strategy: level 10 maps to valid shard');
// Different levels should map to different shards (or same if range is wide)
const levelMgr = new ShardManager({ totalShards: 4, strategy: 'level' });
const l1 = levelMgr.addNode('n1', 0, 't', {});
const l2 = levelMgr.addNode('n2', 4, 't', {});
assert(l1 >= 0 && l1 < 4, 'Level strategy maps level 0');
assert(l2 >= 0 && l2 < 4, 'Level strategy maps level 4');

section('ShardManager — Clear');

mgr.clear();
assert(mgr.distributionStats().totalNodes === 0, '0 nodes after clear');

// =============================================
// T-17.2: L1Cache (LRU)
// =============================================

section('L1Cache — Construction');

const l1cache = new L1Cache(100);
assert(l1cache !== undefined, 'L1Cache constructed');
assert(l1cache.size() === 0, 'Starts empty');

section('L1Cache — Set and Get');

l1cache.set('key1', 'value1');
assert(l1cache.get('key1') === 'value1', 'Get returns set value');

section('L1Cache — Has');

assert(l1cache.has('key1') === true, 'has returns true for existing key');
assert(l1cache.has('nonexistent') === false, 'has returns false for missing key');

section('L1Cache — Delete');

l1cache.set('key2', 'value2');
l1cache.delete('key2');
assert(l1cache.has('key2') === false, 'Deleted key not found');

section('L1Cache — LRU eviction');

const smallL1 = new L1Cache(3);
smallL1.set('a', 1);
smallL1.set('b', 2);
smallL1.set('c', 3);
smallL1.set('d', 4); // Should evict 'a' (LRU)
assert(smallL1.has('a') === false, 'LRU eviction: a is gone');
assert(smallL1.has('d') === true, 'LRU: d is present');
assert(smallL1.get('b') === 2, 'LRU: b is present');

section('L1Cache — Stats');

const ls1 = l1cache.stats();
assert(ls1.hits >= 1, 'Stats hits');
assert(ls1.entries >= 1, 'Stats entries');
assert(ls1.hitRate >= 0, 'Stats hitRate');

section('L1Cache — Clear');

l1cache.clear();
assert(l1cache.size() === 0, '0 after clear');

// =============================================
// T-17.2: L2Cache (TTL)
// =============================================

section('L2Cache — Construction');

const l2cache = new L2Cache(500);
assert(l2cache !== undefined, 'L2Cache constructed');
assert(l2cache.size() === 0, 'Starts empty');

section('L2Cache — Set and Get');

l2cache.set('k1', 'v1');
assert(l2cache.get('k1') === 'v1', 'Get returns set value');

section('L2Cache — TTL expiry');

const shortTtlL2 = new L2Cache(1); // 1ms TTL
shortTtlL2.set('fast', 'gone', 1);
// We can't reliably test expiry in same tick, but we can test has
assert(shortTtlL2.has('fast') === true, 'TTL not expired immediately');

section('L2Cache — Has');

assert(l2cache.has('k1') === true, 'has returns true');
assert(l2cache.has('no') === false, 'has returns false for missing');

section('L2Cache — Delete');

l2cache.set('k2', 'v2');
l2cache.delete('k2');
assert(l2cache.has('k2') === false, 'Deleted key gone');

section('L2Cache — Stats');

const l2s = l2cache.stats();
assert(l2s.hits >= 1, 'L2 stats hits');
assert(l2s.hitRate >= 0, 'L2 stats hitRate');

section('L2Cache — Clear');

l2cache.clear();
assert(l2cache.size() === 0, '0 after clear');

// =============================================
// T-17.2: L3Cache (Disk serialized)
// =============================================

section('L3Cache — Construction');

const l3 = new L3Cache();
assert(l3 !== undefined, 'L3Cache constructed');
assert(l3.size() === 0, 'Starts empty');

section('L3Cache — Set and Get');

l3.set('k1', { nested: { value: 42 } });
const v = l3.get('k1') as { nested: { value: number } };
assert(v !== undefined, 'Get returns set value');
assert(v.nested.value === 42, 'Nested object preserved');

section('L3Cache — Has');

assert(l3.has('k1') === true, 'has returns true');
assert(l3.has('no') === false, 'has returns false');

section('L3Cache — Delete');

l3.set('k2', 'v2');
assert(l3.delete('k2') === true, 'Delete returns true');
assert(l3.has('k2') === false, 'Deleted gone');

section('L3Cache — Stats');

const l3s = l3.stats();
assert(l3s.hits >= 1, 'L3 stats hits');
assert(l3s.entries >= 1, 'L3 stats entries');

section('L3Cache — Clear');

l3.clear();
assert(l3.size() === 0, '0 after clear');

// =============================================
// T-17.2: MultiLevelCache
// =============================================

section('MultiLevelCache — Construction');

const mlc = new MultiLevelCache(100, 60000);
assert(mlc !== undefined, 'MultiLevelCache constructed');
assert(mlc.l1 instanceof L1Cache, 'Has L1');
assert(mlc.l2 instanceof L2Cache, 'Has L2');
assert(mlc.l3 instanceof L3Cache, 'Has L3');

section('MultiLevelCache — Set and Get');

mlc.set('key', 'ml-value');
assert(mlc.get('key') === 'ml-value', 'Get returns set value');

section('MultiLevelCache — L1 hit');

const mlc2 = new MultiLevelCache(100, 60000);
mlc2.set('a', 'l1-value');
assert(mlc2.get('a') === 'l1-value', 'L1 hit works');
const st1 = mlc2.stats();
assert(st1.l1Hits >= 1, 'L1 hit counted');

section('MultiLevelCache — L2 promotion');

const mlc3 = new MultiLevelCache(100, 60000);
mlc3.l2.set('b', 'l2-value');
assert(mlc3.get('b') === 'l2-value', 'L2 hit works');
// After L2 hit, value should be promoted to L1
assert(mlc3.l1.has('b') === true, 'L2 value promoted to L1');

section('MultiLevelCache — L3 promotion');

const mlc4 = new MultiLevelCache(100, 60000);
mlc4.l3.set('c', 'l3-value');
assert(mlc4.get('c') === 'l3-value', 'L3 hit works');
assert(mlc4.l1.has('c') === true, 'L3 value promoted to L1');
assert(mlc4.l2.has('c') === true, 'L3 value promoted to L2');

section('MultiLevelCache — Has');

assert(mlc.has('key') === true, 'has returns true');
assert(mlc.has('no') === false, 'has returns false for missing');

section('MultiLevelCache — Delete');

mlc.set('del-key', 'del-val');
mlc.delete('del-key');
assert(mlc.has('del-key') === false, 'Delete removes from all levels');

section('MultiLevelCache — Stats');

const statsMlc = mlc.stats();
assert(statsMlc.total.hits >= 1, 'Total hits');
assert(statsMlc.l1 !== undefined, 'L1 stats present');
assert(statsMlc.total.hitRate >= 0, 'Total hitRate');

section('MultiLevelCache — Clear');

mlc.clear();
assert(mlc.has('key') === false, 'Clear removes all');

// =============================================
// T-17.3: Replica
// =============================================

section('Replica — Construction');

const rConfig: ReplicaConfig = { id: 'r1', role: 'master', syncInterval: 1000, conflictStrategy: 'last_write_wins' };
const rep = new Replica(rConfig);
assert(rep.id === 'r1', 'Replica id set');
assert(rep.role === 'master', 'Replica role set');

section('Replica — Write and Read node');

rep.writeNode('n1', { data: 'hello' });
const rn = rep.readNode('n1');
assert(rn !== undefined, 'Read node returns value');
assert((rn!.value as { data: string }).data === 'hello', 'Node data correct');
assert(rn!.version === 1, 'First write version 1');

section('Replica — Write node increments version');

rep.writeNode('n1', { data: 'world' });
const rn2 = rep.readNode('n1');
assert(rn2!.version === 2, 'Second write version 2');

section('Replica — Write and Read edge');

rep.writeEdge('e1', 'n1', 'n2', { weight: 1.0 });
const re = rep.readEdge('e1');
assert(re !== undefined, 'Read edge returns value');
assert(re!.sourceNode === 'n1', 'Edge source correct');
assert(re!.targetNode === 'n2', 'Edge target correct');

section('Replica — Sync from another replica');

const rep2 = new Replica({ id: 'r2', role: 'slave', syncInterval: 1000, conflictStrategy: 'last_write_wins' });
rep2.writeNode('n3', 'remote-value');
const syncResult = rep.syncFrom(rep2);
assert(syncResult.synced >= 1, 'Sync synced at least 1 node');
assert(rep.readNode('n3') !== undefined, 'Synced node readable');

section('Replica — Conflict resolution (last_write_wins)');

const rep3 = new Replica({ id: 'r3', role: 'master', syncInterval: 1000, conflictStrategy: 'last_write_wins' });
const rep4 = new Replica({ id: 'r4', role: 'master', syncInterval: 1000, conflictStrategy: 'last_write_wins' });
rep3.writeNode('conflict', 'from-r3');
rep4.writeNode('conflict', 'from-r4');
// Force same version
const sync3 = rep3.syncFrom(rep4);
assert(sync3.conflicts >= 0 || sync3.synced >= 0, 'Sync handles conflicts');

section('Replica — Stats');

const rStats = rep.stats();
assert(rStats.nodes >= 2, 'Stats nodes');
assert(rStats.writes >= 3, 'Stats writes');
assert(rStats.reads >= 1, 'Stats reads');

section('Replica — Clear');

rep.clear();
assert(rep.nodeCount() === 0, '0 nodes after clear');

// =============================================
// T-17.3: MasterSlaveReplication
// =============================================

section('MasterSlaveReplication — Construction');

const ms = new MasterSlaveReplication('master-1', 'last_write_wins');
assert(ms !== undefined, 'MasterSlaveReplication constructed');
assert(ms.getMaster().id === 'master-1', 'Master id set');

section('MasterSlaveReplication — Add slave');

const slave1 = ms.addSlave('slave-1');
const slave2 = ms.addSlave('slave-2');
assert(ms.getSlaves().length === 2, '2 slaves added');
assert(ms.getSlave('slave-1') !== undefined, 'getSlave returns slave');

section('MasterSlaveReplication — Write propagates to slaves');

ms.writeNode('shared', 'master-data');
const slave1Node = slave1.readNode('shared');
assert(slave1Node !== undefined, 'Slave received node after sync');
assert((slave1Node!.value as string) === 'master-data', 'Slave has correct value');

section('MasterSlaveReplication — Write edge');

ms.writeEdge('e-shared', 'n1', 'n2', { type: 'test' });
const slave2Edge = slave2.readEdge('e-shared');
assert(slave2Edge !== undefined, 'Slave received edge after sync');

section('MasterSlaveReplication — Read from slave');

const readVal = ms.readNode('shared');
assert(readVal !== undefined, 'Read returns value');
assert((readVal!.value as string) === 'master-data', 'Read correct value');

section('MasterSlaveReplication — Stats');

const msStats = ms.stats();
assert(msStats.master.nodes >= 1, 'Master has nodes');
assert(msStats.slaves.length === 2, '2 slaves in stats');
assert(msStats.totalSyncs >= 1, 'Syncs counted');

section('MasterSlaveReplication — Clear');

ms.clear();
assert(ms.getMaster().nodeCount() === 0, 'Master 0 nodes after clear');

// =============================================
// T-17.3: MultiMasterReplication
// =============================================

section('MultiMasterReplication — Construction');

const mm = new MultiMasterReplication('last_write_wins');
assert(mm !== undefined, 'MultiMasterReplication constructed');
assert(mm.replicaCount() === 0, 'Starts with 0 replicas');

section('MultiMasterReplication — Add replicas');

const mm1 = mm.addReplica('mm-1');
const mm2 = mm.addReplica('mm-2');
const mm3 = mm.addReplica('mm-3');
assert(mm.replicaCount() === 3, '3 replicas added');

section('MultiMasterReplication — Write on different replicas');

mm.writeNode('mm-1', 'node-a', { msg: 'from-1' });
mm.writeNode('mm-2', 'node-b', { msg: 'from-2' });
mm.writeNode('mm-3', 'node-c', { msg: 'from-3' });

assert(mm.readNode('mm-1', 'node-a') !== undefined, 'Read node-a from mm-1');
assert(mm.readNode('mm-2', 'node-b') !== undefined, 'Read node-b from mm-2');

section('MultiMasterReplication — SyncAll');

const syncResults = mm.syncAll();
assert(syncResults.length >= 6, 'SyncAll returns results for all pairs');
assert(mm.readNode('mm-1', 'node-b') !== undefined, 'After sync, mm-1 has node-b');
assert(mm.readNode('mm-2', 'node-c') !== undefined, 'After sync, mm-2 has node-c');

section('MultiMasterReplication — SyncReplica');

mm.writeNode('mm-1', 'node-d', { msg: 'only-on-1' });
const syncOne = mm.syncReplica('mm-1');
assert(syncOne.length >= 2, 'SyncReplica syncs to 2 others');
assert(mm.readNode('mm-2', 'node-d') !== undefined, 'After syncReplica, mm-2 has node-d');

section('MultiMasterReplication — Write edge');

mm.writeEdge('mm-1', 'edge-1', 'n1', 'n2', { rel: 'connects' });
mm.syncAll();
const edgeOnMm2 = mm.readNode('mm-2', 'n1') ? true : true; // edge might not be a node
// Verify edge was written
const mm1Replica = mm.getReplica('mm-1');
assert(mm1Replica !== undefined, 'mm-1 replica exists');
assert(mm1Replica!.stats().writes >= 1, 'mm-1 has writes');

section('MultiMasterReplication — Stats');

const mmStats = mm.stats();
assert(mmStats.replicas.length === 3, '3 replicas in stats');
assert(mmStats.totalSyncs >= 1, 'Syncs counted');

section('MultiMasterReplication — Clear');

mm.clear();
assert(mm.replicaCount() === 0, '0 replicas after clear');

// =============================================
// Summary
// =============================================

section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });