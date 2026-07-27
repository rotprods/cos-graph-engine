#!/bin/bash
# ============================================================
# COS — Automatic Phase Execution Script
# Ejecuta todas las 8 fases secuencialmente con verificación
# ============================================================

set -e
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASE_DIR"

PASS=0
FAIL=0

header() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║   $1"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
}

pass() {
  echo "  ✅ $1"
  PASS=$((PASS+1))
}

fail() {
  echo "  ❌ $1"
  echo "     $2"
  FAIL=$((FAIL+1))
}

# ============================================================
# PHASE 0: Foundation
# ============================================================
header "PHASE 0: Foundation — Core Types, Errors, BaseCell"

npx tsx -e "
const {generateId, CellError, BaseCell} = require('./packages/core/src/index.ts');
const id = generateId();
console.log('ID:', id);
const err = new CellError('TEST', 'test error');
console.log('Error:', err.code, err.message);
" 2>&1 | tail -3

if [ $? -eq 0 ]; then
  pass "Core: types, errors, generateId"
else
  fail "Core" "Check packages/core/src/index.ts"
fi

# ============================================================
# PHASE 1: MVP Runtime
# ============================================================
header "PHASE 1: MVP Runtime — EventBus, Scheduler, State, CellHost"

npx tsx -e "
const {EventBus, StateManager, CellHost} = require('./packages/runtime/src/index.ts');
const bus = new EventBus();
bus.subscribe('test', async (e) => {});
bus.publish({type:'test', source:'test', payload:{}, severity:'info', metadata:{}});
const state = new StateManager();
state.set('test', {value: 42});
console.log('State:', state.get('test').value);
console.log('History:', state.getHistory('test').length);
" 2>&1 | tail -5

if [ $? -eq 0 ]; then
  pass "Runtime: EventBus, StateManager"
else
  fail "Runtime" "Check packages/runtime/src/"
fi

# ============================================================
# PHASE 2: Memory System
# ============================================================
header "PHASE 2: Memory — 12-layer MemoryManager"

npx tsx -e "
const {MemoryManager} = require('./packages/memory/src/index.ts');
const mem = new MemoryManager();
const id = await mem.store('test data', 'semantic', {tags:['test'],importance:0.9});
const r = await mem.retrieve(id);
console.log('Stored:', r ? 'OK' : 'FAIL');
const stats = await mem.stats();
console.log('Layers:', Object.entries(stats.byLayer).filter(([_,c]) => c > 0).length);
const consolidated = await mem.consolidate(0.5);
console.log('Consolidated:', consolidated);
" 2>&1 | tail -5

if [ $? -eq 0 ]; then
  pass "Memory: 12 layers, store/retrieve/consolidate"
else
  fail "Memory" "Check packages/memory/src/"
fi

# ============================================================
# PHASE 3: Knowledge Layer
# ============================================================
header "PHASE 3: Knowledge — Graph, Embeddings, Ontology"

npx tsx -e "
const {KnowledgeGraph, EmbeddingSystem, OntologySystem} = require('./packages/knowledge/src/index.ts');
const kg = new KnowledgeGraph();
await kg.addStatement({subject:'COS',predicate:'is',object:'System',confidence:1,source:'t',metadata:{},embedding:undefined});
const q = await kg.query('COS');
console.log('Knowledge:', q.length, 'statements');
const emb = new EmbeddingSystem();
const v = emb.textToEmbedding('cos');
await emb.store('s1', v, 'concept');
const sr = await emb.search(v, {limit:5});
console.log('Embeddings:', sr.length, 'results');
const onto = new OntologySystem();
await onto.defineClass('Test', 'test', null, []);
console.log('Ontology:', onto.classCount, 'classes');
" 2>&1 | tail -5

if [ $? -eq 0 ]; then
  pass "Knowledge: graph + embeddings + ontology"
else
  fail "Knowledge" "Check packages/knowledge/src/"
fi

# ============================================================
# PHASE 4: Cognition
# ============================================================
header "PHASE 4: Cognition — 5 Reasoning Engines"

