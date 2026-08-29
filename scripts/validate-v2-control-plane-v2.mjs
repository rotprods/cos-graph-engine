#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CP = path.join(ROOT, 'control-plane/v2');
const MODEL = path.join(CP, 'model');
const STATE = path.join(CP, 'state');
const EVIDENCE = path.join(CP, 'evidence');

class Failure extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.code = code;
    this.detail = detail;
  }
}

const requiredTaskFields = [
  'id','objective','why','inputs','outputs','dependencies','affectedNodes','affectedEdges',
  'affectedFiles','ownerType','risk','implementationSteps','tests','adversarialTests',
  'securityTests','evidenceRequired','rollback','definitionOfDone','status',
];
const requiredGapFields = [
  'id','title','severity','impact','probability','blastRadius','strategicImportance','cost',
  'priority','status','currentDetection','currentMitigation','targetFix','dependencies','owner',
  'test','evidenceRequired','phase','rollback',
];
const requiredDecisionFields = [
  'id','title','status','problem','constraints','alternatives','selected','rejected','evidence',
  'tradeoffs','risks','mitigations','reversibility','migrationCost','reconsiderWhen','confidence','owner',
];

async function json(relative) {
  const file = path.join(ROOT, relative);
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { throw new Failure('JSON_LOAD_FAILED', `${relative} :: ${message(error)}`); }
}

async function load() {
  const manifest = await json('control-plane/v2/model/MODEL_MANIFEST.json');
  const selected = manifest.selected;
  const programModule = await import(`${pathToFileURL(path.join(ROOT, selected.program)).href}?v=${Date.now()}`);
  return {
    manifest,
    ontology: await json(selected.ontology),
    ontologyExtension: await json('control-plane/v2/model/ontology.extensions.json'),
    hypergraph: await json(selected.hypergraph),
    gaps: await json(selected.gaps),
    decisions: await json(selected.decisions),
    program: structuredClone(programModule.program ?? programModule.default),
    checkpoints: await json(selected.checkpoints),
    liveTruth: await json('control-plane/v2/state/live-truth.r2.json'),
    contextPack: await json('control-plane/v2/state/context-pack.r2.json'),
    activeClaims: await json('control-plane/v2/state/active-claims.r2.json'),
    eventManifest: await json('control-plane/v2/events/manifest.json'),
  };
}

function validate(model) {
  const errors = [];
  const warnings = [];
  const run = fn => { try { fn(); } catch (error) { errors.push(normalize(error)); } };

  run(() => validateManifest(model));
  run(() => validateOntology(model));
  run(() => validateGraph(model));
  run(() => validateProgram(model));
  run(() => validateCheckpoints(model));
  run(() => validateGaps(model));
  run(() => validateDecisions(model));
  run(() => validateClaims(model));
  run(() => validateContext(model));
  run(() => validateAuthority(model));

  if (model.activeClaims.unknownExternalClaims) {
    warnings.push({ code:'UNKNOWN_EXTERNAL_CLAIMS', detail:model.activeClaims.unknownReason });
  }
  if (Object.values(model.liveTruth.proofBoundary).includes('NOT_RUN')) {
    warnings.push({ code:'RUNTIME_ASSURANCE_NOT_RUN', detail:'Control-plane validation cannot promote runtime Assurance or Authority.' });
  }
  return { errors, warnings };
}

function validateManifest({ manifest }) {
  eq(manifest.schemaVersion, 1, 'MODEL_MANIFEST_SCHEMA');
  const selected = Object.values(manifest.selected);
  unique(selected, 'DUPLICATE_SELECTED_MODEL_PATH');
  for (const item of manifest.superseded) {
    ok(!selected.includes(item.path), 'SUPERSEDED_PATH_SELECTED', item.path);
    ok(item.replacement && selected.includes(item.replacement), 'SUPERSEDED_REPLACEMENT_NOT_SELECTED', item.path);
  }
}

