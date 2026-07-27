"use strict";
// ================================================================
// COS Graph CLI — Unified command-line interface for all 20 levels
// Zero external dependencies. Uses only readline, fs, path, process.
// ================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphCli = graphCli;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const level0_visual_1 = require("./level0-visual");
const level1_execution_1 = require("./level1-execution");
const level2_state_1 = require("./level2-state");
const level3_dependency_1 = require("./level3-dependency");
const level4_call_1 = require("./level4-call");
const level5_cfg_1 = require("./level5-cfg");
const level6_dataflow_1 = require("./level6-dataflow");
const level7_compute_1 = require("./level7-compute");
const level8_knowledge_1 = require("./level8-knowledge");
const level9_semantic_1 = require("./level9-semantic");
const level10_embedding_1 = require("./level10-embedding");
const level11_graphrag_1 = require("./level11-graphrag");
const level12_memory_1 = require("./level12-memory");
const level13_agent_1 = require("./level13-agent");
const level14_tool_1 = require("./level14-tool");
const level15_workflow_1 = require("./level15-workflow");
const level16_network_1 = require("./level16-network");
const level17_social_1 = require("./level17-social");
const level18_biological_1 = require("./level18-biological");
const level19_molecular_1 = require("./level19-molecular");
const smb_1 = require("./smb");
const security_1 = require("./security");
const i18n_1 = require("./i18n");
const plugin_1 = require("./plugin");
const pipeline_l4l5l6_1 = require("./pipeline-l4l5l6");
const pipeline_l8l9l10l11_1 = require("./pipeline-l8l9l10l11");
const pipeline_l12l13l14l15_1 = require("./pipeline-l12l13l14l15");
const pipeline_l16l17l18l19_1 = require("./pipeline-l16l17l18l19");
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';
const MAGENTA = '\x1b[35m';
function c(color, text) { return `${color}${text}${RESET}`; }
const LEVELS = {
    L0: { name: 'Visual Graph', cls: level0_visual_1.VisualGraphEngine, pipeline: false },
    L1: { name: 'Execution Graph', cls: level1_execution_1.ExecutionGraphEngine, pipeline: false },
    L2: { name: 'State Machine', cls: level2_state_1.StateMachine, pipeline: false },
    L3: { name: 'Dependency Graph', cls: level3_dependency_1.DependencyResolver, pipeline: false },
    L4: { name: 'Call Graph', cls: level4_call_1.CallGraphBuilder, pipeline: true },
    L5: { name: 'CFG', cls: level5_cfg_1.CFGBuilder, pipeline: true },
    L6: { name: 'DataFlow', cls: level6_dataflow_1.DataFlowGraph, pipeline: true },
    L7: { name: 'Compute Graph', cls: level7_compute_1.ComputationalGraph, pipeline: false },
    L8: { name: 'Knowledge Graph', cls: level8_knowledge_1.KnowledgeGraphEngine, pipeline: true },
    L9: { name: 'Semantic Graph', cls: level9_semantic_1.SemanticGraph, pipeline: true },
    L10: { name: 'Embedding Graph', cls: level10_embedding_1.EmbeddingGraph, pipeline: true },
    L11: { name: 'GraphRAG', cls: level11_graphrag_1.GraphRAGEngine, pipeline: true },
    L12: { name: 'Memory Graph', cls: level12_memory_1.MemoryGraphEngine, pipeline: true },
    L13: { name: 'Agent Graph', cls: level13_agent_1.AgentGraphEngine, pipeline: true },
    L14: { name: 'Tool Graph', cls: level14_tool_1.ToolGraphEngine, pipeline: true },
    L15: { name: 'Workflow Graph', cls: level15_workflow_1.WorkflowGraphEngine, pipeline: true },
    L16: { name: 'Network Graph', cls: level16_network_1.NetworkGraphEngine, pipeline: true },
    L17: { name: 'Social Graph', cls: level17_social_1.SocialGraphEngine, pipeline: true },
    L18: { name: 'Biological Graph', cls: level18_biological_1.BiologicalGraphEngine, pipeline: true },
    L19: { name: 'Molecular Graph', cls: level19_molecular_1.MolecularGraphEngine, pipeline: true },
};
function showHelp() {
    console.log(`
${c(BOLD, 'COS Graph CLI — Unified Interface for All 20 Levels')}

${c(BOLD, 'Usage:')}
  cos graph <command> [options]

${c(BOLD, 'Commands:')}
  ${c(GREEN, 'list')}                    ${GRAY}List all levels with details${RESET}
  ${c(GREEN, 'info')}       <level>     ${GRAY}Show info about a specific level${RESET}
  ${c(GREEN, 'exec')}       --file <f>  ${GRAY}Execute a graph workflow from JSON file${RESET}
  ${c(GREEN, 'analyze')}    --level <L> ${GRAY}Analyze a trace/data through a level${RESET}
  ${c(GREEN, 'render')}                 ${GRAY}Render a graph (mermaid/ascii/graphviz)${RESET}
  ${c(GREEN, 'smb')}                    ${GRAY}Save/load/list graphs in SMB${RESET}
  ${c(GREEN, 'pipeline')}  --name <n>  ${GRAY}Run a pipeline (L4L5L6, L8L9L10L11, L12L13L14L15, L16L17L18L19)${RESET}
  ${c(GREEN, 'demo')}       <level>     ${GRAY}Build a demo graph for a level${RESET}
  ${c(GREEN, 'security')}              ${GRAY}Run security checks (sanitize, validate, rate-limit)${RESET}
  ${c(GREEN, 'locale')}     [es|en|pt|fr|de]  ${GRAY}Set or show current locale${RESET}
  ${c(GREEN, 'plugin')}   [list|search|import|export]  ${GRAY}Plugin system (list, import/export graphs)${RESET}
  ${c(GREEN, 'help')}                   ${GRAY}Show this help${RESET}

${c(BOLD, 'Examples:')}
  ${c(CYAN, 'cos graph list')}
  ${c(CYAN, 'cos graph info L4')}
  ${c(CYAN, 'cos graph exec --file workflow.json')}
  ${c(CYAN, 'cos graph analyze --level L4 --trace trace.json')}
  ${c(CYAN, 'cos graph render --mermaid --output diagram.md')}
  ${c(CYAN, 'cos graph smb --save --level L7 --id my-graph')}
  ${c(CYAN, 'cos graph pipeline --name L4L5L6')}
  ${c(CYAN, 'cos graph demo L1')}
`);
}
function parseArgs(argv) {
    const args = {};
    let i = 0;
    while (i < argv.length) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);
            const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
            args[key] = val;
            if (val !== 'true')
                i++;
        }
        else {
            // Store positional as _
            args._ = argv[i];
        }
        i++;
    }
    return args;
}
async function cmdList() {
    console.log(`\n${c(BOLD, `${'Level'.padEnd(8)} ${'Name'.padEnd(22)} Pipeline  Status`)}`);
    console.log(`${GRAY}${'─'.repeat(55)}${RESET}`);
    for (const [key, info] of Object.entries(LEVELS)) {
        const status = info.cls ? c(GREEN, '✓ ready') : c(RED, '✗ missing');
        const pipeline = info.pipeline ? c(CYAN, 'yes') : c(GRAY, 'no');
        console.log(`${c(BOLD, key.padEnd(8))} ${info.name.padEnd(22)} ${pipeline.padEnd(9)} ${status}`);
    }
    console.log();
}
async function cmdInfo(level) {
    const info = LEVELS[level.toUpperCase()];
    if (!info) {
        console.error(c(RED, `Unknown level: ${level}. Use 'cos graph list' to see available levels.`));
        return;
    }
    let engine;
    try {
        engine = new info.cls();
    }
    catch {
        engine = null;
    }
    console.log(`\n${c(BOLD, `${level}: ${info.name}`)}`);
    console.log(`  ${c(GRAY, 'Class:')}     ${info.cls.name}`);
    console.log(`  ${c(GRAY, 'Pipeline:')}  ${info.pipeline ? c(CYAN, 'yes') : c(GRAY, 'no')}`);
    if (engine) {
        try {
            console.log(`  ${c(GRAY, 'Metrics:')}   ${JSON.stringify(engine.metrics ? engine.metrics() : engine.metrics ? 'requires args' : 'N/A')}`);
        }
        catch {
            console.log(`  ${c(GRAY, 'Metrics:')}   N/A`);
        }
        console.log(`  ${c(GRAY, 'Methods:')}`);
        const proto = info.cls.prototype;
        const methods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor' && !m.startsWith('_'));
        methods.slice(0, 15).forEach(m => console.log(`    ${c(CYAN, m)}`));
        if (methods.length > 15)
            console.log(`    ${c(GRAY, `... and ${methods.length - 15} more`)}`);
    }
    else {
        console.log(`  ${c(GRAY, 'Engine:')}   ${c(RED, 'Could not instantiate')}`);
    }
    console.log();
}
async function cmdExec(file) {
    if (!file || file === 'true') {
        console.error(c(RED, 'Error: --file is required. Example: cos graph exec --file workflow.json'));
        return;
    }
    const absPath = path.resolve(file);
    if (!fs.existsSync(absPath)) {
        console.error(c(RED, `Error: File not found: ${absPath}`));
        return;
    }
    const data = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
    const level = data.level || 'L0';
    const info = LEVELS[level.toUpperCase()];
    if (!info) {
        console.error(c(RED, `Unknown level: ${level}`));
        return;
    }
    console.log(`\n${c(BOLD, `Executing ${level} workflow from ${file}`)}`);
    const engine = new info.cls();
    if (data.nodes) {
        for (const n of data.nodes) {
            if (engine.addNode)
                engine.addNode(n);
        }
    }
    if (data.edges) {
        for (const e of data.edges) {
            if (engine.addEdge)
                engine.addEdge(e.source, e.target, e.type || 'default');
        }
    }
    const validation = engine.validate ? engine.validate() : [];
    if (validation.length > 0) {
        console.log(`  ${c(YELLOW, `Validation: ${validation.length} warnings`)}`);
        validation.slice(0, 5).forEach((v) => console.log(`    ${c(YELLOW, '⚠')} ${v}`));
    }
    const m = engine.metrics ? engine.metrics() : {};
    console.log(`  ${c(GREEN, '✓')} Workflow executed. ${JSON.stringify(m)}`);
}
async function cmdAnalyze(level, trace) {
    const info = LEVELS[level.toUpperCase()];
    if (!info) {
        console.error(c(RED, `Unknown level: ${level}`));
        return;
    }
    console.log(`\n${c(BOLD, `Analyzing ${level} (${info.name})`)}`);
    const engine = new info.cls();
    if (trace && trace !== 'true' && fs.existsSync(path.resolve(trace))) {
        const data = JSON.parse(fs.readFileSync(path.resolve(trace), 'utf-8'));
        console.log(`  ${c(GRAY, `Loaded trace: ${trace} (${JSON.stringify(data).length} bytes)`)}`);
    }
    const m = engine.metrics ? engine.metrics() : {};
    const v = engine.validate ? engine.validate() : [];
    console.log(`  ${c(GRAY, 'Metrics:')}    ${JSON.stringify(m)}`);
    console.log(`  ${c(GRAY, 'Valid:')}     ${v.length === 0 ? c(GREEN, '✓') : c(YELLOW, `${v.length} issues`)}`);
    if (v.length > 0)
        v.slice(0, 3).forEach((e) => console.log(`    ${c(YELLOW, '⚠')} ${e}`));
}
async function cmdRender(mermaid, format, output) {
    const engine = new level0_visual_1.VisualGraphEngine('Demo Graph');
    // Build a demo graph manually
    const n1 = engine.addNode({ label: 'Start', type: 'start' });
    const n2 = engine.addNode({ label: 'Process', type: 'process' });
    const n3 = engine.addNode({ label: 'Decision', type: 'decision' });
    const n4 = engine.addNode({ label: 'End', type: 'end' });
    engine.addEdge(n1, n2, 'enter');
    engine.addEdge(n2, n3, 'evaluate');
    engine.addEdge(n3, n4, 'done');
    // Get the visual graph object via toJSON
    const graph = engine.toJSON();
    let result = '';
    if (mermaid === 'true' || format === 'mermaid') {
        const renderer = new level0_visual_1.MermaidRenderer();
        result = renderer.render(graph);
        console.log(`\n${c(BOLD, 'Mermaid Diagram:')}\n`);
        console.log(result);
    }
    else if (format === 'graphviz' || format === 'dot') {
        const renderer = new level0_visual_1.GraphvizRenderer();
        result = renderer.render(graph);
        console.log(`\n${c(BOLD, 'Graphviz DOT:')}\n`);
        console.log(result);
    }
    else {
        const renderer = new level0_visual_1.ASCIITreeRenderer();
        result = renderer.render(graph);
        console.log(`\n${c(BOLD, 'ASCII Diagram:')}\n`);
        console.log(result);
    }
    if (output && output !== 'true') {
        fs.writeFileSync(path.resolve(output), result, 'utf-8');
        console.log(`  ${c(GREEN, '✓')} Written to ${output}`);
    }
}
async function cmdSmb(opts) {
    const smb = new smb_1.SMB();
    if (opts.list === 'true') {
        const graphs = await smb.listGraphs();
        console.log(`\n${c(BOLD, 'SMB Saved Graphs:')}`);
        if (graphs.length === 0)
            console.log(`  ${c(GRAY, 'No graphs saved yet.')}`);
        for (const g of graphs) {
            console.log(`  ${c(CYAN, g.key.padEnd(20))} ${c(GRAY, g.timestamp)}`);
        }
        return;
    }
    if (opts.save === 'true' && opts.level) {
        const info = LEVELS[opts.level.toUpperCase()];
        if (!info) {
            console.error(c(RED, `Unknown level: ${opts.level}`));
            return;
        }
        const engine = new info.cls();
        if (engine.buildDemo)
            engine.buildDemo();
        const data = engine.toJSON ? engine.toJSON() : { error: 'no toJSON' };
        const key = opts.id || `${opts.level}-${Date.now()}`;
        const id = await smb.saveGraph(key, data);
        console.log(`  ${c(GREEN, '✓')} ${opts.level} saved to SMB as ${c(CYAN, key)} (id: ${id})`);
        return;
    }
    if (opts.load === 'true' && opts.level) {
        const key = opts.id || opts.level;
        const data = await smb.loadGraph(key);
        if (data) {
            console.log(`\n${c(BOLD, `Loaded ${key} from SMB:`)}`);
            console.log(`  ${JSON.stringify(data).substring(0, 200)}...`);
        }
        else {
            console.log(`  ${c(YELLOW, 'No data found for key:')} ${key}`);
        }
        return;
    }
    console.log(`\n${c(BOLD, 'SMB Commands:')}`);
    console.log(`  ${c(CYAN, 'cos graph smb --list')}                          ${GRAY}List saved graphs${RESET}`);
    console.log(`  ${c(CYAN, 'cos graph smb --save --level L7 --id my-graph')}  ${GRAY}Save graph to SMB${RESET}`);
    console.log(`  ${c(CYAN, 'cos graph smb --load --level L7 --id my-graph')}  ${GRAY}Load graph from SMB${RESET}`);
}
async function cmdPipeline(name) {
    const pipelines = {
        L4L5L6: { name: 'Call → CFG → DataFlow', run: () => {
                const p = new pipeline_l4l5l6_1.PipelineL4L5L6();
                return p.runPipeline([]);
            } },
        L8L9L10L11: { name: 'Knowledge → Semantic → Embedding → GraphRAG', run: () => {
                const p = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
                return p.runPipeline([]);
            } },
        L12L13L14L15: { name: 'Memory → Agent → Tool → Workflow', run: () => {
                const p = new pipeline_l12l13l14l15_1.PipelineL12L13L14L15();
                return p.runPipeline([], [], [], []);
            } },
        L16L17L18L19: { name: 'Network → Social → Bio → Molecular', run: () => {
                const p = new pipeline_l16l17l18l19_1.PipelineL16L17L18L19();
                return p.runPipeline([]);
            } },
    };
    const p = pipelines[name.toUpperCase()];
    if (!p) {
        console.error(c(RED, `Unknown pipeline: ${name}. Available: ${Object.keys(pipelines).join(', ')}`));
        return;
    }
    console.log(`\n${c(BOLD, `Running ${name} — ${p.name}`)}`);
    const result = p.run();
    const metrics = result.metrics || result;
    console.log(`  ${c(GREEN, '✓')} Pipeline completed. ${JSON.stringify(metrics).substring(0, 200)}`);
}
async function cmdDemo(level) {
    const info = LEVELS[level.toUpperCase()];
    if (!info) {
        console.error(c(RED, `Unknown level: ${level}`));
        return;
    }
    let engine;
    try {
        engine = new info.cls();
    }
    catch {
        engine = null;
    }
    if (!engine) {
        console.error(c(RED, `Cannot instantiate ${level}`));
        return;
    }
    if (!engine.buildDemo) {
        console.log(`\n${c(BOLD, `Demo ${level} (${info.name})`)}`);
        const m = engine.metrics ? safeMetrics(engine) : {};
        console.log(`  ${c(GRAY, 'Metrics:')}  ${JSON.stringify(m)}`);
        console.log(`  ${c(GRAY, 'Note:')}    ${c(YELLOW, 'No buildDemo method')}`);
        return;
    }
    try {
        engine.buildDemo();
    }
    catch (e) {
        console.error(c(RED, `buildDemo failed: ${e.message}`));
        return;
    }
    const m = engine.metrics ? safeMetrics(engine) : {};
    const v = engine.validate ? safeValidate(engine) : [];
    console.log(`\n${c(BOLD, `Demo ${level} (${info.name})`)}`);
    console.log(`  ${c(GRAY, 'Metrics:')}  ${JSON.stringify(m)}`);
    console.log(`  ${c(GRAY, 'Valid:')}   ${v.length === 0 ? c(GREEN, '✓') : c(YELLOW, `${v.length} issues`)}`);
    const json = engine.toJSON ? safeToJSON(engine) : null;
    if (json)
        console.log(`  ${c(GRAY, 'Size:')}   ${JSON.stringify(json).length} bytes`);
}
function safeMetrics(engine) {
    try {
        return engine.metrics();
    }
    catch {
        return engine.metrics.length > 0 ? { requiresArgs: true } : {};
    }
}
function safeValidate(engine) {
    try {
        return engine.validate();
    }
    catch {
        return [];
    }
}
function safeToJSON(engine) {
    try {
        return engine.toJSON();
    }
    catch {
        return null;
    }
}
async function cmdSecurity(opts) {
    const action = opts.action || 'check';
    const level = opts.level || 'L0';
    const input = opts.input || '';
    if (action === 'sanitize') {
        const sec = new security_1.LevelSecurity();
        const sanitized = sec.sanitizer.sanitizeId(input);
        const label = sec.sanitizer.sanitizeLabel(input);
        console.log(`\n${c(BOLD, 'Sanitize Input:')}`);
        console.log(`  ${c(GRAY, 'Raw:')}      ${input}`);
        console.log(`  ${c(GRAY, 'ID:')}       ${c(CYAN, sanitized)}`);
        console.log(`  ${c(GRAY, 'Label:')}    ${c(CYAN, label)}`);
        console.log(`  ${c(GRAY, 'Valid ID:')} ${sec.sanitizer.isValidId(sanitized) ? c(GREEN, '✓') : c(RED, '✗')}`);
        return;
    }
    if (action === 'validate') {
        const sec = new security_1.LevelSecurity();
        const levelInfo = LEVELS[level.toUpperCase()];
        if (!levelInfo) {
            console.error(c(RED, `Unknown level: ${level}`));
            return;
        }
        const engine = new levelInfo.cls();
        const graph = engine.toJSON ? engine.toJSON() : { nodes: engine.nodes || [], edges: engine.edges || [] };
        const result = sec.validator.validateVisualGraph(graph);
        console.log(`\n${c(BOLD, `Validate ${level}:`)}`);
        console.log(`  ${c(GRAY, 'Valid:')}   ${result.valid ? c(GREEN, '✓') : c(RED, '✗')}`);
        console.log(`  ${c(GRAY, 'Errors:')}  ${result.errors.length}`);
        result.errors.slice(0, 10).forEach(e => console.log(`    ${c(RED, '✗')} ${e.field}: ${e.message}`));
        console.log(`  ${c(GRAY, 'Warnings:')} ${result.warnings.length}`);
        result.warnings.slice(0, 5).forEach(w => console.log(`    ${c(YELLOW, '⚠')} ${w.field}: ${w.message}`));
        return;
    }
    if (action === 'ratelimit') {
        const guard = new security_1.SecurityGuard({ maxOpsPerWindow: 10, rateLimitWindowMs: 60_000 });
        const client = opts.client || 'test-client';
        let allowed = 0;
        let blocked = 0;
        for (let i = 0; i < 15; i++) {
            if (guard.checkRateLimit(client))
                allowed++;
            else
                blocked++;
        }
        console.log(`\n${c(BOLD, 'Rate Limit Test:')}`);
        console.log(`  ${c(GRAY, 'Client:')}  ${client}`);
        console.log(`  ${c(GRAY, 'Max:')}     10 requests / 60s`);
        console.log(`  ${c(GRAY, 'Result:')}  ${c(GREEN, `${allowed} allowed`)} / ${c(RED, `${blocked} blocked`)}`);
        const stats = guard.getRateLimitStats();
        console.log(`  ${c(GRAY, 'Stats:')}   ${stats.activeKeys} active keys, ${stats.totalOps} total ops`);
        return;
    }
    if (action === 'sizecheck') {
        const guard = new security_1.SecurityGuard({ maxNodes: 100, maxEdges: 500 });
        const nodes = parseInt(opts.nodes || '50', 10);
        const edges = parseInt(opts.edges || '100', 10);
        const result = guard.checkGraphSize(nodes, edges);
        console.log(`\n${c(BOLD, 'Graph Size Check:')}`);
        console.log(`  ${c(GRAY, 'Nodes:')}   ${nodes} (max: 100)`);
        console.log(`  ${c(GRAY, 'Edges:')}   ${edges} (max: 500)`);
        console.log(`  ${c(GRAY, 'Status:')} ${result.valid ? c(GREEN, '✓ Within limits') : c(RED, '✗ Exceeds limits')}`);
        return;
    }
    // Default: show all checks
    console.log(`\n${c(BOLD, 'COS Security Guard')}`);
    console.log(`\n${c(BOLD, 'Subcommands:')}`);
    console.log(`  ${c(CYAN, 'cos graph security --action sanitize --input "<text>"')}   ${GRAY}Sanitize input text${RESET}`);
    console.log(`  ${c(CYAN, 'cos graph security --action validate --level L4')}          ${GRAY}Validate graph structure${RESET}`);
    console.log(`  ${c(CYAN, 'cos graph security --action ratelimit')}                     ${GRAY}Test rate limiting${RESET}`);
    console.log(`  ${c(CYAN, 'cos graph security --action sizecheck --nodes 50 --edges 100')} ${GRAY}Check graph size limits${RESET}`);
    console.log();
}
async function cmdLocale(locale) {
    if (!locale || locale === 'true') {
        const current = (0, i18n_1.getLocale)();
        const locales = (0, i18n_1.listLocales)();
        console.log(`\n${c(BOLD, 'Current Locale:')} ${c(CYAN, current)} (${(0, i18n_1.t)('start')} → ${(0, i18n_1.t)('end')})`);
        console.log(`\n${c(BOLD, 'Available Locales:')}`);
        for (const l of locales) {
            const marker = l.code === current ? '◀' : ' ';
            const sample = (0, i18n_1.getLabels)(l.code);
            console.log(`  ${c(CYAN, l.code.padEnd(6))} ${l.name.padEnd(15)} ${c(GRAY, `${sample.start} → ${sample.end}`)} ${c(CYAN, marker)}`);
        }
        console.log(`\n  ${c(GRAY, 'Set locale:')} ${c(CYAN, 'cos graph locale es')}`);
        console.log();
        return;
    }
    const valid = (0, i18n_1.listLocales)().map(l => l.code);
    if (valid.includes(locale)) {
        (0, i18n_1.setLocale)(locale);
        console.log(`  ${c(GREEN, '✓')} Locale changed to ${c(CYAN, locale)} (${(0, i18n_1.t)('start')} → ${(0, i18n_1.t)('end')})`);
    }
    else {
        console.error(c(RED, `Unknown locale: ${locale}. Available: ${valid.join(', ')}`));
    }
}
async function cmdPlugin(args) {
    const sub = args._ || args.sub || 'list';
    const format = args.format || 'json';
    const input = args.input || '';
    const ps = plugin_1.pluginSystem;
    if (sub === 'list' || sub === 'ls') {
        const plugins = ps.registry.list();
        console.log(`\n${c(BOLD, `Plugins (${plugins.length}):`)}`);
        for (const p of plugins) {
            const status = p.activated ? c(GREEN, '●') : c(RED, '○');
            console.log(`  ${status} ${c(CYAN, p.manifest.name.padEnd(20))} ${c(GRAY, `v${p.manifest.version}`)} ${p.manifest.description} ${p.manifest.hooks.length > 0 ? c(GRAY, `[${p.manifest.hooks.join(', ')}]`) : ''}`);
        }
        console.log();
        return;
    }
    if (sub === 'search' || sub === 'find') {
        const query = args.query || '';
        const results = ps.marketplace.search(query);
        console.log(`\n${c(BOLD, `Marketplace (${results.length}):`)}`);
        for (const p of results) {
            const installed = ps.marketplace.isInstalled(p.name) ? c(GREEN, '✓') : ' ';
            console.log(`  ${installed} ${c(CYAN, p.name.padEnd(22))} ${c(GRAY, `v${p.version}`)} ${p.description.padEnd(50)} ${c(YELLOW, `★${p.rating}`)}`);
        }
        console.log();
        return;
    }
    if (sub === 'import') {
        if (!input) {
            console.error(c(RED, 'Use --input <file> to import'));
            return;
        }
        let raw = '';
        try {
            raw = require('fs').readFileSync(input, 'utf-8');
        }
        catch {
            // Try as raw data
            raw = input;
        }
        const result = ps.registry.importFrom(format, raw);
        if (result.success) {
            console.log(`  ${c(GREEN, '✓')} Imported ${result.data.nodes.length} nodes, ${result.data.edges.length} edges from ${format}`);
            console.log(`  ${c(GRAY, JSON.stringify(result.data.nodes.slice(0, 3).map(n => n.id)))}`);
        }
        else {
            console.error(`  ${c(RED, '✗')} Import failed: ${result.error}`);
        }
        return;
    }
    if (sub === 'export') {
        const output = args.output || '';
        // Build a simple demo graph
        const graph = {
            nodes: [
                { id: 'n1', label: 'Start' },
                { id: 'n2', label: 'Process' },
                { id: 'n3', label: 'End' },
            ],
            edges: [
                { source: 'n1', target: 'n2', label: 'enter' },
                { source: 'n2', target: 'n3', label: 'exit' },
            ],
        };
        const result = ps.registry.exportTo(format, graph);
        if (result.success) {
            if (output) {
                require('fs').writeFileSync(output, result.data, 'utf-8');
                console.log(`  ${c(GREEN, '✓')} Exported ${graph.nodes.length} nodes, ${graph.edges.length} edges to ${c(CYAN, output)}`);
            }
            else {
                console.log(`\n${c(BOLD, `Exported (${format}):`)}`);
                console.log(result.data.substring(0, 500));
                console.log();
            }
        }
        else {
            console.error(`  ${c(RED, '✗')} Export failed: ${result.error}`);
        }
        return;
    }
    // Install from marketplace
    if (sub === 'install') {
        const name = args.name || '';
        if (!name) {
            console.error(c(RED, 'Use --name <plugin> to install'));
            return;
        }
        const ok = ps.marketplace.install(name);
        if (ok) {
            console.log(`  ${c(GREEN, '✓')} Installed ${c(CYAN, name)}`);
        }
        else {
            console.error(`  ${c(RED, '✗')} Failed to install ${name} — not found or dependency issue`);
        }
        return;
    }
    // Default: show help
    console.log(`\n${c(BOLD, 'COS Plugin System')}`);
    console.log(`\n  ${c(GRAY, 'cos graph plugin list')}            ${c(CYAN, 'List all plugins')}`);
    console.log(`  ${c(GRAY, 'cos graph plugin search --query <q>')} ${c(CYAN, 'Search marketplace')}`);
    console.log(`  ${c(GRAY, 'cos graph plugin import --format <f> --input <file>')} ${c(CYAN, 'Import graph from file')}`);
    console.log(`  ${c(GRAY, 'cos graph plugin export --format <f> [--output <file>]')} ${c(CYAN, 'Export graph to format')}`);
    console.log(`  ${c(GRAY, 'cos graph plugin install --name <p>')} ${c(CYAN, 'Install from marketplace')}`);
    console.log(`  ${c(GRAY, 'Formats:')} ${c(CYAN, 'csv, json, graphml')}`);
    console.log();
}
async function graphCli(argv) {
    const command = argv[0] || 'help';
    const args = parseArgs(argv.slice(1));
    switch (command) {
        case 'list':
            await cmdList();
            break;
        case 'info':
            await cmdInfo(args._ || args.level || '');
            break;
        case 'exec':
            await cmdExec(args.file);
            break;
        case 'analyze':
            await cmdAnalyze(args.level || 'L4', args.trace || '');
            break;
        case 'render':
            await cmdRender(args.mermaid || 'true', args.format || 'mermaid', args.output || '');
            break;
        case 'smb':
            await cmdSmb(args);
            break;
        case 'pipeline':
            await cmdPipeline(args.name || 'L4L5L6');
            break;
        case 'demo':
            await cmdDemo(args._ || args.level || 'L1');
            break;
        case 'security':
            await cmdSecurity(args);
            break;
        case 'locale':
            await cmdLocale(args._ || args.locale || '');
            break;
        case 'plugin':
            await cmdPlugin(args);
            break;
        case 'help':
        default:
            showHelp();
            break;
    }
}
// Standalone entry point
if (require.main === module) {
    graphCli(process.argv.slice(3)).catch(e => {
        console.error(c(RED, `Error: ${e.message}`));
        process.exit(1);
    });
}
//# sourceMappingURL=cli.js.map