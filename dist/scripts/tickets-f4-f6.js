"use strict";
/**
 * Tickets de Fases 4-6 para cargar en /LOOP
 * Uso: importar en loop.ts o copiar al state.json
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKETS_FASE6 = exports.TICKETS_FASE5 = exports.TICKETS_FASE4 = void 0;
exports.TICKETS_FASE4 = [
    {
        id: 'T-4.1', titulo: 'Conectar L7 al Shared Memory Bus', fase: 4, nivel: 'L7',
        tipo: 'feature', prioridad: 'P0', estimacion: 8,
        dependencias: ['T-3.5'], descripcion: 'saveToSMB() y loadFromSMB() en ComputationalGraph',
        archivos: ['packages/graph/src/level7-compute.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-4.2', titulo: 'Conectar L12 al Shared Memory Bus', fase: 4, nivel: 'L12',
        tipo: 'feature', prioridad: 'P0', estimacion: 8,
        dependencias: ['T-4.1'], descripcion: 'MemoryGraphEngine persiste en SMB',
        archivos: ['packages/graph/src/level12-memory.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-4.3', titulo: 'Tests de integracion SMB', fase: 4, nivel: 'L7-L12',
        tipo: 'testing', prioridad: 'P0', estimacion: 8,
        dependencias: ['T-4.2'], descripcion: 'Round-trip: guardar y cargar grafos desde SMB',
        archivos: ['scripts/test-smb-integration.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-4.4', titulo: 'Operacionalizar memory-manager AI Employee', fase: 4, nivel: 'infra',
        tipo: 'feature', prioridad: 'P1', estimacion: 4,
        dependencias: ['T-4.3'], descripcion: 'Delegar operaciones SMB al AI Employee memory-manager',
        archivos: ['.higgsfield/agents/memory-manager.md'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-4.5', titulo: 'Documentacion de integracion SMB', fase: 4, nivel: 'docs',
        tipo: 'documentation', prioridad: 'P2', estimacion: 4,
        dependencias: ['T-4.4'], descripcion: 'docs/smb-integration.md con ejemplos de uso',
        archivos: ['docs/smb-integration.md'], creado: new Date().toISOString(), notas: '',
    },
];
exports.TICKETS_FASE5 = [
    {
        id: 'T-5.1', titulo: 'Mutation API L4-L6', fase: 5, nivel: 'L4-L6',
        tipo: 'feature', prioridad: 'P0', estimacion: 6,
        dependencias: ['T-3.8'], descripcion: 'addNode/removeNode/addEdge/removeEdge en L4 Call, L5 CFG, L6 DataFlow',
        archivos: ['packages/graph/src/level4-call.ts', 'packages/graph/src/level5-cfg.ts', 'packages/graph/src/level6-dataflow.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-5.2', titulo: 'Mutation API L8-L11', fase: 5, nivel: 'L8-L11',
        tipo: 'feature', prioridad: 'P0', estimacion: 8,
        dependencias: ['T-5.1'], descripcion: 'addNode/removeNode/addEdge/removeEdge en L8-L11',
        archivos: ['packages/graph/src/level8-knowledge.ts', 'packages/graph/src/level9-semantic.ts', 'packages/graph/src/level10-embedding.ts', 'packages/graph/src/level11-graphrag.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-5.3', titulo: 'Mutation API L12-L19', fase: 5, nivel: 'L12-L19',
        tipo: 'feature', prioridad: 'P0', estimacion: 12,
        dependencias: ['T-5.2'], descripcion: 'addNode/removeNode/addEdge/removeEdge en L12-L19',
        archivos: ['packages/graph/src/level12-memory.ts', 'packages/graph/src/level13-agent.ts', 'packages/graph/src/level14-tool.ts', 'packages/graph/src/level15-workflow.ts', 'packages/graph/src/level16-network.ts', 'packages/graph/src/level17-social.ts', 'packages/graph/src/level18-biological.ts', 'packages/graph/src/level19-molecular.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-5.4', titulo: 'Serializacion L4-L11', fase: 5, nivel: 'L4-L11',
        tipo: 'feature', prioridad: 'P1', estimacion: 8,
        dependencias: ['T-5.2'], descripcion: 'toJSON/fromJSON en L4-L11, siguiendo patron de L7',
        archivos: ['packages/graph/src/level4-call.ts', 'packages/graph/src/level5-cfg.ts', 'packages/graph/src/level6-dataflow.ts', 'packages/graph/src/level8-knowledge.ts', 'packages/graph/src/level9-semantic.ts', 'packages/graph/src/level10-embedding.ts', 'packages/graph/src/level11-graphrag.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-5.5', titulo: 'Serializacion L12-L19', fase: 5, nivel: 'L12-L19',
        tipo: 'feature', prioridad: 'P1', estimacion: 8,
        dependencias: ['T-5.4'], descripcion: 'toJSON/fromJSON en L12-L19',
        archivos: ['packages/graph/src/level12-memory.ts', 'packages/graph/src/level13-agent.ts', 'packages/graph/src/level14-tool.ts', 'packages/graph/src/level15-workflow.ts', 'packages/graph/src/level16-network.ts', 'packages/graph/src/level17-social.ts', 'packages/graph/src/level18-biological.ts', 'packages/graph/src/level19-molecular.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-5.6', titulo: 'Adjacency maps L4-L19', fase: 5, nivel: 'L4-L19',
        tipo: 'performance', prioridad: 'P1', estimacion: 12,
        dependencias: ['T-5.5'], descripcion: 'Reemplazar filtrados O(n*m) por adjacency maps O(n+m) en todos los niveles',
        archivos: ['packages/graph/src/level4-call.ts', 'packages/graph/src/level5-cfg.ts', 'packages/graph/src/level6-dataflow.ts', 'packages/graph/src/level8-knowledge.ts', 'packages/graph/src/level9-semantic.ts', 'packages/graph/src/level10-embedding.ts', 'packages/graph/src/level11-graphrag.ts', 'packages/graph/src/level12-memory.ts', 'packages/graph/src/level13-agent.ts', 'packages/graph/src/level14-tool.ts', 'packages/graph/src/level15-workflow.ts', 'packages/graph/src/level16-network.ts', 'packages/graph/src/level17-social.ts', 'packages/graph/src/level18-biological.ts', 'packages/graph/src/level19-molecular.ts'], creado: new Date().toISOString(), notas: '',
    },
];
exports.TICKETS_FASE6 = [
    {
        id: 'T-6.1', titulo: 'Tests L4 Call Graph', fase: 6, nivel: 'L4',
        tipo: 'testing', prioridad: 'P2', estimacion: 4,
        dependencias: ['T-5.1'], descripcion: '40 tests: creacion, tracing, flame graph, hot paths, validacion',
        archivos: ['scripts/test-level4-call.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-6.2', titulo: 'Tests L5 CFG', fase: 6, nivel: 'L5',
        tipo: 'testing', prioridad: 'P2', estimacion: 4,
        dependencias: ['T-5.1'], descripcion: '40 tests: if/then/else, loops, switch, dominators, validacion',
        archivos: ['scripts/test-level5-cfg.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-6.3', titulo: 'Tests L6 DataFlow', fase: 6, nivel: 'L6',
        tipo: 'testing', prioridad: 'P2', estimacion: 4,
        dependencias: ['T-5.1'], descripcion: '40 tests: pipelines, bottlenecks, critical path, validacion',
        archivos: ['scripts/test-level6-dataflow.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-6.4', titulo: 'Tests L8-L11', fase: 6, nivel: 'L8-L11',
        tipo: 'testing', prioridad: 'P2', estimacion: 12,
        dependencias: ['T-5.2'], descripcion: '160 tests (40x nivel): Knowledge, Semantic, Embedding, GraphRAG',
        archivos: ['scripts/test-level8-knowledge.ts', 'scripts/test-level9-semantic.ts', 'scripts/test-level10-embedding.ts', 'scripts/test-level11-graphrag.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-6.5', titulo: 'Tests L12-L15', fase: 6, nivel: 'L12-L15',
        tipo: 'testing', prioridad: 'P2', estimacion: 12,
        dependencias: ['T-5.3'], descripcion: '160 tests (40x nivel): Memory, Agent, Tool, Workflow',
        archivos: ['scripts/test-level12-memory.ts', 'scripts/test-level13-agent.ts', 'scripts/test-level14-tool.ts', 'scripts/test-level15-workflow.ts'], creado: new Date().toISOString(), notas: '',
    },
    {
        id: 'T-6.6', titulo: 'Tests L16-L19', fase: 6, nivel: 'L16-L19',
        tipo: 'testing', prioridad: 'P2', estimacion: 12,
        dependencias: ['T-5.3'], descripcion: '160 tests (40x nivel): Network, Social, Biological, Molecular',
        archivos: ['scripts/test-level16-network.ts', 'scripts/test-level17-social.ts', 'scripts/test-level18-biological.ts', 'scripts/test-level19-molecular.ts'], creado: new Date().toISOString(), notas: '',
    },
];
//# sourceMappingURL=tickets-f4-f6.js.map