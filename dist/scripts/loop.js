#!/usr/bin/env tsx
"use strict";
/**
 * /LOOP — El ciclo vivo del proyecto COS Graph Engine
 *
 * Uso:
 *   npx tsx scripts/loop.ts status          — Ver estado actual
 *   npx tsx scripts/loop.ts start <ticket>  — Iniciar un ticket
 *   npx tsx scripts/loop.ts commit <ticket> — Marcar ticket completado
 *   npx tsx scripts/loop.ts board           — Ver tablero Kanban
 *   npx tsx scripts/loop.ts phase <N>       — Ver detalle de fase
 *   npx tsx scripts/loop.ts check           — Ejecutar checklist de calidad
 *   npx tsx scripts/loop.ts init            — Inicializar el loop
 */
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
// ─── Estado ────────────────────────────────────────────────────────────────
const LOOP_DIR = (0, path_1.join)(__dirname, '..', '.loop');
const STATE_FILE = (0, path_1.join)(LOOP_DIR, 'state.json');
const BOARD_FILE = (0, path_1.join)(LOOP_DIR, 'board.json');
function initState() {
    return {
        faseActual: 3,
        ticketActual: null,
        tickets: [],
        metricas: { tests: 390, cobertura: 70, mutationAPICount: 2, serializacionCount: 1, adjMapCount: 2, smbIntegration: false },
    };
}
function loadState() {
    if (!(0, fs_1.existsSync)(STATE_FILE))
        return initState();
    return JSON.parse((0, fs_1.readFileSync)(STATE_FILE, 'utf-8'));
}
function saveState(state) {
    if (!(0, fs_1.existsSync)(LOOP_DIR))
        (0, fs_1.mkdirSync)(LOOP_DIR, { recursive: true });
    (0, fs_1.writeFileSync)(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}
// ─── Fases ─────────────────────────────────────────────────────────────────
const FASES = [
    { id: 1, nombre: 'Refactor Adversarial', objetivo: '14 fixes + 1 bug en L1, L3, L7', metaTests: 390, metaCobertura: 70 },
    { id: 2, nombre: 'Entrega y Documentacion', objetivo: 'CI/CD, benchmark report, release notes, plan maestro', metaTests: 390, metaCobertura: 70 },
    { id: 3, nombre: 'Consolidacion', objetivo: 'Tooling, coverage, docs, validacion L4-L11', metaTests: 450, metaCobertura: 80 },
    { id: 4, nombre: 'Integracion SMB', objetivo: 'L7 + L12 al Shared Memory Bus', metaTests: 500, metaCobertura: 80 },
    { id: 5, nombre: 'Homogeneizacion L4-L19', objetivo: 'Mutation API + serializacion + adjacency maps en todos los niveles', metaTests: 700, metaCobertura: 85 },
    { id: 6, nombre: 'Expansion de Tests', objetivo: '40+ tests por nivel, 2000+ total', metaTests: 1300, metaCobertura: 90 },
    { id: 7, nombre: 'Endurecimiento', objetivo: 'Edge cases, errores, logging, profiling', metaTests: 1800, metaCobertura: 95 },
    { id: 8, nombre: 'Release y Ecosistema', objetivo: 'Galeria, playground, npm publish, v2.0.0', metaTests: 2000, metaCobertura: 95 },
];
// ─── Tickets predefinidos ─────────────────────────────────────────────────
function getTicketsFase4() {
    return [
        { id: 'T-4.1', titulo: 'Conectar L7 al Shared Memory Bus', fase: 4, nivel: 'L7', tipo: 'feature', prioridad: 'P0', estimacion: 8, dependencias: ['T-3.5'], estado: 'diseniando', descripcion: 'saveToSMB() y loadFromSMB() en ComputationalGraph', archivos: ['packages/graph/src/level7-compute.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-4.2', titulo: 'Conectar L12 al Shared Memory Bus', fase: 4, nivel: 'L12', tipo: 'feature', prioridad: 'P0', estimacion: 8, dependencias: ['T-4.1'], estado: 'diseniando', descripcion: 'MemoryGraphEngine persiste en SMB', archivos: ['packages/graph/src/level12-memory.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-4.3', titulo: 'Tests de integracion SMB', fase: 4, nivel: 'L7-L12', tipo: 'testing', prioridad: 'P0', estimacion: 8, dependencias: ['T-4.2'], estado: 'diseniando', descripcion: 'Round-trip: guardar y cargar grafos desde SMB', archivos: ['scripts/test-smb-integration.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-4.4', titulo: 'Operacionalizar memory-manager AI Employee', fase: 4, nivel: 'infra', tipo: 'feature', prioridad: 'P1', estimacion: 4, dependencias: ['T-4.3'], estado: 'diseniando', descripcion: 'Delegar operaciones SMB al AI Employee', archivos: ['.higgsfield/agents/memory-manager.md'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-4.5', titulo: 'Documentacion de integracion SMB', fase: 4, nivel: 'docs', tipo: 'documentation', prioridad: 'P2', estimacion: 4, dependencias: ['T-4.4'], estado: 'diseniando', descripcion: 'docs/smb-integration.md con ejemplos', archivos: ['docs/smb-integration.md'], creado: new Date().toISOString(), notas: '' },
    ];
}
function getTicketsFase5() {
    return [
        { id: 'T-5.1', titulo: 'Mutation API L4-L6', fase: 5, nivel: 'L4-L6', tipo: 'feature', prioridad: 'P0', estimacion: 6, dependencias: ['T-3.8'], estado: 'diseniando', descripcion: 'addNode/removeNode/addEdge/removeEdge en L4 Call, L5 CFG, L6 DataFlow', archivos: ['packages/graph/src/level4-call.ts', 'packages/graph/src/level5-cfg.ts', 'packages/graph/src/level6-dataflow.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-5.2', titulo: 'Mutation API L8-L11', fase: 5, nivel: 'L8-L11', tipo: 'feature', prioridad: 'P0', estimacion: 8, dependencias: ['T-5.1'], estado: 'diseniando', descripcion: 'Mutation API en L8-L11', archivos: ['packages/graph/src/level8-knowledge.ts', 'packages/graph/src/level9-semantic.ts', 'packages/graph/src/level10-embedding.ts', 'packages/graph/src/level11-graphrag.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-5.3', titulo: 'Mutation API L12-L19', fase: 5, nivel: 'L12-L19', tipo: 'feature', prioridad: 'P0', estimacion: 12, dependencias: ['T-5.2'], estado: 'diseniando', descripcion: 'Mutation API en L12-L19', archivos: ['packages/graph/src/level12-memory.ts', 'packages/graph/src/level13-agent.ts', 'packages/graph/src/level14-tool.ts', 'packages/graph/src/level15-workflow.ts', 'packages/graph/src/level16-network.ts', 'packages/graph/src/level17-social.ts', 'packages/graph/src/level18-biological.ts', 'packages/graph/src/level19-molecular.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-5.4', titulo: 'Serializacion L4-L11', fase: 5, nivel: 'L4-L11', tipo: 'feature', prioridad: 'P1', estimacion: 8, dependencias: ['T-5.2'], estado: 'diseniando', descripcion: 'toJSON/fromJSON en L4-L11', archivos: ['packages/graph/src/level4-call.ts', 'packages/graph/src/level5-cfg.ts', 'packages/graph/src/level6-dataflow.ts', 'packages/graph/src/level8-knowledge.ts', 'packages/graph/src/level9-semantic.ts', 'packages/graph/src/level10-embedding.ts', 'packages/graph/src/level11-graphrag.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-5.5', titulo: 'Serializacion L12-L19', fase: 5, nivel: 'L12-L19', tipo: 'feature', prioridad: 'P1', estimacion: 8, dependencias: ['T-5.4'], estado: 'diseniando', descripcion: 'toJSON/fromJSON en L12-L19', archivos: ['packages/graph/src/level12-memory.ts', 'packages/graph/src/level13-agent.ts', 'packages/graph/src/level14-tool.ts', 'packages/graph/src/level15-workflow.ts', 'packages/graph/src/level16-network.ts', 'packages/graph/src/level17-social.ts', 'packages/graph/src/level18-biological.ts', 'packages/graph/src/level19-molecular.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-5.6', titulo: 'Adjacency maps L4-L19', fase: 5, nivel: 'L4-L19', tipo: 'performance', prioridad: 'P1', estimacion: 12, dependencias: ['T-5.5'], estado: 'diseniando', descripcion: 'Reemplazar O(n*m) por O(n+m) en todos los niveles', archivos: ['packages/graph/src/level4-call.ts', 'packages/graph/src/level5-cfg.ts', 'packages/graph/src/level6-dataflow.ts', 'packages/graph/src/level8-knowledge.ts', 'packages/graph/src/level9-semantic.ts', 'packages/graph/src/level10-embedding.ts', 'packages/graph/src/level11-graphrag.ts', 'packages/graph/src/level12-memory.ts', 'packages/graph/src/level13-agent.ts', 'packages/graph/src/level14-tool.ts', 'packages/graph/src/level15-workflow.ts', 'packages/graph/src/level16-network.ts', 'packages/graph/src/level17-social.ts', 'packages/graph/src/level18-biological.ts', 'packages/graph/src/level19-molecular.ts'], creado: new Date().toISOString(), notas: '' },
    ];
}
function getTicketsFase6() {
    return [
        { id: 'T-6.1', titulo: 'Tests L4 Call Graph', fase: 6, nivel: 'L4', tipo: 'testing', prioridad: 'P2', estimacion: 4, dependencias: ['T-5.1'], estado: 'diseniando', descripcion: '40 tests: creacion, tracing, flame graph, hot paths', archivos: ['scripts/test-level4-call.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-6.2', titulo: 'Tests L5 CFG', fase: 6, nivel: 'L5', tipo: 'testing', prioridad: 'P2', estimacion: 4, dependencias: ['T-5.1'], estado: 'diseniando', descripcion: '40 tests: if/then/else, loops, switch, dominators', archivos: ['scripts/test-level5-cfg.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-6.3', titulo: 'Tests L6 DataFlow', fase: 6, nivel: 'L6', tipo: 'testing', prioridad: 'P2', estimacion: 4, dependencias: ['T-5.1'], estado: 'diseniando', descripcion: '40 tests: pipelines, bottlenecks, critical path', archivos: ['scripts/test-level6-dataflow.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-6.4', titulo: 'Tests L8-L11', fase: 6, nivel: 'L8-L11', tipo: 'testing', prioridad: 'P2', estimacion: 12, dependencias: ['T-5.2'], estado: 'diseniando', descripcion: '160 tests (40x nivel): Knowledge, Semantic, Embedding, GraphRAG', archivos: ['scripts/test-level8-knowledge.ts', 'scripts/test-level9-semantic.ts', 'scripts/test-level10-embedding.ts', 'scripts/test-level11-graphrag.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-6.5', titulo: 'Tests L12-L15', fase: 6, nivel: 'L12-L15', tipo: 'testing', prioridad: 'P2', estimacion: 12, dependencias: ['T-5.3'], estado: 'diseniando', descripcion: '160 tests (40x nivel): Memory, Agent, Tool, Workflow', archivos: ['scripts/test-level12-memory.ts', 'scripts/test-level13-agent.ts', 'scripts/test-level14-tool.ts', 'scripts/test-level15-workflow.ts'], creado: new Date().toISOString(), notas: '' },
        { id: 'T-6.6', titulo: 'Tests L16-L19', fase: 6, nivel: 'L16-L19', tipo: 'testing', prioridad: 'P2', estimacion: 12, dependencias: ['T-5.3'], estado: 'diseniando', descripcion: '160 tests (40x nivel): Network, Social, Biological, Molecular', archivos: ['scripts/test-level16-network.ts', 'scripts/test-level17-social.ts', 'scripts/test-level18-biological.ts', 'scripts/test-level19-molecular.ts'], creado: new Date().toISOString(), notas: '' },
    ];
}
function getTicketsFase3() {
    return [
        {
            id: 'T-3.1', titulo: 'npm scripts en package.json', fase: 3, nivel: 'infra',
            tipo: 'infra', prioridad: 'P1', estimacion: 1, estado: 'diseniando',
            dependencias: [], descripcion: 'Agregar test:all, test:l1, test:l3, test:l7, benchmark, ci scripts',
            archivos: ['package.json'], creado: new Date().toISOString(), notas: '',
        },
        {
            id: 'T-3.2', titulo: 'benchmark-report dinamico', fase: 3, nivel: 'infra',
            tipo: 'feature', prioridad: 'P1', estimacion: 3, estado: 'diseniando',
            dependencias: ['T-3.1'], descripcion: 'benchmark-perf.ts escribe JSON, generate-benchmark-report.ts lo lee',
            archivos: ['scripts/benchmark-perf.ts', 'scripts/generate-benchmark-report.ts'], creado: new Date().toISOString(), notas: '',
        },
        {
            id: 'T-3.3', titulo: 'Auto-release en push a main', fase: 3, nivel: 'infra',
            tipo: 'infra', prioridad: 'P2', estimacion: 4, estado: 'diseniando',
            dependencias: ['T-3.1'], descripcion: 'Job release en CI: tag + GitHub Release con RELEASE-v*.md',
            archivos: ['.github/workflows/ci.yml'], creado: new Date().toISOString(), notas: '',
        },
        {
            id: 'T-3.4', titulo: 'Cobertura de codigo con c8', fase: 3, nivel: 'infra',
            tipo: 'infra', prioridad: 'P2', estimacion: 3, estado: 'diseniando',
            dependencias: ['T-3.1'], descripcion: 'Instalar c8, configurar .c8rc.json, job coverage en CI',
            archivos: ['package.json', '.c8rc.json', '.github/workflows/ci.yml'], creado: new Date().toISOString(), notas: '',
        },
        {
            id: 'T-3.5', titulo: 'README actualizado', fase: 3, nivel: 'docs',
            tipo: 'documentation', prioridad: 'P1', estimacion: 2, estado: 'diseniando',
            dependencias: ['T-3.1'], descripcion: 'Badges, tabla de tests, enlaces a nuevos documentos',
            archivos: ['README.md'], creado: new Date().toISOString(), notas: '',
        },
        {
            id: 'T-3.6', titulo: 'CONTRIBUTING.md', fase: 3, nivel: 'docs',
            tipo: 'documentation', prioridad: 'P2', estimacion: 3, estado: 'diseniando',
            dependencias: ['T-3.5'], descripcion: 'Guia de contribucion: setup, branch strategy, estandar, tests, CI/CD, code review',
            archivos: ['CONTRIBUTING.md'], creado: new Date().toISOString(), notas: '',
        },
        {
            id: 'T-3.7', titulo: 'API Reference con TypeDoc', fase: 3, nivel: 'docs',
            tipo: 'documentation', prioridad: 'P3', estimacion: 8, estado: 'diseniando',
            dependencias: ['T-3.5'], descripcion: 'typedoc.json, docs:generate, docs:serve scripts, GitHub Pages opcional',
            archivos: ['typedoc.json', 'package.json'], creado: new Date().toISOString(), notas: '',
        },
        {
            id: 'T-3.8', titulo: 'Validacion de grafos L4-L11', fase: 3, nivel: 'L4-L11',
            tipo: 'feature', prioridad: 'P2', estimacion: 3, estado: 'diseniando',
            dependencias: [], descripcion: 'Agregar validacion de IDs duplicados y edges colgantes en L4-L11',
            archivos: ['packages/graph/src/level4-call.ts', 'packages/graph/src/level5-cfg.ts', 'packages/graph/src/level6-dataflow.ts',
                'packages/graph/src/level8-knowledge.ts', 'packages/graph/src/level9-semantic.ts',
                'packages/graph/src/level10-embedding.ts', 'packages/graph/src/level11-graphrag.ts'],
            creado: new Date().toISOString(), notas: '',
        },
    ];
}
// ─── Comandos ──────────────────────────────────────────────────────────────
function cmdStatus() {
    const state = loadState();
    const fase = FASES.find(f => f.id === state.faseActual);
    if (!fase) {
        console.error('Fase no encontrada');
        return;
    }
    console.log('\n══════════════════════════════════════════════');
    console.log('  /LOOP — COS Graph Engine');
    console.log('══════════════════════════════════════════════\n');
    console.log(`Fase actual: ${fase.id}. ${fase.nombre}`);
    console.log(`Objetivo:     ${fase.objetivo}`);
    console.log(`Ticket activo: ${state.ticketActual || '(ninguno)'}`);
    console.log('');
    // Tabla de fases
    console.log('Fases:');
    console.log('  #  | Nombre                    | Meta tests | Estado');
    console.log('  ---|---------------------------|------------|-------');
    for (const f of FASES) {
        const done = f.id < state.faseActual ? '✅' : f.id === state.faseActual ? '▶' : '⬜';
        const meta = f.metaTests.toString().padStart(10);
        console.log(`  ${f.id}  | ${f.nombre.padEnd(26)} | ${meta}      | ${done}`);
    }
    // Metricas
    console.log('\nMetricas actuales:');
    console.log(`  Tests:             ${state.metricas.tests}`);
    console.log(`  Cobertura:         ${state.metricas.cobertura}%`);
    console.log(`  Mutation API:      ${state.metricas.mutationAPICount}/20 niveles`);
    console.log(`  Serializacion:     ${state.metricas.serializacionCount}/20 niveles`);
    console.log(`  Adjacency maps:    ${state.metricas.adjMapCount}/20 niveles`);
    console.log(`  Integracion SMB:   ${state.metricas.smbIntegration ? 'Si' : 'No'}`);
    console.log('\n══════════════════════════════════════════════\n');
}
function cmdStart(ticketId) {
    const state = loadState();
    const ticket = state.tickets.find(t => t.id === ticketId);
    if (!ticket) {
        console.error(`Ticket ${ticketId} no encontrado`);
        return;
    }
    // Verificar dependencias
    for (const dep of ticket.dependencias) {
        const depTicket = state.tickets.find(t => t.id === dep);
        if (depTicket && depTicket.estado !== 'completado') {
            console.error(`Dependencia no cumplida: ${dep} (${depTicket?.estado})`);
            return;
        }
    }
    ticket.estado = 'ejecutando';
    ticket.iniciado = new Date().toISOString();
    state.ticketActual = ticketId;
    saveState(state);
    console.log(`\n▶ Iniciando ${ticketId}: ${ticket.titulo}`);
    console.log(`  Tipo: ${ticket.tipo} | Prioridad: ${ticket.prioridad}`);
    console.log(`  Archivos: ${ticket.archivos.join(', ')}`);
    console.log(`  Descripcion: ${ticket.descripcion}`);
    console.log('\n  /LOOP: DISENIAR → PLANIFICAR → EJECUTAR → VALIDAR → TESTEAR → REFACTORIZAR → DEBUGGEAR');
    console.log('  Sigue el checklist: npx tsx scripts/loop.ts check\n');
}
function cmdCommit(ticketId) {
    const state = loadState();
    const ticket = state.tickets.find(t => t.id === ticketId);
    if (!ticket) {
        console.error(`Ticket ${ticketId} no encontrado`);
        return;
    }
    ticket.estado = 'completado';
    ticket.completado = new Date().toISOString();
    state.ticketActual = null;
    saveState(state);
    console.log(`\n✅ ${ticketId}: ${ticket.titulo} COMPLETADO`);
    console.log(`  Iniciado: ${ticket.iniciado}`);
    console.log(`  Completado: ${ticket.completado}`);
    console.log('  No olvides: git add -A && git commit -m "feat: ${ticket.titulo}" && git push\n');
}
function cmdBoard() {
    const state = loadState();
    const columns = ['diseniando', 'planificado', 'ejecutando', 'validando',
        'testeando', 'refactorizando', 'debuggeando', 'completado', 'bloqueado'];
    const columnLabels = {
        diseniando: '🎨 Diseniando',
        planificado: '📋 Planificado',
        ejecutando: '⚡ Ejecutando',
        validando: '🔍 Validando',
        testeando: '🧪 Testeando',
        refactorizando: '🔧 Refactorizando',
        debuggeando: '🐛 Debuggeando',
        completado: '✅ Completado',
        bloqueado: '🚫 Bloqueado',
    };
    console.log('\n══════════════════════════════════════════════');
    console.log('  TABLERO KANBAN — COS Graph Engine');
    console.log('══════════════════════════════════════════════\n');
    // Fase 3-6 tickets
    const fase3Tickets = getTicketsFase3();
    const fase4Tickets = getTicketsFase4();
    const fase5Tickets = getTicketsFase5();
    const fase6Tickets = getTicketsFase6();
    // Combinar con estado guardado
    const allTickets = [...state.tickets];
    for (const t of [...fase3Tickets, ...fase4Tickets, ...fase5Tickets, ...fase6Tickets]) {
        if (!allTickets.find(st => st.id === t.id)) {
            allTickets.push(t);
        }
    }
    // Actualizar estado desde state
    for (const t of allTickets) {
        const saved = state.tickets.find(st => st.id === t.id);
        if (saved)
            t.estado = saved.estado;
    }
    for (const col of columns) {
        const items = allTickets.filter(t => t.estado === col);
        if (items.length === 0 && col !== 'completado')
            continue;
        console.log(`  ${columnLabels[col]}:`);
        if (items.length === 0) {
            console.log('    (vacio)');
        }
        else {
            for (const t of items) {
                const fase = FASES.find(f => f.id === t.fase);
                const faseStr = fase ? `[F${t.fase}]` : '';
                const info = t.iniciado ? ` (iniciado ${new Date(t.iniciado).toLocaleDateString()})` : '';
                console.log(`    ${t.id.padEnd(8)} ${t.titulo.padEnd(40)} ${faseStr} ${t.prioridad} ~${t.estimacion}h${info}`);
            }
        }
        console.log('');
    }
    console.log(`  📊 Total: ${allTickets.length} tickets | Completados: ${allTickets.filter(t => t.estado === 'completado').length}`);
    console.log('══════════════════════════════════════════════\n');
}
function cmdPhase(faseId) {
    const fase = FASES.find(f => f.id === faseId);
    if (!fase) {
        console.error(`Fase ${faseId} no encontrada`);
        return;
    }
    console.log(`\n══════════════════════════════════════════════`);
    console.log(`  FASE ${fase.id}: ${fase.nombre}`);
    console.log(`  ${fase.objetivo}`);
    console.log(`  Meta: ${fase.metaTests} tests, ${fase.metaCobertura}% cobertura`);
    console.log('══════════════════════════════════════════════\n');
    // Mostrar tickets de esta fase
    const state = loadState();
    const faseTickets = state.tickets.filter(t => t.fase === faseId);
    const allTickets = [...faseTickets];
    // Agregar predefinidos segun fase
    const ticketMap = {
        3: getTicketsFase3,
        4: getTicketsFase4,
        5: getTicketsFase5,
        6: getTicketsFase6,
    };
    if (ticketMap[faseId]) {
        for (const t of ticketMap[faseId]()) {
            if (!allTickets.find(st => st.id === t.id))
                allTickets.push(t);
        }
    }
    if (allTickets.length === 0) {
        console.log('  No hay tickets en esta fase.');
        return;
    }
    const totalH = allTickets.reduce((s, t) => s + t.estimacion, 0);
    const done = allTickets.filter(t => t.estado === 'completado').length;
    console.log(`  Tickets: ${allTickets.length} | Completados: ${done} | Estimacion: ${totalH}h\n`);
    for (const t of allTickets) {
        const icon = t.estado === 'completado' ? '✅' : t.estado === 'ejecutando' ? '▶' : '⬜';
        const deps = t.dependencias.length > 0 ? ` [dep: ${t.dependencias.join(', ')}]` : '';
        console.log(`  ${icon} ${t.id} ${t.titulo} (${t.prioridad}, ~${t.estimacion}h)${deps}`);
        console.log(`     ${t.descripcion}`);
        console.log(`     Archivos: ${t.archivos.join(', ')}`);
        console.log('');
    }
}
function cmdCheck() {
    console.log('\n══════════════════════════════════════════════');
    console.log('  CHECKLIST DE CALIDAD — /LOOP');
    console.log('══════════════════════════════════════════════\n');
    const checks = [
        { id: 'C1', label: 'Tests pasan (npm run test:all)', cmd: 'cd /home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/cos && timeout 60 npx tsx scripts/run-tests.ts 2>/dev/null | grep -c "0 failed"' },
        { id: 'C2', label: 'L1 Diamond + Mutation tests', cmd: 'cd /home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/cos && timeout 30 npx tsx scripts/test-level1-diamond.ts 2>/dev/null | grep -c "0 failed" && timeout 30 npx tsx scripts/test-level1-mutation.ts 2>/dev/null | grep -c "0 failed"' },
        { id: 'C3', label: 'L3 Consistency + Mutation tests', cmd: 'cd /home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/cos && timeout 30 npx tsx scripts/test-level3-consistency.ts 2>/dev/null | grep -c "0 failed" && timeout 30 npx tsx scripts/test-level3-mutation.ts 2>/dev/null | grep -c "0 failed"' },
        { id: 'C4', label: 'L7 Compute tests', cmd: 'cd /home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/cos && timeout 30 npx tsx scripts/test-level7-compute.ts 2>/dev/null | grep -c "0 failed"' },
        { id: 'C5', label: 'L12-19 tests', cmd: 'cd /home/user/fc2e469b-3fc1-4ac4-a592-29871a071d02/cos && timeout 30 npx tsx scripts/test-levels-12-19.ts 2>/dev/null | grep -c "0 failed"' },
    ];
    let allPassed = true;
    for (const check of checks) {
        process.stdout.write(`  ${check.id}: ${check.label}... `);
        try {
            const output = (0, child_process_1.execSync)(check.cmd, { encoding: 'utf-8', timeout: 120000 });
            // grep -c returns the count; we check if it's > 0
            const count = parseInt(output.trim(), 10);
            if (count > 0) {
                console.log('✅');
            }
            else {
                console.log('❌');
                console.log(`     grep returned 0 matches`);
                allPassed = false;
            }
        }
        catch (e) {
            console.log('❌ (error)');
            console.log(`     ${e.message?.split('\n')[0] || 'Unknown error'}`);
            allPassed = false;
        }
    }
    console.log(allPassed ? '\n  ✅ CHECKLIST COMPLETO — TODO VERDE\n' : '\n  ❌ ALGUNOS CHECKS FALLARON — Revisar arriba\n');
}
function cmdInit() {
    const state = loadState();
    // Inicializar tickets de Fase 3-6
    const allTicketSets = [
        ...getTicketsFase3(),
        ...getTicketsFase4(),
        ...getTicketsFase5(),
        ...getTicketsFase6(),
    ];
    for (const t of allTicketSets) {
        if (!state.tickets.find(st => st.id === t.id)) {
            t.estado = 'diseniando';
            state.tickets.push(t);
        }
    }
    state.faseActual = 3;
    saveState(state);
    console.log('\n✅ /LOOP inicializado');
    console.log(`  Fase actual: 3. Consolidacion`);
    console.log(`  Tickets: ${state.tickets.length} (Fases 3-6)`);
    console.log(`  Para empezar: npx tsx scripts/loop.ts start T-3.1\n`);
    console.log('  Proximo: T-3.1 npm scripts (sin dependencias)');
    console.log('  Paralelo: T-3.8 validacion L4-L11 (tampoco tiene deps)\n');
    console.log('  Fase 4: Integracion SMB (5 tickets, ~32h)');
    console.log('  Fase 5: Homogeneizacion L4-L19 (6 tickets, ~54h)');
    console.log('  Fase 6: Expansion de Tests (6 tickets, ~48h)\n');
}
// ─── Main ─────────────────────────────────────────────────────────────────
function main() {
    const args = process.argv.slice(2);
    const cmd = args[0] || 'status';
    switch (cmd) {
        case 'status':
            cmdStatus();
            break;
        case 'start':
            if (!args[1]) {
                console.error('Uso: npx tsx scripts/loop.ts start <ticket-id>');
                return;
            }
            cmdStart(args[1]);
            break;
        case 'commit':
            if (!args[1]) {
                console.error('Uso: npx tsx scripts/loop.ts commit <ticket-id>');
                return;
            }
            cmdCommit(args[1]);
            break;
        case 'board':
            cmdBoard();
            break;
        case 'phase':
            if (!args[1]) {
                console.error('Uso: npx tsx scripts/loop.ts phase <N>');
                return;
            }
            cmdPhase(parseInt(args[1], 10));
            break;
        case 'check':
            cmdCheck();
            break;
        case 'init':
            cmdInit();
            break;
        default:
            console.log('Comandos: status, start <ticket>, commit <ticket>, board, phase <N>, check, init');
    }
}
main();
//# sourceMappingURL=loop.js.map