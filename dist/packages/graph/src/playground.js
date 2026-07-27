"use strict";
/**
 * Playground Interactivo y Tutoriales — Fase 18
 *
 * T-18.1: Playground Interactivo — REPL 'cos playground L4'
 * T-18.2: Tutoriales Interactivos — 20 tutoriales 'cos tutorial L17'
 *
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TutorialRunner = exports.TutorialRegistry = exports.Tutorial = exports.PlaygroundSession = exports.LevelPlayground = void 0;
const level0_visual_1 = require("./level0-visual");
// ============================================================
// LevelMetadata
// ============================================================
const LEVEL_METADATA = [
    { level: 0, name: 'Visual Graph', description: 'Renderizado de grafos (Mermaid, Graphviz, ASCII)', engine: 'VisualGraphEngine' },
    { level: 1, name: 'Execution Graph', description: 'Ejecucion secuencial y paralela de nodos', engine: 'ExecutionGraphEngine' },
    { level: 2, name: 'State Machine', description: 'Maquinas de estado con transiciones, guards y acciones', engine: 'StateMachine' },
    { level: 3, name: 'Dependency Resolver', description: 'Resolucion de dependencias topologicas', engine: 'DependencyResolver' },
    { level: 4, name: 'Call Graph', description: 'Analisis de llamadas entre funciones', engine: 'CallGraphBuilder' },
    { level: 5, name: 'CFG', description: 'Control Flow Graph con bifurcaciones', engine: 'CFGBuilder' },
    { level: 6, name: 'Data Flow', description: 'Analisis de flujo de datos', engine: 'DataFlowGraph' },
    { level: 7, name: 'Compute', description: 'MLP y redes neuronales', engine: 'ComputationalGraph' },
    { level: 8, name: 'Knowledge Graph', description: 'Grafos de conocimiento con entidades y relaciones', engine: 'KnowledgeGraphEngine' },
    { level: 9, name: 'Semantic Graph', description: 'Analisis semantico de nodos', engine: 'SemanticGraph' },
    { level: 10, name: 'Embedding Graph', description: 'Vectores de embedding con distancia coseno', engine: 'EmbeddingGraph' },
    { level: 11, name: 'GraphRAG', description: 'RAG con indices de grafo y busqueda semantica', engine: 'GraphRAGEngine' },
    { level: 12, name: 'Memory Graph', description: 'Memoria con capas y consolidacion', engine: 'MemoryGraphEngine' },
    { level: 13, name: 'Agent Graph', description: 'Agentes autonomos con planificacion', engine: 'AgentGraphEngine' },
    { level: 14, name: 'Tool Graph', description: 'Herramientas ejecutables con parametros', engine: 'ToolGraphEngine' },
    { level: 15, name: 'Workflow Graph', description: 'Workflows con pasos secuenciales', engine: 'WorkflowGraphEngine' },
    { level: 16, name: 'Network Graph', description: 'Redes de nodos con metricas', engine: 'NetworkGraphEngine' },
    { level: 17, name: 'Social Graph', description: 'Grafos sociales con influencia', engine: 'SocialGraphEngine' },
    { level: 18, name: 'Biological Graph', description: 'Grafos biologicos con rutas metabolicas', engine: 'BiologicalGraphEngine' },
    { level: 19, name: 'Molecular Graph', description: 'Grafos moleculares con enlaces atomicos', engine: 'MolecularGraphEngine' },
];
// ============================================================
// LevelPlayground — REPL para un nivel especifico
// ============================================================
class LevelPlayground {
    level;
    levelName;
    description;
    commands;
    context;
    constructor(level) {
        const meta = LEVEL_METADATA.find(m => m.level === level);
        if (!meta)
            throw new Error(`Level ${level} not found`);
        this.level = level;
        this.levelName = meta.name;
        this.description = meta.description;
        this.context = { level, levelName: meta.name, graph: {}, state: new Map() };
        this.commands = this.buildCommands();
    }
    buildCommands() {
        return [
            {
                name: 'help',
                description: 'Muestra esta ayuda',
                args: '',
                handler: () => this.commands.map(c => `  ${c.name} ${c.args} — ${c.description}`).join('\n'),
            },
            {
                name: 'info',
                description: 'Muestra informacion del nivel',
                args: '',
                handler: () => `Level ${this.level}: ${this.levelName}\n  ${this.description}`,
            },
            {
                name: 'create',
                description: 'Crea un grafo de ejemplo',
                args: '[name]',
                handler: (args) => {
                    const name = args[0] || `graph_${this.level}`;
                    this.context.graph = { name, nodes: [], edges: [], level: this.level };
                    return `Graph "${name}" created at level ${this.level}`;
                },
            },
            {
                name: 'add',
                description: 'Agrega un nodo al grafo',
                args: '<id> [type]',
                handler: (args) => {
                    const id = args[0] || 'node-1';
                    const type = args[1] || 'default';
                    const nodes = this.context.graph.nodes || [];
                    nodes.push({ id, type, data: {} });
                    this.context.graph.nodes = nodes;
                    return `Node "${id}" (type: ${type}) added`;
                },
            },
            {
                name: 'remove',
                description: 'Elimina un nodo del grafo',
                args: '<id>',
                handler: (args) => {
                    const id = args[0];
                    if (!id)
                        return 'Usage: remove <id>';
                    const nodes = this.context.graph.nodes || [];
                    const idx = nodes.findIndex((n) => n.id === id);
                    if (idx < 0)
                        return `Node "${id}" not found`;
                    nodes.splice(idx, 1);
                    return `Node "${id}" removed`;
                },
            },
            {
                name: 'edge',
                description: 'Agrega una arista entre nodos',
                args: '<source> <target> [label]',
                handler: (args) => {
                    const [source, target, label] = args;
                    if (!source || !target)
                        return 'Usage: edge <source> <target> [label]';
                    const edges = this.context.graph.edges || [];
                    edges.push({ source, target, label: label || '' });
                    this.context.graph.edges = edges;
                    return `Edge ${source} -> ${target} added`;
                },
            },
            {
                name: 'list',
                description: 'Lista los nodos del grafo',
                args: '',
                handler: () => {
                    const nodes = this.context.graph.nodes || [];
                    if (nodes.length === 0)
                        return 'No nodes in graph';
                    return nodes.map((n) => `  ${n.id} (${n.type})`).join('\n');
                },
            },
            {
                name: 'stats',
                description: 'Muestra estadisticas del grafo',
                args: '',
                handler: () => {
                    const nodes = this.context.graph.nodes || [];
                    const edges = this.context.graph.edges || [];
                    return `Nodes: ${nodes.length}\nEdges: ${edges.length}\nLevel: ${this.level}`;
                },
            },
            {
                name: 'clear',
                description: 'Limpia el grafo',
                args: '',
                handler: () => {
                    this.context.graph = {};
                    return 'Graph cleared';
                },
            },
            {
                name: 'exec',
                description: 'Ejecuta el grafo (nivel 1)',
                args: '',
                handler: () => {
                    if (this.level === 1) {
                        return 'Execution graph created: exec_playground';
                    }
                    return `exec not available for level ${this.level}`;
                },
            },
            {
                name: 'visualize',
                description: 'Visualiza el grafo (ASCII)',
                args: '',
                handler: () => {
                    if (this.level === 0) {
                        const engine = new level0_visual_1.VisualGraphEngine();
                        const g = engine.createFromEdges([], 'Playground');
                        return g.renderer?.('ascii') || 'No renderer available';
                    }
                    const nodes = this.context.graph.nodes || [];
                    if (nodes.length === 0)
                        return 'No graph to visualize';
                    return nodes.map((n) => `[${n.id}]`).join(' -> ') || '(empty)';
                },
            },
            {
                name: 'exit',
                description: 'Sale del playground',
                args: '',
                handler: () => 'Goodbye!',
            },
        ];
    }
    /**
     * Ejecutar un comando en el playground.
     */
    execute(input) {
        const trimmed = input.trim();
        if (!trimmed)
            return { success: true, output: '' };
        const parts = trimmed.split(/\s+/);
        const cmdName = parts[0].toLowerCase();
        const args = parts.slice(1);
        const cmd = this.commands.find(c => c.name === cmdName);
        if (!cmd) {
            const suggestions = this.commands
                .filter(c => c.name.startsWith(cmdName[0]))
                .map(c => c.name);
            return {
                success: false,
                output: `Unknown command: "${cmdName}". Type "help" for available commands.`,
                suggestions: suggestions.length > 0 ? suggestions : undefined,
            };
        }
        try {
            const output = cmd.handler(args, this.context);
            return { success: true, output };
        }
        catch (e) {
            return { success: false, output: `Error: ${e.message}` };
        }
    }
    /**
     * Obtener ayuda de un comando especifico.
     */
    commandHelp(name) {
        const cmd = this.commands.find(c => c.name === name);
        if (!cmd)
            return undefined;
        return `${cmd.name} ${cmd.args} — ${cmd.description}`;
    }
}
exports.LevelPlayground = LevelPlayground;
// ============================================================
// PlaygroundSession — Sesion completa de playground
// ============================================================
class PlaygroundSession {
    playgrounds = new Map();
    currentLevel = 0;
    history = [];
    maxHistory = 100;
    /**
     * Iniciar sesion en un nivel.
     */
    start(level) {
        if (!this.playgrounds.has(level)) {
            try {
                this.playgrounds.set(level, new LevelPlayground(level));
            }
            catch (e) {
                return { success: false, output: `Level ${level} not available: ${e.message}` };
            }
        }
        this.currentLevel = level;
        const meta = LEVEL_METADATA.find(m => m.level === level);
        return {
            success: true,
            output: `=== COS Playground — Level ${level}: ${meta.name} ===\n${meta.description}\n\nType "help" for available commands.`,
        };
    }
    /**
     * Ejecutar un comando en la sesion actual.
     */
    execute(input) {
        this.history.push(input);
        if (this.history.length > this.maxHistory)
            this.history.shift();
        const trimmed = input.trim();
        // Cambiar de nivel: "L5" o "level 5"
        const levelMatch = trimmed.match(/^L(\d+)$/i) || trimmed.match(/^level\s+(\d+)$/i);
        if (levelMatch) {
            return this.start(parseInt(levelMatch[1]));
        }
        // History
        if (trimmed === 'history') {
            return {
                success: true,
                output: this.history.map((h, i) => `  ${i + 1}. ${h}`).join('\n'),
            };
        }
        const pg = this.playgrounds.get(this.currentLevel);
        if (!pg) {
            return this.start(this.currentLevel);
        }
        return pg.execute(trimmed);
    }
    /**
     * Obtener el nivel actual.
     */
    getCurrentLevel() { return this.currentLevel; }
    /**
     * Listar todos los niveles disponibles.
     */
    listLevels() {
        return LEVEL_METADATA.map(m => `  L${m.level.toString().padStart(2, ' ')} — ${m.name}`).join('\n');
    }
    /**
     * Ejecutar una secuencia de comandos.
     */
    runScript(commands) {
        return commands.map(cmd => this.execute(cmd));
    }
}
exports.PlaygroundSession = PlaygroundSession;
// ============================================================
// Tutorial — Guia paso a paso para un nivel
// ============================================================
class Tutorial {
    id;
    level;
    title;
    description;
    steps;
    currentStep = 0;
    completed = false;
    constructor(id, level, title, description, steps) {
        this.id = id;
        this.level = level;
        this.title = title;
        this.description = description;
        this.steps = steps;
    }
    /**
     * Obtener el paso actual.
     */
    getCurrentStep() {
        if (this.currentStep >= this.steps.length)
            return null;
        return this.steps[this.currentStep];
    }
    /**
     * Avanzar al siguiente paso.
     */
    nextStep() {
        if (this.currentStep >= this.steps.length) {
            this.completed = true;
            return null;
        }
        this.currentStep++;
        if (this.currentStep >= this.steps.length) {
            this.completed = true;
        }
        return this.getCurrentStep();
    }
    /**
     * Reiniciar el tutorial.
     */
    reset() {
        this.currentStep = 0;
        this.completed = false;
    }
    /**
     * Progreso del tutorial.
     */
    progress() {
        return {
            current: this.currentStep,
            total: this.steps.length,
            percent: Math.round((this.currentStep / this.steps.length) * 100),
        };
    }
}
exports.Tutorial = Tutorial;
// ============================================================
// TutorialRegistry — 20 tutoriales predefinidos
// ============================================================
class TutorialRegistry {
    tutorials = new Map();
    constructor() {
        this.registerAll();
    }
    registerAll() {
        this.registerTutorial(TutorialBuilders.L0_Visual());
        this.registerTutorial(TutorialBuilders.L1_Execution());
        this.registerTutorial(TutorialBuilders.L2_State());
        this.registerTutorial(TutorialBuilders.L3_Dependency());
        this.registerTutorial(TutorialBuilders.L4_CallGraph());
        this.registerTutorial(TutorialBuilders.L5_CFG());
        this.registerTutorial(TutorialBuilders.L6_DataFlow());
        this.registerTutorial(TutorialBuilders.L7_Compute());
        this.registerTutorial(TutorialBuilders.L8_Knowledge());
        this.registerTutorial(TutorialBuilders.L9_Semantic());
        this.registerTutorial(TutorialBuilders.L10_Embedding());
        this.registerTutorial(TutorialBuilders.L11_GraphRAG());
        this.registerTutorial(TutorialBuilders.L12_Memory());
        this.registerTutorial(TutorialBuilders.L13_Agent());
        this.registerTutorial(TutorialBuilders.L14_Tool());
        this.registerTutorial(TutorialBuilders.L15_Workflow());
        this.registerTutorial(TutorialBuilders.L16_Network());
        this.registerTutorial(TutorialBuilders.L17_Social());
        this.registerTutorial(TutorialBuilders.L18_Biological());
        this.registerTutorial(TutorialBuilders.L19_Molecular());
    }
    registerTutorial(t) {
        this.tutorials.set(t.id, t);
    }
    /**
     * Obtener un tutorial por ID o nivel.
     */
    get(idOrLevel) {
        // Try by id
        if (this.tutorials.has(idOrLevel))
            return this.tutorials.get(idOrLevel);
        // Try by level number
        const level = parseInt(idOrLevel);
        if (!isNaN(level)) {
            return this.tutorials.get(`L${level}`);
        }
        return undefined;
    }
    /**
     * Listar todos los tutoriales.
     */
    list() {
        return Array.from(this.tutorials.values()).map(t => ({
            id: t.id,
            level: t.level,
            title: t.title,
            steps: t.steps.length,
        }));
    }
    /**
     * Contar tutoriales.
     */
    count() { return this.tutorials.size; }
    /**
     * Contar completados.
     */
    completedCount() {
        return Array.from(this.tutorials.values()).filter(t => t.completed).length;
    }
}
exports.TutorialRegistry = TutorialRegistry;
// ============================================================
// TutorialBuilders — Construye los 20 tutoriales
// ============================================================
class TutorialBuilders {
    static L0_Visual() {
        return new Tutorial('L0', 0, 'Visual Graph', 'Aprende a renderizar grafos con Mermaid, Graphviz y ASCII', [
            { id: 'L0-1', title: 'Crear grafo', description: 'Crea un grafo visual con createFromEdges', expectedCommand: 'create', hint: 'Usa el comando create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L0-2', title: 'Agregar nodos', description: 'Agrega nodos A, B, C al grafo', expectedCommand: 'add A', hint: 'add A, add B, add C', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L0-3', title: 'Visualizar', description: 'Visualiza el grafo como ASCII', expectedCommand: 'visualize', hint: 'Usa el comando visualize', validate: (i) => ({ passed: i === 'visualize', message: 'Escribe "visualize"' }) },
        ]);
    }
    static L1_Execution() {
        return new Tutorial('L1', 1, 'Execution Graph', 'Aprende ejecucion secuencial y paralela de nodos', [
            { id: 'L1-1', title: 'Crear grafo', description: 'Crea un grafo de ejecucion con createGraph', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L1-2', title: 'Ejecutar', description: 'Ejecuta el grafo con exec', expectedCommand: 'exec', hint: 'Usa exec', validate: (i) => ({ passed: i === 'exec', message: 'Escribe "exec"' }) },
            { id: 'L1-3', title: 'Ver stats', description: 'Revisa las estadisticas del grafo', expectedCommand: 'stats', hint: 'Usa stats', validate: (i) => ({ passed: i === 'stats', message: 'Escribe "stats"' }) },
        ]);
    }
    static L2_State() {
        return new Tutorial('L2', 2, 'State Machine', 'Aprende maquinas de estado con transiciones', [
            { id: 'L2-1', title: 'Crear maquina', description: 'Crea una maquina de estados', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L2-2', title: 'Agregar estados', description: 'Agrega estados: idle, running, done', expectedCommand: 'add idle', hint: 'add idle, add running, add done', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L2-3', title: 'Ver info', description: 'Muestra informacion del nivel', expectedCommand: 'info', hint: 'Usa info', validate: (i) => ({ passed: i === 'info', message: 'Escribe "info"' }) },
        ]);
    }
    static L3_Dependency() {
        return new Tutorial('L3', 3, 'Dependency Resolver', 'Aprende a resolver dependencias topologicas', [
            { id: 'L3-1', title: 'Crear', description: 'Crea un grafo de dependencias', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L3-2', title: 'Agregar aristas', description: 'Agrega dependencias con edge', expectedCommand: 'edge A B', hint: 'edge A B, edge B C', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
            { id: 'L3-3', title: 'Listar', description: 'Lista los nodos del grafo', expectedCommand: 'list', hint: 'Usa list', validate: (i) => ({ passed: i === 'list', message: 'Escribe "list"' }) },
        ]);
    }
    static L4_CallGraph() {
        return new Tutorial('L4', 4, 'Call Graph', 'Aprende a analizar llamadas entre funciones', [
            { id: 'L4-1', title: 'Crear', description: 'Crea un call graph', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L4-2', title: 'Agregar funciones', description: 'Agrega funciones: main, parse, render', expectedCommand: 'add main', hint: 'add main, add parse, add render', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L4-3', title: 'Conectar', description: 'Conecta main -> parse, parse -> render', expectedCommand: 'edge main parse', hint: 'edge main parse, edge parse render', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L5_CFG() {
        return new Tutorial('L5', 5, 'Control Flow Graph', 'Aprende CFG con bifurcaciones', [
            { id: 'L5-1', title: 'Crear CFG', description: 'Crea un grafo de flujo de control', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L5-2', title: 'Bloques basicos', description: 'Agrega bloques: entry, if, then, else, merge', expectedCommand: 'add entry', hint: 'add entry, add if, add then, add else, add merge', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L5-3', title: 'Bifurcaciones', description: 'Conecta con edges condicionales', expectedCommand: 'edge entry if', hint: 'edge entry if, edge if then, edge if else', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L6_DataFlow() {
        return new Tutorial('L6', 6, 'Data Flow Graph', 'Aprende analisis de flujo de datos', [
            { id: 'L6-1', title: 'Crear', description: 'Crea un grafo de flujo de datos', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L6-2', title: 'Agregar variables', description: 'Agrega nodos: x, y, z', expectedCommand: 'add x', hint: 'add x, add y, add z', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L6-3', title: 'Flujo', description: 'Conecta el flujo de datos', expectedCommand: 'edge x y', hint: 'edge x y, edge y z', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L7_Compute() {
        return new Tutorial('L7', 7, 'Computational Graph', 'Aprende MLP y redes neuronales', [
            { id: 'L7-1', title: 'Crear', description: 'Crea un grafo computacional', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L7-2', title: 'Capas', description: 'Agrega capas: input, hidden, output', expectedCommand: 'add input', hint: 'add input, add hidden, add output', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L7-3', title: 'Conectar', description: 'Conecta las capas en orden', expectedCommand: 'edge input hidden', hint: 'edge input hidden, edge hidden output', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L8_Knowledge() {
        return new Tutorial('L8', 8, 'Knowledge Graph', 'Aprende grafos de conocimiento', [
            { id: 'L8-1', title: 'Crear KG', description: 'Crea un grafo de conocimiento', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L8-2', title: 'Entidades', description: 'Agrega entidades: OpenAI, GPT-5, Transformer', expectedCommand: 'add OpenAI', hint: 'add OpenAI, add GPT-5, add Transformer', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L8-3', title: 'Relaciones', description: 'Conecta con relaciones semanticas', expectedCommand: 'edge OpenAI GPT-5', hint: 'edge OpenAI GPT-5 "created"', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L9_Semantic() {
        return new Tutorial('L9', 9, 'Semantic Graph', 'Aprende analisis semantico', [
            { id: 'L9-1', title: 'Crear', description: 'Crea un grafo semantico', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L9-2', title: 'Conceptos', description: 'Agrega conceptos: AI, ML, NLP', expectedCommand: 'add AI', hint: 'add AI, add ML, add NLP', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L9-3', title: 'Relaciones', description: 'Conecta conceptos semanticamente', expectedCommand: 'edge AI ML', hint: 'edge AI ML', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L10_Embedding() {
        return new Tutorial('L10', 10, 'Embedding Graph', 'Aprende vectores de embedding', [
            { id: 'L10-1', title: 'Crear', description: 'Crea un grafo de embeddings', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L10-2', title: 'Vectores', description: 'Agrega vectores de embedding', expectedCommand: 'add vec1', hint: 'add vec1, add vec2', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L10-3', title: 'Similitud', description: 'Conecta vectores similares', expectedCommand: 'edge vec1 vec2', hint: 'edge vec1 vec2', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L11_GraphRAG() {
        return new Tutorial('L11', 11, 'GraphRAG', 'Aprende RAG con indices de grafo', [
            { id: 'L11-1', title: 'Crear', description: 'Crea un indice RAG', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L11-2', title: 'Documentos', description: 'Agrega documentos al indice', expectedCommand: 'add doc1', hint: 'add doc1, add doc2', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L11-3', title: 'Indexar', description: 'Conecta documentos relacionados', expectedCommand: 'edge doc1 doc2', hint: 'edge doc1 doc2', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L12_Memory() {
        return new Tutorial('L12', 12, 'Memory Graph', 'Aprende memoria con capas', [
            { id: 'L12-1', title: 'Crear', description: 'Crea un grafo de memoria', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L12-2', title: 'Recuerdos', description: 'Agrega recuerdos: event1, event2', expectedCommand: 'add event1', hint: 'add event1, add event2', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L12-3', title: 'Consolidar', description: 'Conecta recuerdos relacionados', expectedCommand: 'edge event1 event2', hint: 'edge event1 event2', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L13_Agent() {
        return new Tutorial('L13', 13, 'Agent Graph', 'Aprende agentes autonomos', [
            { id: 'L13-1', title: 'Crear', description: 'Crea un grafo de agente', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L13-2', title: 'Agentes', description: 'Agrega agentes: planner, executor', expectedCommand: 'add planner', hint: 'add planner, add executor', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L13-3', title: 'Planificar', description: 'Conecta agentes en pipeline', expectedCommand: 'edge planner executor', hint: 'edge planner executor', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L14_Tool() {
        return new Tutorial('L14', 14, 'Tool Graph', 'Aprende herramientas ejecutables', [
            { id: 'L14-1', title: 'Crear', description: 'Crea un grafo de herramientas', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L14-2', title: 'Herramientas', description: 'Agrega herramientas: search, analyze', expectedCommand: 'add search', hint: 'add search, add analyze', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L14-3', title: 'Flujo', description: 'Conecta herramientas en pipeline', expectedCommand: 'edge search analyze', hint: 'edge search analyze', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L15_Workflow() {
        return new Tutorial('L15', 15, 'Workflow Graph', 'Aprende workflows con pasos', [
            { id: 'L15-1', title: 'Crear', description: 'Crea un workflow', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L15-2', title: 'Pasos', description: 'Agrega pasos: step1, step2, step3', expectedCommand: 'add step1', hint: 'add step1, step2, step3', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L15-3', title: 'Orden', description: 'Conecta pasos en orden', expectedCommand: 'edge step1 step2', hint: 'edge step1 step2, edge step2 step3', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L16_Network() {
        return new Tutorial('L16', 16, 'Network Graph', 'Aprende redes de nodos', [
            { id: 'L16-1', title: 'Crear', description: 'Crea una red', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L16-2', title: 'Nodos', description: 'Agrega nodos de red: router, switch, host', expectedCommand: 'add router', hint: 'add router, add switch, add host', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L16-3', title: 'Conexiones', description: 'Conecta nodos de red', expectedCommand: 'edge router switch', hint: 'edge router switch, edge switch host', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L17_Social() {
        return new Tutorial('L17', 17, 'Social Graph', 'Aprende grafos sociales', [
            { id: 'L17-1', title: 'Crear', description: 'Crea un grafo social', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L17-2', title: 'Usuarios', description: 'Agrega usuarios: alice, bob, carol', expectedCommand: 'add alice', hint: 'add alice, add bob, add carol', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L17-3', title: 'Amistades', description: 'Conecta amistades', expectedCommand: 'edge alice bob', hint: 'edge alice bob, edge bob carol', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L18_Biological() {
        return new Tutorial('L18', 18, 'Biological Graph', 'Aprende grafos biologicos', [
            { id: 'L18-1', title: 'Crear', description: 'Crea un grafo biologico', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L18-2', title: 'Proteinas', description: 'Agrega proteinas: p53, BRCA1, EGFR', expectedCommand: 'add p53', hint: 'add p53, add BRCA1, add EGFR', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L18-3', title: 'Rutas', description: 'Conecta rutas metabolicas', expectedCommand: 'edge p53 BRCA1', hint: 'edge p53 BRCA1', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
    static L19_Molecular() {
        return new Tutorial('L19', 19, 'Molecular Graph', 'Aprende grafos moleculares', [
            { id: 'L19-1', title: 'Crear', description: 'Crea un grafo molecular', expectedCommand: 'create', hint: 'Usa create', validate: (i) => ({ passed: i.includes('create'), message: 'Escribe "create"' }) },
            { id: 'L19-2', title: 'Atomos', description: 'Agrega atomos: C, H, O, N', expectedCommand: 'add C', hint: 'add C, add H, add O, add N', validate: (i) => ({ passed: i.includes('add'), message: 'Usa add <id>' }) },
            { id: 'L19-3', title: 'Enlaces', description: 'Conecta atomos con enlaces', expectedCommand: 'edge C H', hint: 'edge C H, edge C O', validate: (i) => ({ passed: i.includes('edge'), message: 'Usa edge <src> <tgt>' }) },
        ]);
    }
}
// ============================================================
// TutorialRunner — Ejecuta tutoriales interactivamente
// ============================================================
class TutorialRunner {
    registry;
    currentTutorial = null;
    playground;
    constructor() {
        this.registry = new TutorialRegistry();
        this.playground = new PlaygroundSession();
    }
    /**
     * Iniciar un tutorial por nivel o ID.
     */
    start(levelOrId) {
        const tutorial = this.registry.get(levelOrId);
        if (!tutorial) {
            const available = this.registry.list().map(t => `  ${t.id} — ${t.title} (${t.steps} steps)`).join('\n');
            return {
                success: false,
                output: `Tutorial "${levelOrId}" not found.\n\nAvailable tutorials:\n${available}`,
            };
        }
        tutorial.reset();
        this.currentTutorial = tutorial;
        // Start playground for this level
        this.playground.start(tutorial.level);
        const step = tutorial.getCurrentStep();
        return {
            success: true,
            output: `=== Tutorial: ${tutorial.title} ===\n${tutorial.description}\n\nStep ${tutorial.currentStep + 1}/${tutorial.steps.length}: ${step?.title}\n  ${step?.description}\n\nHint: ${step?.hint}`,
        };
    }
    /**
     * Ejecutar un comando en el tutorial actual.
     */
    execute(input) {
        if (!this.currentTutorial) {
            return { success: false, output: 'No tutorial started. Use "start <level>" to begin.' };
        }
        const step = this.currentTutorial.getCurrentStep();
        if (!step) {
            return { success: true, output: 'Tutorial completed! Type "start <level>" for another.' };
        }
        // Check for special commands
        if (input === 'hint') {
            return { success: true, output: `Hint: ${step.hint}` };
        }
        if (input === 'skip') {
            this.currentTutorial.nextStep();
            const next = this.currentTutorial.getCurrentStep();
            if (!next) {
                return { success: true, output: 'Tutorial completed! All steps done.' };
            }
            return {
                success: true,
                output: `Skipped. Next step ${this.currentTutorial.currentStep + 1}/${this.currentTutorial.steps.length}: ${next.title}\n  ${next.description}`,
            };
        }
        if (input === 'progress') {
            const p = this.currentTutorial.progress();
            return { success: true, output: `Progress: ${p.current}/${p.total} (${p.percent}%)` };
        }
        if (input === 'exit') {
            this.currentTutorial = null;
            return { success: true, output: 'Tutorial ended.' };
        }
        // Validate the input
        const validation = step.validate(input, this.playground['playgrounds'].get(this.currentTutorial.level)?.context || { level: 0, levelName: '', graph: {}, state: new Map() });
        if (validation.passed) {
            // Execute in playground
            const pgResult = this.playground.execute(input);
            this.currentTutorial.nextStep();
            const next = this.currentTutorial.getCurrentStep();
            if (!next) {
                return {
                    success: true,
                    output: `${pgResult.output}\n\nTutorial completed! All steps done.`,
                };
            }
            return {
                success: true,
                output: `${pgResult.output}\n\nStep ${this.currentTutorial.currentStep + 1}/${this.currentTutorial.steps.length}: ${next.title}\n  ${next.description}\n\nHint: ${next.hint}`,
            };
        }
        return {
            success: false,
            output: validation.message,
        };
    }
    /**
     * Listar tutoriales disponibles.
     */
    listTutorials() {
        return this.registry.list().map(t => `  ${t.id.padEnd(4)} — ${t.title.padEnd(20)} (${t.steps} steps)`).join('\n');
    }
    /**
     * Obtener el tutorial actual.
     */
    getCurrent() { return this.currentTutorial; }
    /**
     * Obtener el registry.
     */
    getRegistry() { return this.registry; }
}
exports.TutorialRunner = TutorialRunner;
//# sourceMappingURL=playground.js.map