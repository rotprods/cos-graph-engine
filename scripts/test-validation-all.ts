// Validacion total — contrato comun de los niveles:
// construir (builder del nivel) -> validate() (si expone la firma sin args) limpio
// -> toJSON() serializa. Los niveles sin firma sin-args se marcan como N/A
// (estan cubiertos por sus scripts dedicados: test-levelN-*.ts).
import { VisualGraphEngine } from '../packages/graph/src/level0-visual';
import { StateMachine } from '../packages/graph/src/level2-state';
import { DataFlowGraph } from '../packages/graph/src/level6-dataflow';
import { ComputationalGraph } from '../packages/graph/src/level7-compute';
import { KnowledgeGraphEngine } from '../packages/graph/src/level8-knowledge';
import { SemanticGraph } from '../packages/graph/src/level9-semantic';
import { EmbeddingGraph } from '../packages/graph/src/level10-embedding';
import { MemoryGraphEngine } from '../packages/graph/src/level12-memory';
import { AgentGraphEngine } from '../packages/graph/src/level13-agent';
import { ToolGraphEngine } from '../packages/graph/src/level14-tool';
import { WorkflowGraphEngine } from '../packages/graph/src/level15-workflow';
import { NetworkGraphEngine } from '../packages/graph/src/level16-network';
import { SocialGraphEngine } from '../packages/graph/src/level17-social';
import { BiologicalGraphEngine } from '../packages/graph/src/level18-biological';
import { MolecularGraphEngine } from '../packages/graph/src/level19-molecular';

let p = 0, f = 0, na = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

/* eslint-disable @typescript-eslint/no-explicit-any */
const cases: Array<{ level: string; build: () => any }> = [
  { level: 'L0 Visual', build: () => { const g = new VisualGraphEngine(); g.buildFlowchart(); return g; } },
  { level: 'L2 State', build: () => new StateMachine('t', [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], [{ from: 'a', to: 'b', event: 'go' }], 'a') },
  { level: 'L6 DataFlow', build: () => { const g = new DataFlowGraph(); g.buildETLPipeline(); return g; } },
  { level: 'L7 Compute', build: () => { const g = new ComputationalGraph(); g.buildMLP(); return g; } },
  { level: 'L8 Knowledge', build: () => { const g = new KnowledgeGraphEngine(); g.buildCOS(); return g; } },
  { level: 'L9 Semantic', build: () => { const g = new SemanticGraph(); g.buildAnimalTaxonomy(); return g; } },
  { level: 'L10 Embedding', build: () => { const g = new EmbeddingGraph(); g.buildAIModelGraph(); g.buildKNN(3); return g; } },
  { level: 'L12 Memory', build: () => { const g = new MemoryGraphEngine(); g.buildConversation(); return g; } },
  { level: 'L13 Agent', build: () => { const g = new AgentGraphEngine(); g.buildDevTeam(); return g; } },
  { level: 'L14 Tool', build: () => { const g = new ToolGraphEngine(); g.buildToolEcosystem(); return g; } },
  { level: 'L15 Workflow', build: () => { const g = new WorkflowGraphEngine(); g.buildSupportWorkflow(); return g; } },
  { level: 'L16 Network', build: () => { const g = new NetworkGraphEngine(); g.buildInfrastructure(); return g; } },
  { level: 'L17 Social', build: () => { const g = new SocialGraphEngine(); g.buildTechNetwork(); return g; } },
  { level: 'L18 Biological', build: () => { const g = new BiologicalGraphEngine(); g.buildNeuralCircuit(); return g; } },
  { level: 'L19 Molecular', build: () => { const g = new MolecularGraphEngine(); g.buildAspirin(); return g; } },
];

for (const c of cases) {
  try {
    const g = c.build();
    // validate(): solo si expone firma sin argumentos (aridad 0)
    if (typeof g.validate === 'function' && g.validate.length === 0) {
      const errors = g.validate();
      assert(Array.isArray(errors), `${c.level}: validate() devuelve array`);
      assert(errors.length === 0, `${c.level}: grafo construido valida limpio (${errors.length} errores)`);
    } else {
      na++;
    }
    // toJSON(): solo si expone firma sin argumentos
    if (typeof g.toJSON === 'function' && g.toJSON.length === 0) {
      const json = g.toJSON();
      assert(json !== null && json !== undefined, `${c.level}: toJSON() serializa`);
    } else {
      na++;
    }
  } catch (e) {
    f++;
    console.error(`  ❌ ${c.level}: excepcion -> ${(e as Error).message}`);
  }
}

console.log(`\n📊 VALIDACION-ALL: ${p} tests, ${p + f} total, ${f} failed (${na} N/A por firma con args)`);
process.exit(f > 0 ? 1 : 0);