function validateOntology({ ontology, ontologyExtension }) {
  eq(ontology.schemaVersion, 1, 'ONTOLOGY_SCHEMA');
  unique(ontology.nodeTypes.map(x => x.id), 'DUPLICATE_NODE_TYPE');
  unique([...ontology.edgeTypes, ...ontologyExtension.edgeTypes.map(x => x.id)], 'DUPLICATE_EDGE_TYPE');
  unique(ontology.hyperedgeTypes, 'DUPLICATE_HYPEREDGE_TYPE');
  unique(ontology.statusVocabulary, 'DUPLICATE_STATUS');
  unique(ontology.authorityVocabulary, 'DUPLICATE_AUTHORITY');
  eq(ontology.cosViews.length, 20, 'COS_VIEW_COUNT');
  eq(ontology.cosViews.map(x => x.level).join(','), Array.from({length:20},(_,i)=>`L${i}`).join(','), 'COS_VIEW_SEQUENCE');
  ok(ontology.invariants.length >= 8, 'ONTOLOGY_INVARIANTS_INSUFFICIENT', String(ontology.invariants.length));
}

function validateGraph({ ontology, ontologyExtension, hypergraph }) {
  const nodeTypes = new Set(ontology.nodeTypes.map(x => x.id));
  const edgeTypes = new Set([...ontology.edgeTypes, ...ontologyExtension.edgeTypes.map(x => x.id)]);
  const hyperTypes = new Set(ontology.hyperedgeTypes);
  const statuses = new Set(ontology.statusVocabulary);
  const authorities = new Set(ontology.authorityVocabulary);
  const nodeIds = new Set(hypergraph.nodes.map(x => x.id));
  const edgeIds = new Set(hypergraph.edges.map(x => x.id));
  unique([...nodeIds], 'DUPLICATE_NODE_ID');
  unique([...edgeIds], 'DUPLICATE_EDGE_ID');
  unique(hypergraph.hyperedges.map(x => x.id), 'DUPLICATE_HYPEREDGE_ID');

  for (const node of hypergraph.nodes) {
    ok(nodeTypes.has(node.type), 'UNKNOWN_NODE_TYPE', `${node.id}:${node.type}`);
    ok(statuses.has(node.status), 'UNKNOWN_NODE_STATUS', `${node.id}:${node.status}`);
    ok(authorities.has(node.authority), 'UNKNOWN_NODE_AUTHORITY', `${node.id}:${node.authority}`);
    ok(typeof node.owner === 'string' && node.owner.trim(), 'NODE_OWNER_MISSING', node.id);
    for (const dim of node.dimensions ?? []) ok(/^L(?:[0-9]|1[0-9])$/.test(dim), 'INVALID_DIMENSION', `${node.id}:${dim}`);
  }
  for (const edge of hypergraph.edges) {
    ok(edgeTypes.has(edge.type), 'UNKNOWN_EDGE_TYPE', `${edge.id}:${edge.type}`);
    ok(nodeIds.has(edge.from), 'DANGLING_EDGE_FROM', `${edge.id}:${edge.from}`);
    ok(nodeIds.has(edge.to), 'DANGLING_EDGE_TO', `${edge.id}:${edge.to}`);
    ok(['HIGH','MEDIUM','LOW','UNKNOWN'].includes(edge.confidence), 'EDGE_CONFIDENCE_INVALID', edge.id);
    ok(['LOW','MEDIUM','HIGH','CRITICAL'].includes(edge.criticality), 'EDGE_CRITICALITY_INVALID', edge.id);
  }
  for (const edge of hypergraph.hyperedges) {
    ok(hyperTypes.has(edge.type), 'UNKNOWN_HYPEREDGE_TYPE', `${edge.id}:${edge.type}`);
    ok(edge.members.length >= 2, 'HYPEREDGE_TOO_SMALL', edge.id);
    for (const member of edge.members) ok(nodeIds.has(member), 'DANGLING_HYPEREDGE_MEMBER', `${edge.id}:${member}`);
  }
  for (const view of hypergraph.viewDefinitions) {
    for (const type of view.includeTypes ?? []) ok(nodeTypes.has(type), 'VIEW_NODE_TYPE_UNKNOWN', `${view.id}:${type}`);
    for (const type of view.includeEdgeTypes ?? []) ok(edgeTypes.has(type), 'VIEW_EDGE_TYPE_UNKNOWN', `${view.id}:${type}`);
  }
}

