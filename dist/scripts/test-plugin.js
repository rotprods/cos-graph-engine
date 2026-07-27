"use strict";
/**
 * Tests de Plugin System (Fase 12)
 * Prueba: PluginRegistry, PluginMarketplace, format plugins, hooks, CLI
 */
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = require("../packages/graph/src/plugin");
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
    // T-12.1: Plugin System
    // =============================================
    section('PluginRegistry — Built-in Plugins');
    const registry = new plugin_1.PluginRegistry();
    const plugins = registry.list();
    assert(plugins.length === 5, '5 built-in plugins registered');
    assert(plugins.some(p => p.manifest.name === 'csv-importer'), 'csv-importer registered');
    assert(plugins.some(p => p.manifest.name === 'csv-exporter'), 'csv-exporter registered');
    assert(plugins.some(p => p.manifest.name === 'graphml-importer'), 'graphml-importer registered');
    assert(plugins.some(p => p.manifest.name === 'graphml-exporter'), 'graphml-exporter registered');
    assert(plugins.some(p => p.manifest.name === 'json-formatter'), 'json-formatter registered');
    section('PluginRegistry — Register External Plugin');
    const testPlugin = {
        manifest: {
            name: 'test-plugin',
            version: '1.0.0',
            description: 'A test plugin',
            author: 'Test Author',
            hooks: ['beforeAddNode', 'afterAddEdge'],
        },
        activated: false,
        onActivate() { },
        onDeactivate() { },
        async onHook(hook, ctx) { return ctx; },
    };
    assert(registry.register(testPlugin) === true, 'Register external plugin');
    assert(registry.get('test-plugin') !== undefined, 'Get registered plugin');
    assert(registry.register(testPlugin) === false, 'Cannot register duplicate');
    assert(registry.activate('test-plugin') === true, 'Activate plugin');
    assert(registry.get('test-plugin').activated === true, 'Plugin is activated');
    assert(registry.activate('test-plugin') === false, 'Cannot activate already active');
    assert(registry.deactivate('test-plugin') === true, 'Deactivate plugin');
    assert(registry.get('test-plugin').activated === false, 'Plugin is deactivated');
    assert(registry.unregister('test-plugin') === true, 'Unregister plugin');
    assert(registry.get('test-plugin') === undefined, 'Plugin removed');
    section('PluginRegistry — Active List');
    // Re-register for testing
    registry.register(testPlugin);
    registry.activate('test-plugin');
    const active = registry.listActive();
    assert(active.length >= 1, 'At least 1 active plugin');
    assert(active.some(p => p.manifest.name === 'test-plugin'), 'test-plugin is active');
    section('PluginRegistry — Hooks');
    const hookPlugin = {
        manifest: {
            name: 'hook-plugin',
            version: '1.0.0',
            description: 'Hook test plugin',
            hooks: ['beforeAddNode', 'afterAddEdge'],
        },
        activated: true,
        async onHook(hook, ctx) {
            if (hook === 'beforeAddNode') {
                ctx.data = { ...ctx.data, validated: true };
            }
            if (hook === 'afterAddEdge') {
                ctx.data = { ...ctx.data, tracked: true };
            }
            return ctx;
        },
    };
    registry.register(hookPlugin);
    const hookCtx1 = await registry.executeHook('beforeAddNode', { nodeId: 'n1' });
    assert(hookCtx1.data.validated === true, 'beforeAddNode hook executed');
    const hookCtx2 = await registry.executeHook('afterAddEdge', { source: 'n1', target: 'n2' });
    assert(hookCtx2.data.tracked === true, 'afterAddEdge hook executed');
    section('PluginRegistry — Abort Hook');
    const abortPlugin = {
        manifest: {
            name: 'abort-plugin',
            version: '1.0.0',
            description: 'Abort plugin',
            hooks: ['beforeAddNode'],
        },
        activated: true,
        async onHook(hook, ctx) {
            ctx.abort = true;
            return ctx;
        },
    };
    registry.register(abortPlugin);
    const abortCtx = await registry.executeHook('beforeAddNode', { nodeId: 'bad' });
    assert(abortCtx.abort === true, 'Abort hook works');
    section('PluginRegistry — CSV Import');
    const csvData = 'id,label,type\nn1,Start,entry\nn2,Process,normal\nn3,End,exit';
    const csvResult = registry.importFrom('csv', csvData);
    assert(csvResult.success === true, 'CSV import succeeds');
    assert(csvResult.data !== undefined, 'CSV import returns data');
    assert(csvResult.data.nodes.length === 3, 'CSV import: 3 nodes');
    assert(csvResult.data.nodes[0].id === 'n1', 'CSV import: node n1');
    assert(csvResult.data.nodes[0].label === 'Start', 'CSV import: label Start');
    const csvEdgeData = 'source,target,label\nn1,n2,enter\nn2,n3,exit';
    const csvEdgeResult = registry.importFrom('csv', csvEdgeData);
    assert(csvEdgeResult.success === true, 'CSV edge import succeeds');
    assert(csvEdgeResult.data.edges.length === 2, 'CSV edge import: 2 edges');
    assert(csvEdgeResult.data.edges[0].source === 'n1', 'CSV edge: source n1');
    section('PluginRegistry — CSV Export');
    const testGraph = {
        nodes: [{ id: 'n1', label: 'Start' }, { id: 'n2', label: 'Process' }],
        edges: [{ source: 'n1', target: 'n2', label: 'go' }],
    };
    const csvExport = registry.exportTo('csv', testGraph);
    assert(csvExport.success === true, 'CSV export succeeds');
    assert(csvExport.data !== undefined, 'CSV export returns data');
    assert(csvExport.data.includes('n1'), 'CSV export includes n1');
    assert(csvExport.data.includes('n2'), 'CSV export includes n2');
    section('PluginRegistry — GraphML Import');
    const graphmlData = `<?xml version="1.0"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph id="G" edgedefault="directed">
    <node id="n1"><data key="label">Start</data></node>
    <node id="n2"><data key="label">Process</data></node>
    <edge source="n1" target="n2"><data key="label_e">go</data></edge>
  </graph>
</graphml>`;
    const graphmlResult = registry.importFrom('graphml', graphmlData);
    assert(graphmlResult.success === true, 'GraphML import succeeds');
    assert(graphmlResult.data.nodes.length === 2, 'GraphML import: 2 nodes');
    assert(graphmlResult.data.edges.length === 1, 'GraphML import: 1 edge');
    assert(graphmlResult.data.edges[0].source === 'n1', 'GraphML edge source n1');
    section('PluginRegistry — GraphML Export');
    const graphmlExport = registry.exportTo('graphml', testGraph);
    assert(graphmlExport.success === true, 'GraphML export succeeds');
    assert(graphmlExport.data !== undefined, 'GraphML export returns data');
    assert(graphmlExport.data.includes('graphml'), 'GraphML export includes root tag');
    assert(graphmlExport.data.includes('n1'), 'GraphML export includes n1');
    section('PluginRegistry — JSON Import/Export');
    const jsonData = JSON.stringify({ nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [{ source: 'n1', target: 'n2' }] });
    const jsonImport = registry.importFrom('json', jsonData);
    assert(jsonImport.success === true, 'JSON import succeeds');
    assert(jsonImport.data.nodes.length === 2, 'JSON import: 2 nodes');
    const jsonExport = registry.exportTo('json', { nodes: [{ id: 'x' }], edges: [] });
    assert(jsonExport.success === true, 'JSON export succeeds');
    assert(jsonExport.data.includes('"id": "x"'), 'JSON export includes node data');
    section('PluginRegistry — Error Handling');
    const badCsv = registry.importFrom('csv', '');
    assert(badCsv.success === false, 'Empty CSV fails');
    assert(badCsv.error !== undefined, 'Empty CSV returns error');
    const badJson = registry.importFrom('json', '{invalid');
    assert(badJson.success === false, 'Invalid JSON fails');
    const unknownFormat = registry.importFrom('unknown', 'data');
    assert(unknownFormat.success === false, 'Unknown format fails');
    const unknownExport = registry.exportTo('unknown', testGraph);
    assert(unknownExport.success === false, 'Unknown format export fails');
    section('PluginRegistry — Stats');
    const stats = registry.getStats();
    assert(stats.totalPlugins >= 8, 'Stats: total plugins >= 8'); // 5 built-in + 3 external
    assert(stats.activePlugins >= 6, 'Stats: active plugins >= 6');
    assert(stats.executions >= 10, 'Stats: executions tracked');
    assert(stats.formats.length >= 3, 'Stats: formats tracked');
    // =============================================
    // T-12.2: Plugin Marketplace
    // =============================================
    section('PluginMarketplace — Catalog');
    const marketplace = new plugin_1.PluginMarketplace();
    const catalog = marketplace.list();
    assert(catalog.length >= 26, 'Marketplace catalog has 26+ plugins');
    const csvPlugin = marketplace.get('csv-importer');
    assert(csvPlugin !== undefined, 'Get csv-importer from catalog');
    assert(csvPlugin.version === '0.1.0', 'csv-importer version correct');
    const aiPlugin = marketplace.get('graph-ai');
    assert(aiPlugin !== undefined, 'Get graph-ai from catalog');
    assert(aiPlugin.rating === 4.4, 'graph-ai rating correct');
    assert(aiPlugin.tags.includes('ai'), 'graph-ai has ai tag');
    assert(aiPlugin.dependencies.length === 2, 'graph-ai has 2 dependencies');
    const layoutPlugin = marketplace.get('graph-layout');
    assert(layoutPlugin !== undefined, 'Get graph-layout from catalog');
    assert(layoutPlugin.rating === 4.3, 'graph-layout rating correct');
    section('PluginMarketplace — Search');
    const searchResults = marketplace.search('csv');
    assert(searchResults.length >= 2, 'Search "csv" returns 2+ results');
    assert(searchResults.every(p => p.name.toLowerCase().includes('csv')), 'Search results contain "csv"');
    const tagResults = marketplace.search(undefined, 'format');
    assert(tagResults.length >= 5, 'Tag "format" returns 5+ results');
    const noResults = marketplace.search('zzzznotfound');
    assert(noResults.length === 0, 'Search for nonexistent returns empty');
    section('PluginMarketplace — Install/Uninstall');
    assert(marketplace.install('csv-importer') === true, 'Install csv-importer');
    assert(marketplace.isInstalled('csv-importer') === true, 'csv-importer is installed');
    assert(marketplace.install('graph-metrics') === true, 'Install graph-metrics');
    assert(marketplace.uninstall('csv-importer') === true, 'Uninstall csv-importer');
    assert(marketplace.isInstalled('csv-importer') === false, 'csv-importer uninstalled');
    section('PluginMarketplace — Dependency Resolution');
    // Install a plugin with dependencies
    const neo4j = marketplace.get('neo4j-connector');
    assert(neo4j !== undefined, 'neo4j-connector in catalog');
    assert(neo4j.dependencies.length === 1, 'neo4j-connector has 1 dependency');
    assert(neo4j.dependencies[0].name === 'json-formatter', 'Depends on json-formatter');
    assert(marketplace.install('neo4j-connector') === true, 'Install neo4j-connector');
    assert(marketplace.isInstalled('neo4j-connector') === true, 'neo4j-connector installed');
    assert(marketplace.isInstalled('json-formatter') === true, 'json-formatter auto-installed as dependency');
    // Cannot uninstall a dependency that has dependents
    assert(marketplace.uninstall('json-formatter') === false, 'Cannot uninstall dep with dependents');
    section('PluginMarketplace — Stats');
    const mktStats = marketplace.getStats();
    assert(mktStats.total >= 26, 'Marketplace stats: total >= 26');
    assert(mktStats.installed >= 2, 'Marketplace stats: installed >= 2');
    assert(mktStats.categories.length >= 10, 'Marketplace stats: 10+ categories');
    section('PluginSystem — Top-level');
    const ps = new plugin_1.PluginSystem();
    const psStats = ps.getStats();
    assert(psStats.registry.totalPlugins >= 5, 'PluginSystem: registry has 5+ plugins');
    assert(psStats.marketplace.total >= 26, 'PluginSystem: marketplace has 26+ plugins');
    section('PluginSystem — Singleton');
    assert(plugin_1.pluginSystem !== undefined, 'pluginSystem singleton exists');
    assert(plugin_1.pluginSystem.registry.list().length >= 5, 'Singleton registry has 5+ plugins');
    // =============================================
    // Summary
    // =============================================
    section('Summary');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0)
        process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=test-plugin.js.map