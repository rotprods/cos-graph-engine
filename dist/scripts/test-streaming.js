"use strict";
/**
 * Tests de Streaming y Reactividad en Tiempo Real (Fase 16)
 * T-16.1: GraphPatch, GraphPatchBuilder, PatchSerializer, GraphStream
 * T-16.2: Observable, GraphObserver, SubscriptionManager
 */
Object.defineProperty(exports, "__esModule", { value: true });
const streaming_1 = require("../packages/graph/src/streaming");
let passed = 0;
let failed = 0;
function assert(condition, msg) {
    if (condition) {
        passed++;
    }
    else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}
function section(name) { console.log(`\n=== ${name} ===`); }
async function main() {
    // =============================================
    // T-16.1: GraphPatchBuilder
    // =============================================
    section('GraphPatchBuilder — nodeAdded');
    const p1 = streaming_1.GraphPatchBuilder.nodeAdded(5, 'g1', 'n1', { label: 'test' });
    assert(p1.type === 'node_added', 'nodeAdded type');
    assert(p1.level === 5, 'nodeAdded level');
    assert(p1.graphId === 'g1', 'nodeAdded graphId');
    assert(p1.nodeId === 'n1', 'nodeAdded nodeId');
    assert(p1.data?.label === 'test', 'nodeAdded data');
    assert(p1.id.startsWith('patch_'), 'nodeAdded has id');
    assert(p1.timestamp > 0, 'nodeAdded timestamp');
    section('GraphPatchBuilder — nodeRemoved');
    const p2 = streaming_1.GraphPatchBuilder.nodeRemoved(3, 'g2', 'n2');
    assert(p2.type === 'node_removed', 'nodeRemoved type');
    assert(p2.nodeId === 'n2', 'nodeRemoved nodeId');
    section('GraphPatchBuilder — edgeAdded/edgeRemoved');
    const p3 = streaming_1.GraphPatchBuilder.edgeAdded(7, 'g3', 'e1', { weight: 0.5 });
    assert(p3.type === 'edge_added', 'edgeAdded type');
    assert(p3.edgeId === 'e1', 'edgeAdded edgeId');
    assert(p3.data?.weight === 0.5, 'edgeAdded data');
    const p4 = streaming_1.GraphPatchBuilder.edgeRemoved(7, 'g3', 'e1');
    assert(p4.type === 'edge_removed', 'edgeRemoved type');
    section('GraphPatchBuilder — nodeUpdated/graphCreated/graphDeleted/stateChanged');
    const p5 = streaming_1.GraphPatchBuilder.nodeUpdated(8, 'g4', 'n3', { value: 42 });
    assert(p5.type === 'node_updated', 'nodeUpdated type');
    const p6 = streaming_1.GraphPatchBuilder.graphCreated(1, 'g5');
    assert(p6.type === 'graph_created', 'graphCreated type');
    const p7 = streaming_1.GraphPatchBuilder.graphDeleted(1, 'g5');
    assert(p7.type === 'graph_deleted', 'graphDeleted type');
    const p8 = streaming_1.GraphPatchBuilder.stateChanged(0, 'g6', { status: 'ready' });
    assert(p8.type === 'state_changed', 'stateChanged type');
    assert(p8.data?.status === 'ready', 'stateChanged data');
    // =============================================
    // T-16.1: PatchSerializer
    // =============================================
    section('PatchSerializer — serialize/deserialize');
    const json = streaming_1.PatchSerializer.serialize(p1);
    assert(typeof json === 'string', 'serialize returns string');
    const deserialized = streaming_1.PatchSerializer.deserialize(json);
    assert(deserialized.type === 'node_added', 'deserialize preserves type');
    assert(deserialized.nodeId === 'n1', 'deserialize preserves nodeId');
    assert(deserialized.data?.label === 'test', 'deserialize preserves data');
    section('PatchSerializer — invalid deserialize');
    try {
        streaming_1.PatchSerializer.deserialize('{}');
        assert(false, 'Should throw on empty object');
    }
    catch (e) {
        assert(e.message.includes('missing required fields'), 'Empty object throws');
    }
    try {
        streaming_1.PatchSerializer.deserialize('{"id":"x","type":"invalid","level":0,"graphId":"g"}');
        assert(false, 'Should throw on invalid type');
    }
    catch (e) {
        assert(e.message.includes('Invalid patch type'), 'Invalid type throws');
    }
    section('PatchSerializer — batch serialize/deserialize');
    const batch = [p1, p2, p3];
    const batchJson = streaming_1.PatchSerializer.serializeBatch(batch);
    assert(typeof batchJson === 'string', 'batch serialize returns string');
    const batchBack = streaming_1.PatchSerializer.deserializeBatch(batchJson);
    assert(batchBack.length === 3, 'batch deserialize returns 3 patches');
    assert(batchBack[0].type === 'node_added', 'batch[0] correct');
    assert(batchBack[1].type === 'node_removed', 'batch[1] correct');
    assert(batchBack[2].type === 'edge_added', 'batch[2] correct');
    section('PatchSerializer — compress');
    const updates = [
        streaming_1.GraphPatchBuilder.nodeUpdated(5, 'g1', 'n1', { a: 1 }),
        streaming_1.GraphPatchBuilder.nodeUpdated(5, 'g1', 'n1', { b: 2 }),
        streaming_1.GraphPatchBuilder.nodeUpdated(5, 'g1', 'n1', { c: 3 }),
        streaming_1.GraphPatchBuilder.nodeRemoved(5, 'g1', 'n2'),
    ];
    const compressed = streaming_1.PatchSerializer.compress(updates);
    assert(compressed.length <= updates.length, 'Compression reduces or equal count');
    // The three node_updated on same nodeId should merge into one
    const mergedUpdates = compressed.filter(p => p.type === 'node_updated' && p.nodeId === 'n1');
    assert(mergedUpdates.length >= 1, 'Merged updates exist');
    assert(mergedUpdates[0].data?.a === 1, 'Merged preserves a');
    assert(mergedUpdates[0].data?.b === 2, 'Merged preserves b');
    assert(mergedUpdates[0].data?.c === 3, 'Merged preserves c');
    // =============================================
    // T-16.1: GraphStream
    // =============================================
    section('GraphStream — Construction');
    const stream = new streaming_1.GraphStream(100);
    assert(stream !== undefined, 'GraphStream can be constructed');
    assert(typeof stream.connect === 'function', 'Has connect method');
    assert(typeof stream.sendPatch === 'function', 'Has sendPatch method');
    assert(typeof stream.getHistory === 'function', 'Has getHistory method');
    section('GraphStream — Connect and stats');
    const conn = stream.connect();
    assert(conn.id.startsWith('conn_'), 'Connection has id');
    assert(conn.active === true, 'Connection starts active');
    assert(conn.connectedAt > 0, 'Connection has timestamp');
    const stats = stream.stats();
    assert(stats.totalPatches === 0, 'Starts with 0 patches');
    assert(stats.activeConnections === 1, '1 active connection');
    section('GraphStream — Send patch and history');
    stream.sendPatch(p1);
    const history = stream.getHistory();
    assert(history.length === 1, 'History has 1 patch');
    assert(history[0].type === 'node_added', 'History contains sent patch');
    section('GraphStream — Send multiple patches');
    stream.sendPatch(p2);
    stream.sendPatch(p3);
    assert(stream.getHistory().length === 3, 'History has 3 patches');
    section('GraphStream — History with filter');
    const filtered = stream.getHistory({ types: ['node_removed'] });
    assert(filtered.length === 1, 'Filter by type works');
    assert(filtered[0].type === 'node_removed', 'Filtered result is correct type');
    const levelFiltered = stream.getHistory({ levels: [5] });
    assert(levelFiltered.length >= 1, 'Filter by level works');
    section('GraphStream — getDiffSince');
    const before = Date.now();
    const pLater = streaming_1.GraphPatchBuilder.nodeAdded(9, 'g10', 'n10');
    stream.sendPatch(pLater);
    const diff = stream.getDiffSince(before);
    assert(diff.length >= 1, 'Diff since timestamp returns new patches');
    const lastDiff = diff[diff.length - 1];
    assert(lastDiff.nodeId === 'n10', 'Diff contains correct patch');
    section('GraphStream — Disconnect');
    const disconnected = stream.disconnect(conn.id);
    assert(disconnected === true, 'Disconnect returns true');
    assert(stream.stats().activeConnections === 0, '0 active connections after disconnect');
    const badDisconnect = stream.disconnect('nonexistent');
    assert(badDisconnect === false, 'Disconnect nonexistent returns false');
    section('GraphStream — Subscribe callback');
    const received = [];
    const cleanup = stream.subscribe((patch) => { received.push(patch); });
    stream.sendPatch(streaming_1.GraphPatchBuilder.nodeAdded(1, 'g-test', 'n-test'));
    assert(received.length >= 1, 'Subscribe callback receives patches');
    assert(received[0].nodeId === 'n-test', 'Subscribed patch is correct');
    cleanup();
    section('GraphStream — onPatchType');
    const edgesReceived = [];
    const cleanup2 = stream.onPatchType('edge_added', (patch) => { edgesReceived.push(patch); });
    stream.sendPatch(streaming_1.GraphPatchBuilder.edgeAdded(4, 'g-edge', 'e-edge'));
    assert(edgesReceived.length >= 1, 'onPatchType edge_added works');
    assert(edgesReceived[0].edgeId === 'e-edge', 'Edge patch correct');
    cleanup2();
    section('GraphStream — Clear');
    stream.clear();
    assert(stream.stats().totalPatches === 0, 'Cleared totalPatches');
    assert(stream.stats().activeConnections === 0, 'Cleared connections');
    // =============================================
    // T-16.2: Observable
    // =============================================
    section('Observable — Subscribe and emit');
    const obs = new streaming_1.Observable();
    const receivedEvents = [];
    const cleanup3 = obs.subscribe('test', (data) => { receivedEvents.push(data); });
    obs.emit('test', 'hello');
    assert(receivedEvents.length === 1, 'Subscribe callback fires');
    assert(receivedEvents[0] === 'hello', 'Callback receives correct data');
    cleanup3();
    section('Observable — SubscribeOnce');
    const onceEvents = [];
    obs.subscribeOnce('once', (data) => { onceEvents.push(data); });
    obs.emit('once', 'a');
    obs.emit('once', 'b');
    assert(onceEvents.length === 1, 'subscribeOnce fires only once');
    assert(onceEvents[0] === 'a', 'subscribeOnce receives first event');
    section('Observable — Unsubscribe');
    const unsubEvents = [];
    const cb = (data) => { unsubEvents.push(data); };
    obs.subscribe('unsub', cb);
    obs.emit('unsub', 'a');
    obs.unsubscribe('unsub', cb);
    obs.emit('unsub', 'b');
    assert(unsubEvents.length === 1, 'Unsubscribe stops receiving events');
    section('Observable — listenerCount');
    obs.subscribe('count-test', () => { });
    assert(obs.listenerCount('count-test') >= 1, 'listenerCount returns > 0');
    assert(obs.listenerCount('nonexistent') === 0, 'listenerCount for nonexistent event is 0');
    section('Observable — events list');
    const evts = obs.events();
    assert(evts.length >= 1, 'events() returns at least 1');
    assert(evts.includes('count-test'), 'events() includes subscribed event');
    section('Observable — Clear');
    obs.clear();
    assert(obs.listenerCount('count-test') === 0, 'Clear removes all listeners');
    // =============================================
    // T-16.2: GraphObserver
    // =============================================
    section('GraphObserver — createStandalone');
    const { observer, emitter } = streaming_1.GraphObserver.createStandalone();
    assert(observer !== undefined, 'Standalone observer created');
    assert(typeof emitter.emit === 'function', 'Standalone emitter has emit');
    section('GraphObserver — onNodeAdded');
    const addedNodes = [];
    observer.onNodeAdded((patch) => { addedNodes.push(patch.nodeId); });
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(3, 'g', 'node-A'));
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(3, 'g', 'node-B'));
    assert(addedNodes.length === 2, 'onNodeAdded fires twice');
    assert(addedNodes[0] === 'node-A', 'First added node is node-A');
    assert(addedNodes[1] === 'node-B', 'Second added node is node-B');
    section('GraphObserver — onNodeRemoved');
    const removedNodes = [];
    observer.onNodeRemoved((patch) => { removedNodes.push(patch.nodeId); });
    emitter.emit(streaming_1.GraphPatchBuilder.nodeRemoved(3, 'g', 'node-A'));
    assert(removedNodes.length === 1, 'onNodeRemoved fires');
    assert(removedNodes[0] === 'node-A', 'Removed node is node-A');
    section('GraphObserver — onEdgeAdded');
    const addedEdges = [];
    observer.onEdgeAdded((patch) => { addedEdges.push(patch.edgeId); });
    emitter.emit(streaming_1.GraphPatchBuilder.edgeAdded(4, 'g', 'edge-X'));
    assert(addedEdges.length === 1, 'onEdgeAdded fires');
    assert(addedEdges[0] === 'edge-X', 'Added edge is edge-X');
    section('GraphObserver — onEdgeRemoved');
    const removedEdges = [];
    observer.onEdgeRemoved((patch) => { removedEdges.push(patch.edgeId); });
    emitter.emit(streaming_1.GraphPatchBuilder.edgeRemoved(4, 'g', 'edge-X'));
    assert(removedEdges.length === 1, 'onEdgeRemoved fires');
    assert(removedEdges[0] === 'edge-X', 'Removed edge is edge-X');
    section('GraphObserver — onNodeUpdated');
    const updatedNodes = [];
    observer.onNodeUpdated((patch) => { updatedNodes.push(patch.nodeId); });
    emitter.emit(streaming_1.GraphPatchBuilder.nodeUpdated(5, 'g', 'node-C', { val: 99 }));
    assert(updatedNodes.length === 1, 'onNodeUpdated fires');
    assert(updatedNodes[0] === 'node-C', 'Updated node is node-C');
    section('GraphObserver — onStateChanged');
    const stateChanges = [];
    observer.onStateChanged((patch) => { stateChanges.push(patch.graphId); });
    emitter.emit(streaming_1.GraphPatchBuilder.stateChanged(0, 'g-state', { status: 'ready' }));
    assert(stateChanges.length === 1, 'onStateChanged fires');
    assert(stateChanges[0] === 'g-state', 'State changed graphId');
    section('GraphObserver — observeLevel');
    const levelEvents = [];
    observer.observeLevel(3, (patch) => { levelEvents.push(patch); });
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(3, 'g', 'n-L3'));
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(7, 'g', 'n-L7'));
    assert(levelEvents.length === 1, 'observeLevel fires only for L3');
    assert(levelEvents[0].nodeId === 'n-L3', 'L3 event is correct');
    section('GraphObserver — observeGraph');
    const graphEvents = [];
    observer.observeGraph('g-target', (patch) => { graphEvents.push(patch); });
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(1, 'g-target', 'n-t'));
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(1, 'g-other', 'n-o'));
    assert(graphEvents.length === 1, 'observeGraph fires only for target graph');
    assert(graphEvents[0].nodeId === 'n-t', 'Target graph event correct');
    section('GraphObserver — observe with filter');
    const filteredEvents = [];
    observer.observe({ types: ['node_added', 'edge_added'], levels: [1] }, (patch) => {
        filteredEvents.push(patch);
    });
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(1, 'g', 'n-f1'));
    emitter.emit(streaming_1.GraphPatchBuilder.edgeAdded(1, 'g', 'e-f1'));
    emitter.emit(streaming_1.GraphPatchBuilder.nodeRemoved(1, 'g', 'n-f1')); // Should not fire
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(9, 'g', 'n-f9')); // Level 9 should not fire
    assert(filteredEvents.length === 2, 'observe filter matches 2 of 4');
    assert(filteredEvents[0].type === 'node_added', 'Filtered first is node_added');
    assert(filteredEvents[1].type === 'edge_added', 'Filtered second is edge_added');
    section('GraphObserver — unsubscribe');
    const subEvents = [];
    const sub = observer.onNodeAdded((patch) => { subEvents.push(patch.nodeId); });
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(1, 'g', 'n-u1'));
    observer.unsubscribe(sub.id);
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(1, 'g', 'n-u2'));
    assert(subEvents.length === 1, 'unsubscribe stops events');
    assert(subEvents[0] === 'n-u1', 'Unsubscribed after first event');
    section('GraphObserver — resubscribe');
    observer.resubscribe(sub.id);
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(1, 'g', 'n-u3'));
    assert(subEvents.length === 2, 'resubscribe restores events');
    section('GraphObserver — removeSubscription');
    observer.removeSubscription(sub.id);
    emitter.emit(streaming_1.GraphPatchBuilder.nodeAdded(1, 'g', 'n-u4'));
    assert(subEvents.length === 2, 'removeSubscription stops events permanently');
    section('GraphObserver — activeSubscriptions');
    const active = observer.activeSubscriptions();
    assert(active.length >= 6, 'Multiple active subscriptions');
    section('GraphObserver — subscriptionCount');
    assert(observer.subscriptionCount() >= 8, 'Multiple subscriptions registered');
    section('GraphObserver — stats');
    const obsStats = observer.stats();
    assert(obsStats.total >= 8, 'Stats total matches');
    assert(obsStats.active >= 6, 'Stats has active');
    assert(obsStats.totalCalls >= 10, 'Stats tracks total calls');
    section('GraphObserver — Clear');
    observer.clear();
    assert(observer.subscriptionCount() === 0, 'Clear removes all subscriptions');
    // =============================================
    // T-16.2: GraphObserver connected to GraphStream
    // =============================================
    section('GraphObserver — Connected to GraphStream');
    const stream2 = new streaming_1.GraphStream(100);
    const observer2 = new streaming_1.GraphObserver();
    observer2.connectToStream(stream2);
    const observedChanges = [];
    observer2.onNodeAdded((patch) => { observedChanges.push(patch.nodeId); });
    observer2.onEdgeRemoved((patch) => { observedChanges.push(`removed:${patch.edgeId}`); });
    stream2.sendPatch(streaming_1.GraphPatchBuilder.nodeAdded(2, 'g2', 'n-stream'));
    stream2.sendPatch(streaming_1.GraphPatchBuilder.edgeRemoved(2, 'g2', 'e-stream'));
    stream2.sendPatch(streaming_1.GraphPatchBuilder.nodeAdded(2, 'g2', 'n-stream2'));
    assert(observedChanges.length === 3, 'Stream-connected observer receives 3 events');
    assert(observedChanges[0] === 'n-stream', 'First event is n-stream');
    assert(observedChanges[1] === 'removed:e-stream', 'Second event is removed edge');
    assert(observedChanges[2] === 'n-stream2', 'Third event is n-stream2');
    // =============================================
    // T-16.2: SubscriptionManager
    // =============================================
    section('SubscriptionManager — Construction');
    const mgr = new streaming_1.SubscriptionManager();
    assert(mgr !== undefined, 'SubscriptionManager constructed');
    assert(mgr.count() === 0, 'Starts with 0 subscriptions');
    section('SubscriptionManager — Register');
    const sub1 = { id: 's1', label: 'test1', filter: {}, active: true, createdAt: Date.now(), callCount: 0 };
    const sub2 = { id: 's2', label: 'test2', filter: { types: ['node_added'] }, active: true, createdAt: Date.now(), callCount: 0 };
    mgr.register(sub1, 'group-A');
    mgr.register(sub2, 'group-A');
    assert(mgr.count() === 2, '2 subscriptions registered');
    section('SubscriptionManager — Get');
    const got = mgr.get('s1');
    assert(got !== undefined, 'Get returns subscription');
    assert(got.label === 'test1', 'Get returns correct label');
    section('SubscriptionManager — Activate/Deactivate');
    mgr.deactivate('s1');
    assert(mgr.get('s1').active === false, 'Deactivate works');
    mgr.activate('s1');
    assert(mgr.get('s1').active === true, 'Activate works');
    section('SubscriptionManager — Group activate/deactivate');
    mgr.deactivateGroup('group-A');
    assert(mgr.get('s1').active === false, 'Group deactivate s1');
    assert(mgr.get('s2').active === false, 'Group deactivate s2');
    mgr.activateGroup('group-A');
    assert(mgr.get('s1').active === true, 'Group activate s1');
    assert(mgr.get('s2').active === true, 'Group activate s2');
    section('SubscriptionManager — Remove');
    mgr.remove('s1');
    assert(mgr.count() === 1, 'Remove reduces count');
    assert(mgr.get('s1') === undefined, 'Removed subscription is gone');
    section('SubscriptionManager — Active list');
    const activeSubs = mgr.active();
    assert(activeSubs.length === 1, '1 active subscription');
    section('SubscriptionManager — List groups');
    const groups = mgr.listGroups();
    assert(groups.includes('group-A'), 'Groups list includes group-A');
    section('SubscriptionManager — Stats');
    const s = mgr.stats();
    assert(s.total === 1, 'Stats total');
    assert(s.active === 1, 'Stats active');
    assert(s.groups === 1, 'Stats groups');
    section('SubscriptionManager — Clear');
    mgr.clear();
    assert(mgr.count() === 0, 'Clear removes all');
    assert(mgr.listGroups().length === 0, 'Clear removes all groups');
    // =============================================
    // Summary
    // =============================================
    section('Summary');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0)
        process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=test-streaming.js.map