function validateProgram({ program, hypergraph }) {
  eq(program.schemaVersion, 1, 'PROGRAM_SCHEMA');
  const tasks = new Map(program.tasks.map(task => [task.id, task]));
  unique([...tasks.keys()], 'DUPLICATE_TASK_ID');
  const nodeIds = new Set(hypergraph.nodes.map(x => x.id));
  const edgeIds = new Set(hypergraph.edges.map(x => x.id));
  for (const task of tasks.values()) {
    for (const field of requiredTaskFields) ok(Object.hasOwn(task, field), 'TASK_FIELD_MISSING', `${task.id}:${field}`);
    ok(/^T\d{4}$/.test(task.id), 'TASK_ID_INVALID', task.id);
    ok(task.definitionOfDone.length > 0, 'TASK_DOD_EMPTY', task.id);
    ok(typeof task.rollback === 'string' && task.rollback.trim(), 'TASK_ROLLBACK_EMPTY', task.id);
    for (const dep of task.dependencies) ok(tasks.has(dep), 'TASK_DEPENDENCY_UNKNOWN', `${task.id}:${dep}`);
    for (const node of task.affectedNodes) ok(nodeIds.has(node), 'TASK_NODE_UNKNOWN', `${task.id}:${node}`);
    for (const edge of task.affectedEdges) ok(edgeIds.has(edge), 'TASK_EDGE_UNKNOWN', `${task.id}:${edge}`);
  }
  acyclic([...tasks.values()].map(task => ({ id:task.id, deps:task.dependencies })), 'TASK_DEPENDENCY_CYCLE');
  unique(program.phases.map(x => x.id), 'DUPLICATE_PHASE_ID');
  for (const phase of program.phases) {
    ok(nodeIds.has(phase.nodeId), 'PHASE_NODE_UNKNOWN', `${phase.id}:${phase.nodeId}`);
    for (const wave of phase.waves) for (const id of wave.tasks) ok(tasks.has(id), 'WAVE_TASK_UNKNOWN', `${wave.id}:${id}`);
  }
  for (const id of program.currentExecutableFrontier) ok(tasks.has(id), 'FRONTIER_TASK_UNKNOWN', id);
}

function validateCheckpoints({ checkpoints, program }) {
  const taskIds = new Set(program.tasks.map(x => x.id));
  const ids = checkpoints.checkpoints.map(x => x.id);
  unique(ids, 'DUPLICATE_CHECKPOINT_ID');
  eq(ids.join(','), Array.from({length:15},(_,i)=>`CP${i}`).join(','), 'CHECKPOINT_SEQUENCE');
  for (const cp of checkpoints.checkpoints) {
    ok(cp.entryCriteria.length > 0, 'CHECKPOINT_ENTRY_EMPTY', cp.id);
    ok(cp.exitCriteria.length > 0, 'CHECKPOINT_EXIT_EMPTY', cp.id);
    ok(cp.requiredEvidence.length > 0, 'CHECKPOINT_EVIDENCE_EMPTY', cp.id);
    ok(typeof cp.rollback === 'string' && cp.rollback.trim(), 'CHECKPOINT_ROLLBACK_EMPTY', cp.id);
    for (const id of cp.requiredTasks) ok(taskIds.has(id), 'CHECKPOINT_TASK_UNKNOWN', `${cp.id}:${id}`);
  }
}