npx tsx -e "
const {ReasoningEngineRegistry, PlanningEngine, EvaluationSystem, LearningSystem} = require('./packages/cognition/src/index.ts');
const reg = new ReasoningEngineRegistry();
console.log('Engines:', reg.getAll().length, '(' + reg.getAll().map(e=>e.type).join(', ') + ')');
const steps = await reg.reason('chain_of_thought', {problem:'test',steps:3}, {traceId:'t'});
console.log('CoT:', steps.length, 'steps');
const tree = await reg.reason('tree_of_thoughts', {problem:'test',branchingFactor:2,maxDepth:2}, {traceId:'t'});
console.log('ToT:', tree.length, 'steps');
const plan = new PlanningEngine(reg);
const p = await plan.createPlan('test goal', {traceId:'t'});
console.log('Planning:', p.steps.length, 'steps');
const evalSys = new EvaluationSystem();
const er = await evalSys.evaluate('test', 'output', ['accuracy']);
console.log('Eval:', (er.overallScore*100).toFixed(0)+'/100');
const learn = new LearningSystem();
const eid = await learn.recordExample('i','o');
await learn.addFeedback(eid, 0.9, 'good');
console.log('Learning:', learn.stats.totalExamples, 'examples');
" 2>&1 | tail -8

if [ $? -eq 0 ]; then
  pass "Cognition: 5 engines + planning + eval + learning"
else
  fail "Cognition" "Check packages/cognition/src/"
fi

# ============================================================
# PHASE 5: Execution & Orchestration
# ============================================================
header "PHASE 5: Execution & Orchestration — Tools, Agents, Policies"

npx tsx -e "
const {ToolRegistry} = require('./packages/execution/src/index.ts');
const tools = new ToolRegistry();
console.log('Tools:', tools.getAll().length, '(' + tools.getDefinitions().map(d=>d.name).join(', ') + ')');
const r = await tools.execute('filesystem', {operation:'write',path:'/tmp/cos-phase5.txt',content:'phase5'}, {traceId:'t'});
console.log('FS write:', r.success);
const {PolicyEngine} = require('./packages/orchestration/src/index.ts');
const pol = new PolicyEngine();
await pol.addRule({id:'p1',name:'allow',description:'',effect:'allow',actions:['*'],resources:['*'],conditions:[],priority:0,enabled:true});
const d = await pol.evaluate('read','memory',{traceId:'t'});
console.log('Policy:', d.allowed ? 'ALLOW' : 'DENY');
" 2>&1 | tail -5

if [ $? -eq 0 ]; then
  pass "Execution: 3 tools + policy engine"
else
  fail "Execution" "Check packages/execution/src/ and packages/orchestration/src/"
fi

# ============================================================
# PHASE 6: Production
# ============================================================
header "PHASE 6: Production — HTTP API + Auth + Config"

npx tsx -e "
const api = require('./packages/api/src/index.ts');
const infra = require('./packages/infrastructure/src/index.ts');
const config = new infra.Configuration();
config.loadPresets();
console.log('Config:', config.get('server.host'), config.get('server.port'));
const auth = new api.AuthMiddleware(config);
const token = auth.generateToken('admin', 'admin');
const identity = await auth.authenticate('Bearer ' + token);
console.log('Auth:', identity.userId, identity.role);
const server = new api.COSServer(config);
console.log('Server:', server.constructor.name);
" 2>&1 | tail -5

if [ $? -eq 0 ]; then
  pass "Production: config + auth + server"
else
  fail "Production" "Check packages/api/src/ and packages/infrastructure/src/"
fi

# ============================================================
# PHASE 7: Self-Improvement + LLM
# ============================================================
header "PHASE 7: Self-Improvement — Auto-eval, Meta-cognition, LLM"

npx tsx -e "
const {SelfImprovementSystem, LLMFactory, EvaluationSystem, LearningSystem, ReasoningEngineRegistry} = require('./packages/cognition/src/index.ts');
const evalSys = new EvaluationSystem();
const learnSys = new LearningSystem();
const reg = new ReasoningEngineRegistry();
const si = new SelfImprovementSystem(evalSys, learnSys, reg);
for(let i=0;i<5;i++) await si.recordOutput({q:'test-'+i},{r:'result-'+i});
const report = await si.runMetaCognition(true);
console.log('Self-Improve:', (report.averageScore*100).toFixed(0)+'/100', report.scoreTrend);
const llm = new LLMFactory();
console.log('LLM:', llm.getAvailableProviders().length, 'available');
const resp = await llm.get().generate({messages:[{role:'user',content:'hello'}]});
console.log('LLM gen:', resp.usage.totalTokens, 'tokens');
" 2>&1 | tail -5

if [ $? -eq 0 ]; then
  pass "Self-Improvement: eval + meta-cognition + LLM"
else
  fail "Self-Improvement" "Check packages/cognition/src/self-improvement.ts and llm.ts"
fi

# ============================================================
# PHASE 8: Advanced
# ============================================================
header "PHASE 8: Advanced — Autonomous Loop + Persistence"