function validateGaps({ gaps, program, checkpoints, hypergraph }) {
  const gapIds = new Set(gaps.gaps.map(x => x.id));
  const taskIds = new Set(program.tasks.map(x => x.id));
  const cpIds = new Set(checkpoints.checkpoints.map(x => x.id));
  const graphIds = new Set(hypergraph.nodes.map(x => x.id));
  unique([...gapIds], 'DUPLICATE_GAP_ID');
  for (const gap of gaps.gaps) {
    for (const field of requiredGapFields) ok(Object.hasOwn(gap, field), 'GAP_FIELD_MISSING', `${gap.id}:${field}`);
    ok(/^G\d{3}$/.test(gap.id), 'GAP_ID_INVALID', gap.id);
    ok(['P0','P1','P2','P3'].includes(gap.severity), 'GAP_SEVERITY_INVALID', gap.id);
    for (const name of ['impact','probability','blastRadius','strategicImportance']) ok(Number.isFinite(gap[name]) && gap[name] >= 1 && gap[name] <= 5, 'GAP_SCORE_INVALID', `${gap.id}:${name}`);
    ok(Number.isFinite(gap.cost) && gap.cost >= 1, 'GAP_COST_INVALID', gap.id);
    ok(gap.owner && gap.test && gap.evidenceRequired && gap.rollback, 'GAP_GOVERNANCE_INCOMPLETE', gap.id);
    for (const dep of gap.dependencies) ok(gapIds.has(dep) || taskIds.has(dep) || cpIds.has(dep) || graphIds.has(dep), 'GAP_DEPENDENCY_UNKNOWN', `${gap.id}:${dep}`);
  }
}

function validateDecisions({ decisions }) {
  unique(decisions.decisions.map(x => x.id), 'DUPLICATE_DECISION_ID');
  for (const decision of decisions.decisions) {
    for (const field of requiredDecisionFields) ok(Object.hasOwn(decision, field), 'DECISION_FIELD_MISSING', `${decision.id}:${field}`);
    ok(/^D\d{3}$/.test(decision.id), 'DECISION_ID_INVALID', decision.id);
    ok(['HIGH_CONFIDENCE','MEDIUM_CONFIDENCE','LOW_CONFIDENCE','UNKNOWN'].includes(decision.confidence), 'DECISION_CONFIDENCE_INVALID', decision.id);
    ok(decision.alternatives.length >= 2, 'DECISION_ALTERNATIVES_INSUFFICIENT', decision.id);
  }
}

function validateClaims({ activeClaims }) {
  unique(activeClaims.claims.map(x => x.claimId), 'DUPLICATE_CLAIM_ID');
  const active = activeClaims.claims.filter(x => x.status === 'ACTIVE');
  for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) {
    const overlap = overlaps(active[i].exclusiveResourceScopes ?? [], active[j].exclusiveResourceScopes ?? []);
    ok(overlap.length === 0, 'ACTIVE_EXCLUSIVE_CLAIM_COLLISION', `${active[i].claimId}<->${active[j].claimId}:${overlap.join(',')}`);
  }
}

function validateContext({ liveTruth, contextPack, activeClaims, eventManifest }) {
  eq(contextPack.projectId, liveTruth.projectId, 'CONTEXT_PROJECT_MISMATCH');
  eq(contextPack.sourceRevision, liveTruth.workBranchObservedSha, 'CONTEXT_STALE_SOURCE');
  eq(contextPack.eventWatermark, eventManifest.eventWatermark, 'CONTEXT_EVENT_WATERMARK_STALE');
  eq(contextPack.projectionRevision, liveTruth.projectionRevision, 'CONTEXT_PROJECTION_STALE');
  eq(activeClaims.eventWatermark, eventManifest.eventWatermark, 'CLAIM_PROJECTION_STALE');
  ok(contextPack.staleByDefault === true, 'CONTEXT_NOT_STALE_BY_DEFAULT', contextPack.contextPackId);
  ok(contextPack.authorityCeiling === 'IMPLEMENTED_UNVERIFIED', 'CONTEXT_AUTHORITY_ESCALATION', contextPack.authorityCeiling);
}

function validateAuthority({ liveTruth, hypergraph, gaps }) {
  eq(liveTruth.authorityStatus, 'SHADOW_ONLY', 'PRODUCT_AUTHORITY_ESCALATED');
  eq(liveTruth.authorityCeiling, 'IMPLEMENTED_UNVERIFIED', 'AUTHORITY_CEILING_INVALID');
  const open = gaps.gaps.some(g => ['P0','P1'].includes(g.severity) && !['SUPERSEDED','VERIFIED','EMPIRICALLY_QUALIFIED','NOT_APPLICABLE'].includes(g.status));
  const qualified = hypergraph.nodes.filter(n => ['VERIFIED','EMPIRICALLY_QUALIFIED'].includes(n.status));
  ok(!(open && qualified.length), 'QUALIFIED_WITH_OPEN_CRITICAL_GAPS', qualified.map(x => x.id).join(','));
}

async function validateLedger(eventManifest) {
  const errors = [];
  const events = [];
  for (const segment of eventManifest.segments) {
    try {
      const lines = (await readFile(path.join(ROOT, segment.path), 'utf8')).split(/\r?\n/).filter(Boolean);
      const parsed = lines.map((line, index) => {
        try { return JSON.parse(line); }
        catch (error) { throw new Failure('EVENT_JSON_INVALID', `${segment.path}:${index + 1}:${message(error)}`); }
      });
      eq(parsed.length, segment.eventCount, 'EVENT_COUNT_MISMATCH', segment.path);
      eq(parsed.at(0)?.sequence, segment.firstSequence, 'EVENT_SEGMENT_FIRST_SEQUENCE', segment.path);
      eq(parsed.at(-1)?.sequence, segment.lastSequence, 'EVENT_SEGMENT_LAST_SEQUENCE', segment.path);
      events.push(...parsed);
    } catch (error) { errors.push(normalize(error)); }
  }
  try {
    unique(events.map(x => x.eventId), 'DUPLICATE_EVENT_ID');
    events.forEach((event, index) => {
      eq(event.sequence, index + 1, 'EVENT_SEQUENCE_GAP', event.eventId);
      ok(Number.isFinite(Date.parse(event.occurredAt)), 'EVENT_TIME_INVALID', event.eventId);
      ok(Number.isFinite(Date.parse(event.recordedAt)), 'EVENT_RECORDED_TIME_INVALID', event.eventId);
    });
    eq(events.at(-1)?.sequence, eventManifest.eventWatermark, 'EVENT_WATERMARK_MISMATCH');
  } catch (error) { errors.push(normalize(error)); }
  return { errors, events };
}

function selfTests(model) {
  const scenarios = [];
  const expect = (name, code, mutate) => {
    const copy = structuredClone(model);
    mutate(copy);
    const result = validate(copy);
    const passed = result.errors.some(error => error.code === code);
    scenarios.push({ name, expectedCode:code, passed, observed:result.errors.map(x => x.code) });
  };
  expect('duplicate-node','DUPLICATE_NODE_ID',m=>m.hypergraph.nodes.push(structuredClone(m.hypergraph.nodes[0])));
  expect('task-cycle','TASK_DEPENDENCY_CYCLE',m=>{m.program.tasks[0].dependencies=[m.program.tasks[1].id];m.program.tasks[1].dependencies=[m.program.tasks[0].id];});
  expect('stale-context','CONTEXT_STALE_SOURCE',m=>{m.contextPack.sourceRevision='deadbeef';});
  expect('claim-collision','ACTIVE_EXCLUSIVE_CLAIM_COLLISION',m=>{const a=m.activeClaims.claims.find(x=>x.status==='ACTIVE');m.activeClaims.claims.push({...structuredClone(a),claimId:'claim_collision',sessionId:'session_collision'});});
  expect('authority-escalation','PRODUCT_AUTHORITY_ESCALATED',m=>{m.liveTruth.authorityStatus='AUTHORITY_READY';});
  const failed = scenarios.filter(x => !x.passed);
  ok(failed.length === 0, 'VALIDATOR_SELF_TEST_FAILED', failed.map(x=>x.name).join(','));
  return scenarios;
}