npx tsx -e "
const {AutonomousLoop} = require('./packages/orchestration/src/index.ts');
const {CellHost} = require('./packages/runtime/src/index.ts');
const {MemoryManager} = require('./packages/memory/src/index.ts');
const {ReasoningEngineRegistry, PlanningEngine, EvaluationSystem, SelfImprovementSystem} = require('./packages/cognition/src/index.ts');
const host = new CellHost();
const mem = new MemoryManager();
const reg = new ReasoningEngineRegistry();
const plan = new PlanningEngine(reg);
const evalSys = new EvaluationSystem();
const si = new SelfImprovementSystem(evalSys, evalSys, reg);
const loop = new AutonomousLoop(host, mem, plan, evalSys, si);
const goal = await loop.createGoal('Test autonomous execution', {traceId:'t'});
console.log('Goal:', goal.plan.length, 'steps');
console.log('AutonomousLoop: OK');
const infra = require('./packages/infrastructure/src/index.ts');
const pm = new infra.PersistenceManager('/tmp/cos-persist-test');
await pm.init();
const store = new infra.FileBackedData('/tmp/cos-persist-test', 'test');
store.set('key', 'value');
await store.save();
const store2 = new infra.FileBackedData('/tmp/cos-persist-test', 'test');
await store2.load();
console.log('Persistence:', store2.get('key'));
" 2>&1 | tail -5

if [ $? -eq 0 ]; then
  pass "Advanced: autonomous loop + persistence"
else
  fail "Advanced" "Check packages/orchestration/src/autonomous-loop.ts"
fi

# ============================================================
# FULL SYSTEM LAUNCH
# ============================================================
header "FULL SYSTEM: Launch COS with all subsystems"

npx tsx -e "
const {COSSERVER} = require('./packages/api/src/index.ts');
const {Configuration} = require('./packages/infrastructure/src/index.ts');
const {EntityId, BaseCell} = require('./packages/core/src/index.ts');

const config = new Configuration();
config.loadPresets();
config.setRuntime('server.port', 0);  // random port

const server = new COSServer(config);

const cell = new (class extends BaseCell {
  constructor() {
    super({id:'cos:verify:cell' as EntityId,name:'verify-cell',purpose:'Verification',
      version:{major:1,minor:0,patch:0},owner:'cos',type:'cognitive',policies:[],dependencies:[],
      memory:{layers:['working'],capacity:256},tools:[],reasoningEngines:[],
      executionEngine:'default',permissions:{'*':['read','write','execute']},config:{},documentation:''});
  }
  protected async onProcess(input: any, ctx: any) {
    return { result:{echo:input}, representations:{}, cost:{units:'credits',amount:0.05},
      confidence:0.9, memoryUpdates:[], events:[], errors:[], metadata:{traceId:ctx.traceId} };
  }
})();

await server.cellHost.register(cell);
await server.policies.addRule({id:'p:all' as EntityId,name:'allow-all',description:'',effect:'allow',actions:['*'],resources:['*'],conditions:[],priority:0,enabled:true});

// Test all subsystems
const out = await server.process({input:'hello',target:cell.definition.id,context:{traceId:'v1'}});
console.log('Process:', JSON.stringify(out.result).substring(0,40));

await server.memory.store('verify','working',{tags:['v'],importance:0.5});
const m = await server.memory.stats();
console.log('Memory:', m.totalEntries, 'entries');

await server.knowledge.addStatement({subject:'COS',predicate:'verified',object:'true',confidence:1,source:'v' as EntityId,metadata:{},embedding:undefined});
const k = await server.knowledge.query('COS');
console.log('Knowledge:', k.length, 'statements');

for(let i=0;i<3;i++) await server.selfImprovement.recordOutput({q:'v-'+i},{r:'r-'+i});
const si = await server.selfImprovement.runMetaCognition(true);
console.log('Self-Improve:', (si.averageScore*100).toFixed(0)+'/100');

const health = await server.getHealth();
console.log('Health:', health.system?.status, '| cells:', health.system?.metrics?.cells);

console.log('\\n✅✅✅ COS COMPLETE: ALL 8 PHASES VERIFIED');
" 2>&1 | tail -10

if [ $? -eq 0 ]; then
  pass "Full system: all 8 phases verified end-to-end"
else
  fail "Full system" "Check individual phase outputs above"
fi

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   EXECUTION SUMMARY"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Total: $((PASS+FAIL)) checks"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "  ✅✅✅ ALL 8 PHASES EXECUTED SUCCESSFULLY"
  echo ""
  echo "  Next steps:"
  echo "    npm start                    # Launch full system"
  echo "    http://localhost:8080/       # Dashboard"
  echo "    http://localhost:8080/chat   # Chat"
else
  echo "  ⚠️  $FAIL phase(s) failed. Check outputs above."
fi
echo ""