function acyclic(items, code) {
  const deps = new Map(items.map(x => [x.id, x.deps]));
  const visiting = new Set();
  const done = new Set();
  const visit = id => {
    if (visiting.has(id)) throw new Failure(code, id);
    if (done.has(id)) return;
    visiting.add(id);
    for (const dep of deps.get(id) ?? []) visit(dep);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of deps.keys()) visit(id);
}

function overlaps(left, right) {
  const found = [];
  for (const a0 of left) for (const b0 of right) {
    const a = normalizeScope(a0); const b = normalizeScope(b0);
    if (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) found.push(`${a0}<->${b0}`);
  }
  return found;
}

function normalizeScope(value) { return String(value).replace(/\/\*\*$/, '').replace(/\/$/, ''); }
function unique(values, code) { const seen=new Set(); for (const value of values) { if (seen.has(value)) throw new Failure(code,String(value)); seen.add(value); } }
function ok(condition, code, detail) { if (!condition) throw new Failure(code, detail); }
function eq(actual, expected, code, detail='') { if (actual !== expected) throw new Failure(code, `${detail} expected=${expected} actual=${actual}`); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])); return value; }
function digest(value) { return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function message(error) { return error instanceof Error ? error.message : String(error); }
function normalize(error) { return error instanceof Failure ? {code:error.code,detail:error.detail,message:error.message} : {code:'UNEXPECTED',detail:message(error),message:message(error)}; }

async function main() {
  const model = await load();
  const result = validate(model);
  const ledger = await validateLedger(model.eventManifest);
  result.errors.push(...ledger.errors);
  const selfTestResult = process.argv.includes('--self-test') ? selfTests(model) : [];
  const fingerprints = Object.fromEntries(['ontology','ontologyExtension','hypergraph','gaps','decisions','program','checkpoints','liveTruth','contextPack','activeClaims','eventManifest'].map(key=>[key,digest(model[key])]));
  const report = {
    schemaVersion:1,
    reportId:`cpreport_${digest({fingerprints,eventWatermark:model.eventManifest.eventWatermark}).slice(0,24)}`,
    generatedAt:new Date().toISOString(),
    sourceRevision:model.liveTruth.workBranchObservedSha,
    executionRevision:process.env.COS_GIT_SHA ?? 'UNBOUND_LOCAL_EXECUTION',
    eventWatermark:model.eventManifest.eventWatermark,
    projectionRevision:model.liveTruth.projectionRevision,
    passed:result.errors.length===0,
    errors:result.errors,
    warnings:result.warnings,
    counts:{nodes:model.hypergraph.nodes.length,edges:model.hypergraph.edges.length,hyperedges:model.hypergraph.hyperedges.length,tasks:model.program.tasks.length,gaps:model.gaps.gaps.length,decisions:model.decisions.decisions.length,checkpoints:model.checkpoints.checkpoints.length,events:ledger.events.length},
    fingerprints,
    selfTests:selfTestResult,
    authorityEffect:'CONTROL_PLANE_ONLY_NO_RUNTIME_SCORE_PROMOTION',
  };
  if (process.argv.includes('--write')) {
    await mkdir(EVIDENCE,{recursive:true});
    await writeFile(path.join(EVIDENCE,'control-plane-validation.v2.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');
  }
  process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
  if (!report.passed) process.exitCode=1;
}

main().catch(error=>{process.stderr.write(`${JSON.stringify(normalize(error),null,2)}\n`);process.exitCode=1;});
