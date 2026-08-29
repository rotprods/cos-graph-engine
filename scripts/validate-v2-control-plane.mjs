#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MODEL_DIR = path.join(ROOT, 'control-plane/v2/model');
const STATE_DIR = path.join(ROOT, 'control-plane/v2/state');
const EVENTS_DIR = path.join(ROOT, 'control-plane/v2/events');
const EVIDENCE_DIR = path.join(ROOT, 'control-plane/v2/evidence');

const FILES = {
  ontology: path.join(MODEL_DIR, 'ontology.json'),
  hypergraph: path.join(MODEL_DIR, 'hypergraph.json'),
  gaps: path.join(MODEL_DIR, 'gaps.json'),
  decisions: path.join(MODEL_DIR, 'decisions.json'),
  program: path.join(MODEL_DIR, 'program.json'),
  checkpoints: path.join(MODEL_DIR, 'checkpoints.json'),
  liveTruth: path.join(STATE_DIR, 'live-truth.r2.json'),
  contextPack: path.join(STATE_DIR, 'context-pack.r2.json'),
  activeClaims: path.join(STATE_DIR, 'active-claims.r2.json'),
  eventManifest: path.join(EVENTS_DIR, 'manifest.json'),
};

const REQUIRED_TASK_FIELDS = [
  'id','objective','why','inputs','outputs','dependencies','affectedNodes','affectedEdges',
  'affectedFiles','ownerType','risk','implementationSteps','tests','adversarialTests',
  'securityTests','evidenceRequired','rollback','definitionOfDone','status',
];
const REQUIRED_GAP_FIELDS = [
  'id','title','severity','impact','probability','blastRadius','strategicImportance','cost',
  'priority','status','currentDetection','currentMitigation','targetFix','dependencies','owner',
  'test','evidenceRequired','phase','rollback',
];
const REQUIRED_DECISION_FIELDS = [
  'id','title','status','problem','constraints','alternatives','selected','rejected','evidence',
  'tradeoffs','risks','mitigations','reversibility','migrationCost','reconsiderWhen','confidence','owner',
];
const ALLOWED_CONFIDENCE = new Set(['HIGH_CONFIDENCE','MEDIUM_CONFIDENCE','LOW_CONFIDENCE','UNKNOWN']);
const ALLOWED_EDGE_CONFIDENCE = new Set(['HIGH','MEDIUM','LOW','UNKNOWN']);
const ALLOWED_CRITICALITY = new Set(['LOW','MEDIUM','HIGH','CRITICAL']);
const QUALIFIED_STATUSES = new Set(['VERIFIED','EMPIRICALLY_QUALIFIED']);

class ValidationError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
  }
}

async function readJson(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    throw new ValidationError('FILE_READ_FAILED', relative(file), { cause: String(error) });
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ValidationError('JSON_PARSE_FAILED', relative(file), { cause: String(error) });
  }
}

async function loadModel() {
  return Object.fromEntries(await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => [key, await readJson(file)]),
  ));
}

function validateModel(model) {
  const errors = [];
  const warn = [];
  const capture = fn => {
    try { fn(); } catch (error) { errors.push(normalizeError(error)); }
  };

  capture(() => validateVersions(model));
  capture(() => validateOntology(model.ontology));
  capture(() => validateHypergraph(model.ontology, model.hypergraph));
  capture(() => validateProgram(model.program, model.hypergraph));
  capture(() => validateCheckpoints(model.checkpoints, model.program));
  capture(() => validateGaps(model.gaps, model.program, model.checkpoints, model.hypergraph));
  capture(() => validateDecisions(model.decisions));
  capture(() => validateClaims(model.activeClaims));
  capture(() => validateContext(model.liveTruth, model.contextPack, model.activeClaims, model.eventManifest));
  capture(() => validateAuthorityCeiling(model));

  if (model.liveTruth.proofBoundary
      && Object.values(model.liveTruth.proofBoundary).some(value => value === 'NOT_RUN')) {
    warn.push({
      code: 'ASSURANCE_REMAINS_UNEXECUTED',
      message: 'Runtime qualification evidence is intentionally absent; control-plane validation cannot promote product authority.',
    });
  }
  if (model.activeClaims.unknownExternalClaims) {
    warn.push({
      code: 'UNKNOWN_EXTERNAL_CLAIMS',
      message: model.activeClaims.unknownReason,
    });
  }

  return { errors, warnings: warn };
}

function validateVersions(model) {
  for (const [name, value] of Object.entries(model)) {
    assert(value && typeof value === 'object', 'MODEL_INVALID', `${name} is not an object`);
    assert(value.schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', `${name}.schemaVersion=${value.schemaVersion}`);
  }
}

function validateOntology(ontology) {
  unique(ontology.nodeTypes.map(item => item.id), 'DUPLICATE_NODE_TYPE');
  unique(ontology.edgeTypes, 'DUPLICATE_EDGE_TYPE');
  unique(ontology.hyperedgeTypes, 'DUPLICATE_HYPEREDGE_TYPE');
  unique(ontology.statusVocabulary, 'DUPLICATE_STATUS');
  unique(ontology.authorityVocabulary, 'DUPLICATE_AUTHORITY');
  assert(ontology.cosViews.length === 20, 'COS_VIEW_COUNT', 'Expected exactly L0 through L19');
  const expected = Array.from({ length: 20 }, (_, index) => `L${index}`);
  assert(equalArrays(ontology.cosViews.map(view => view.level), expected), 'COS_VIEW_SEQUENCE', 'COS views must be L0..L19');
  assert(Array.isArray(ontology.invariants) && ontology.invariants.length >= 8, 'ONTOLOGY_INVARIANTS_MISSING', 'At least eight invariants required');
}

function validateHypergraph(ontology, graph) {
  const nodeTypes = new Set(ontology.nodeTypes.map(item => item.id));
  const edgeTypes = new Set(ontology.edgeTypes);
  const hyperedgeTypes = new Set(ontology.hyperedgeTypes);
  const statuses = new Set(ontology.statusVocabulary);
  const authorities = new Set(ontology.authorityVocabulary);
  const nodeIds = new Set(graph.nodes.map(node => node.id));
  const edgeIds = new Set(graph.edges.map(edge => edge.id));

  unique([...nodeIds], 'DUPLICATE_NODE_ID');
  unique([...edgeIds], 'DUPLICATE_EDGE_ID');
  unique(graph.hyperedges.map(edge => edge.id), 'DUPLICATE_HYPEREDGE_ID');

  for (const node of graph.nodes) {
    assert(nodeTypes.has(node.type), 'UNKNOWN_NODE_TYPE', `${node.id}:${node.type}`);
    assert(statuses.has(node.status), 'UNKNOWN_NODE_STATUS', `${node.id}:${node.status}`);
    assert(authorities.has(node.authority), 'UNKNOWN_NODE_AUTHORITY', `${node.id}:${node.authority}`);
    assert(typeof node.owner === 'string' && node.owner.trim(), 'NODE_OWNER_MISSING', node.id);
    for (const level of node.dimensions ?? []) {
      assert(/^L(?:[0-9]|1[0-9])$/.test(level), 'INVALID_COS_DIMENSION', `${node.id}:${level}`);
    }
  }
  for (const edge of graph.edges) {
    assert(edgeTypes.has(edge.type), 'UNKNOWN_EDGE_TYPE', `${edge.id}:${edge.type}`);
    assert(nodeIds.has(edge.from), 'DANGLING_EDGE_FROM', `${edge.id}:${edge.from}`);
    assert(nodeIds.has(edge.to), 'DANGLING_EDGE_TO', `${edge.id}:${edge.to}`);
    assert(ALLOWED_EDGE_CONFIDENCE.has(edge.confidence), 'INVALID_EDGE_CONFIDENCE', edge.id);
    assert(ALLOWED_CRITICALITY.has(edge.criticality), 'INVALID_EDGE_CRITICALITY', edge.id);
  }
  for (const hyperedge of graph.hyperedges) {
    assert(hyperedgeTypes.has(hyperedge.type), 'UNKNOWN_HYPEREDGE_TYPE', `${hyperedge.id}:${hyperedge.type}`);
    assert(Array.isArray(hyperedge.members) && hyperedge.members.length >= 2, 'HYPEREDGE_MEMBERS_INVALID', hyperedge.id);
    for (const member of hyperedge.members) {
      assert(nodeIds.has(member), 'DANGLING_HYPEREDGE_MEMBER', `${hyperedge.id}:${member}`);
    }
  }

  const criticalUnowned = graph.nodes.filter(node =>
    graph.edges.some(edge => (edge.from === node.id || edge.to === node.id) && edge.criticality === 'CRITICAL')
    && (!node.owner || node.owner === 'UNKNOWN'));
  assert(criticalUnowned.length === 0, 'CRITICAL_NODE_UNOWNED', criticalUnowned.map(node => node.id).join(','));

  for (const view of graph.viewDefinitions ?? []) {
    if (view.includeTypes) {
      for (const type of view.includeTypes) assert(nodeTypes.has(type), 'VIEW_UNKNOWN_NODE_TYPE', `${view.id}:${type}`);
    }
    if (view.includeEdgeTypes) {
      for (const type of view.includeEdgeTypes) assert(edgeTypes.has(type), 'VIEW_UNKNOWN_EDGE_TYPE', `${view.id}:${type}`);
    }
  }
}

function validateProgram(program, graph) {
  const taskIds = new Set(program.tasks.map(task => task.id));
  const nodeIds = new Set(graph.nodes.map(node => node.id));
  const edgeIds = new Set(graph.edges.map(edge => edge.id));
  unique([...taskIds], 'DUPLICATE_TASK_ID');

  for (const task of program.tasks) {
    for (const field of REQUIRED_TASK_FIELDS) {
      assert(Object.hasOwn(task, field), 'TASK_FIELD_MISSING', `${task.id}:${field}`);
    }
    assert(/^T\d{4}$/.test(task.id), 'TASK_ID_INVALID', task.id);
    assert(Array.isArray(task.definitionOfDone) && task.definitionOfDone.length > 0, 'TASK_DOD_EMPTY', task.id);
    assert(typeof task.rollback === 'string' && task.rollback.trim(), 'TASK_ROLLBACK_EMPTY', task.id);
    for (const dependency of task.dependencies) assert(taskIds.has(dependency), 'TASK_DEPENDENCY_UNKNOWN', `${task.id}:${dependency}`);
    for (const node of task.affectedNodes) assert(nodeIds.has(node), 'TASK_NODE_UNKNOWN', `${task.id}:${node}`);
    for (const edge of task.affectedEdges) assert(edgeIds.has(edge), 'TASK_EDGE_UNKNOWN', `${task.id}:${edge}`);
  }
  assertAcyclic(program.tasks.map(task => ({ id: task.id, dependencies: task.dependencies })), 'TASK_DEPENDENCY_CYCLE');

  const phaseIds = new Set(program.phases.map(phase => phase.id));
  unique([...phaseIds], 'DUPLICATE_PHASE_ID');
  for (const phase of program.phases) {
    for (const wave of phase.waves) {
      for (const taskId of wave.tasks) assert(taskIds.has(taskId), 'WAVE_TASK_UNKNOWN', `${wave.id}:${taskId}`);
    }
  }
  for (const taskId of program.currentExecutableFrontier ?? []) {
    assert(taskIds.has(taskId), 'FRONTIER_TASK_UNKNOWN', taskId);
  }
}

function validateCheckpoints(model, program) {
  const taskIds = new Set(program.tasks.map(task => task.id));
  unique(model.checkpoints.map(item => item.id), 'DUPLICATE_CHECKPOINT_ID');
  const expected = Array.from({ length: 15 }, (_, index) => `CP${index}`);
  assert(equalArrays(model.checkpoints.map(item => item.id), expected), 'CHECKPOINT_SEQUENCE', 'Expected CP0..CP14');
  for (const checkpoint of model.checkpoints) {
    for (const taskId of checkpoint.requiredTasks) assert(taskIds.has(taskId), 'CHECKPOINT_TASK_UNKNOWN', `${checkpoint.id}:${taskId}`);
    assert(checkpoint.entryCriteria.length > 0, 'CHECKPOINT_ENTRY_EMPTY', checkpoint.id);
    assert(checkpoint.exitCriteria.length > 0, 'CHECKPOINT_EXIT_EMPTY', checkpoint.id);
    assert(checkpoint.requiredEvidence.length > 0, 'CHECKPOINT_EVIDENCE_EMPTY', checkpoint.id);
    assert(typeof checkpoint.rollback === 'string' && checkpoint.rollback.trim(), 'CHECKPOINT_ROLLBACK_EMPTY', checkpoint.id);
  }
}

function validateGaps(model, program, checkpoints, graph) {
  const gapIds = new Set(model.gaps.map(gap => gap.id));
  const taskIds = new Set(program.tasks.map(task => task.id));
  const checkpointIds = new Set(checkpoints.checkpoints.map(item => item.id));
  const graphIds = new Set(graph.nodes.map(node => node.id));
  unique([...gapIds], 'DUPLICATE_GAP_ID');
  for (const gap of model.gaps) {
    for (const field of REQUIRED_GAP_FIELDS) assert(Object.hasOwn(gap, field), 'GAP_FIELD_MISSING', `${gap.id}:${field}`);
    assert(/^G\d{3}$/.test(gap.id), 'GAP_ID_INVALID', gap.id);
    assert(['P0','P1','P2','P3'].includes(gap.severity), 'GAP_SEVERITY_INVALID', `${gap.id}:${gap.severity}`);
    for (const score of ['impact','probability','blastRadius','strategicImportance']) {
      assert(Number.isFinite(gap[score]) && gap[score] >= 1 && gap[score] <= 5, 'GAP_SCORE_INVALID', `${gap.id}:${score}`);
    }
    assert(Number.isFinite(gap.cost) && gap.cost >= 1, 'GAP_COST_INVALID', gap.id);
    assert(typeof gap.owner === 'string' && gap.owner.trim(), 'GAP_OWNER_MISSING', gap.id);
    assert(typeof gap.test === 'string' && gap.test.trim(), 'GAP_TEST_MISSING', gap.id);
    assert(typeof gap.evidenceRequired === 'string' && gap.evidenceRequired.trim(), 'GAP_EVIDENCE_MISSING', gap.id);
    for (const dependency of gap.dependencies) {
      assert(gapIds.has(dependency) || taskIds.has(dependency) || checkpointIds.has(dependency) || graphIds.has(dependency), 'GAP_DEPENDENCY_UNKNOWN', `${gap.id}:${dependency}`);
    }
  }
}

function validateDecisions(model) {
  unique(model.decisions.map(item => item.id), 'DUPLICATE_DECISION_ID');
  for (const decision of model.decisions) {
    for (const field of REQUIRED_DECISION_FIELDS) assert(Object.hasOwn(decision, field), 'DECISION_FIELD_MISSING', `${decision.id}:${field}`);
    assert(/^D\d{3}$/.test(decision.id), 'DECISION_ID_INVALID', decision.id);
    assert(ALLOWED_CONFIDENCE.has(decision.confidence), 'DECISION_CONFIDENCE_INVALID', `${decision.id}:${decision.confidence}`);
    assert(Array.isArray(decision.alternatives) && decision.alternatives.length >= 2, 'DECISION_ALTERNATIVES_INSUFFICIENT', decision.id);
    assert(Array.isArray(decision.risks) && Array.isArray(decision.mitigations), 'DECISION_RISK_MODEL_INVALID', decision.id);
  }
}

function validateClaims(projection) {
  const active = projection.claims.filter(claim => claim.status === 'ACTIVE');
  unique(projection.claims.map(claim => claim.claimId), 'DUPLICATE_CLAIM_ID');
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      const overlaps = scopeOverlap(active[left].exclusiveResourceScopes ?? [], active[right].exclusiveResourceScopes ?? []);
      assert(overlaps.length === 0, 'ACTIVE_EXCLUSIVE_CLAIM_COLLISION', `${active[left].claimId}<->${active[right].claimId}:${overlaps.join(',')}`);
    }
  }
}

function validateContext(truth, context, claims, ledger) {
  assert(context.projectId === truth.projectId, 'CONTEXT_PROJECT_MISMATCH', `${context.projectId}:${truth.projectId}`);
  assert(context.sourceRevision === truth.workBranchObservedSha, 'CONTEXT_STALE_SOURCE', `${context.sourceRevision}:${truth.workBranchObservedSha}`);
  assert(context.eventWatermark === ledger.eventWatermark, 'CONTEXT_STALE_EVENT_WATERMARK', `${context.eventWatermark}:${ledger.eventWatermark}`);
  assert(context.projectionRevision === truth.projectionRevision, 'CONTEXT_STALE_PROJECTION', `${context.projectionRevision}:${truth.projectionRevision}`);
  assert(claims.eventWatermark === ledger.eventWatermark, 'CLAIM_PROJECTION_STALE', `${claims.eventWatermark}:${ledger.eventWatermark}`);
  assert(context.staleByDefault === true, 'CONTEXT_MUST_BE_STALE_BY_DEFAULT', context.contextPackId);
  assert(context.authorityCeiling !== 'AUTHORITY_READY', 'CONTEXT_AUTHORITY_ESCALATION', context.contextPackId);
}

function validateAuthorityCeiling(model) {
  const openCritical = model.gaps.gaps.some(gap => ['P0','P1'].includes(gap.severity) && !['VERIFIED','EMPIRICALLY_QUALIFIED','SUPERSEDED','NOT_APPLICABLE'].includes(gap.status));
  const qualified = model.hypergraph.nodes.filter(node => QUALIFIED_STATUSES.has(node.status));
  assert(!(openCritical && qualified.length > 0), 'QUALIFIED_WITH_OPEN_CRITICAL_GAPS', qualified.map(node => node.id).join(','));
  assert(model.liveTruth.authorityStatus === 'SHADOW_ONLY', 'PRODUCT_AUTHORITY_ESCALATED', model.liveTruth.authorityStatus);
  assert(model.liveTruth.authorityCeiling === 'IMPLEMENTED_UNVERIFIED', 'AUTHORITY_CEILING_INVALID', model.liveTruth.authorityCeiling);
}

async function validateEventLedger(manifest) {
  const errors = [];
  const events = [];
  for (const segment of manifest.segments) {
    const file = path.join(ROOT, segment.path);
    try {
      const raw = await readFile(file, 'utf8');
      const parsed = raw.split(/\r?\n/).filter(Boolean).map((line, index) => {
        try { return JSON.parse(line); }
        catch (error) { throw new ValidationError('EVENT_JSON_INVALID', `${segment.path}:${index + 1}`, { cause: String(error) }); }
      });
      if (parsed.length !== segment.eventCount) throw new ValidationError('EVENT_COUNT_MISMATCH', segment.path);
      if (parsed.at(0)?.sequence !== segment.firstSequence || parsed.at(-1)?.sequence !== segment.lastSequence) {
        throw new ValidationError('EVENT_SEGMENT_RANGE_MISMATCH', segment.path);
      }
      events.push(...parsed);
    } catch (error) {
      errors.push(normalizeError(error));
    }
  }
  try {
    unique(events.map(event => event.eventId), 'DUPLICATE_EVENT_ID');
    for (let index = 0; index < events.length; index += 1) {
      assert(events[index].sequence === index + 1, 'EVENT_SEQUENCE_GAP', `index=${index} sequence=${events[index].sequence}`);
      assert(Number.isFinite(Date.parse(events[index].occurredAt)), 'EVENT_TIME_INVALID', events[index].eventId);
      assert(Number.isFinite(Date.parse(events[index].recordedAt)), 'EVENT_RECORDED_TIME_INVALID', events[index].eventId);
    }
    assert(events.at(-1)?.sequence === manifest.eventWatermark, 'EVENT_WATERMARK_MISMATCH', `${events.at(-1)?.sequence}:${manifest.eventWatermark}`);
  } catch (error) {
    errors.push(normalizeError(error));
  }
  return { errors, events };
}

function assertAcyclic(items, code) {
  const byId = new Map(items.map(item => [item.id, item.dependencies]));
  const visiting = new Set();
  const visited = new Set();
  const visit = id => {
    if (visiting.has(id)) throw new ValidationError(code, id);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
}

function scopeOverlap(leftScopes, rightScopes) {
  const overlaps = [];
  for (const left of leftScopes) {
    for (const right of rightScopes) {
      const a = normalizeScope(left);
      const b = normalizeScope(right);
      if (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) overlaps.push(`${left}<->${right}`);
    }
  }
  return overlaps;
}

function normalizeScope(scope) {
  return String(scope).replace(/\/\*\*$/, '').replace(/\/$/, '');
}

function unique(values, code) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new ValidationError(code, String(value));
    seen.add(value);
  }
}

function assert(condition, code, message) {
  if (!condition) throw new ValidationError(code, message);
}

function equalArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

function normalizeError(error) {
  if (error instanceof ValidationError) return { code: error.code, message: error.message, details: error.details };
  return { code: 'UNEXPECTED_VALIDATION_ERROR', message: String(error), details: {} };
}

async function selfTest(model) {
  const scenarios = [];
  const expectFailure = (name, mutate, code) => {
    const copy = structuredClone(model);
    mutate(copy);
    const result = validateModel(copy);
    const passed = result.errors.some(error => error.code === code);
    scenarios.push({ name, expectedCode: code, passed, errors: result.errors.map(error => error.code) });
  };

  expectFailure('duplicate node', copy => copy.hypergraph.nodes.push(structuredClone(copy.hypergraph.nodes[0])), 'DUPLICATE_NODE_ID');
  expectFailure('task cycle', copy => {
    const first = copy.program.tasks[0];
    const second = copy.program.tasks[1];
    first.dependencies = [second.id];
    second.dependencies = [first.id];
  }, 'TASK_DEPENDENCY_CYCLE');
  expectFailure('stale context', copy => { copy.contextPack.sourceRevision = 'deadbeef'; }, 'CONTEXT_STALE_SOURCE');
  expectFailure('claim collision', copy => {
    const active = copy.activeClaims.claims.find(claim => claim.status === 'ACTIVE');
    copy.activeClaims.claims.push({ ...structuredClone(active), claimId: 'claim_collision', sessionId: 'session_collision' });
  }, 'ACTIVE_EXCLUSIVE_CLAIM_COLLISION');
  expectFailure('authority escalation', copy => { copy.liveTruth.authorityStatus = 'AUTHORITY_READY'; }, 'PRODUCT_AUTHORITY_ESCALATED');

  const failed = scenarios.filter(item => !item.passed);
  if (failed.length > 0) throw new ValidationError('VALIDATOR_SELF_TEST_FAILED', failed.map(item => item.name).join(','));
  return scenarios;
}

async function main() {
  const write = process.argv.includes('--write');
  const runSelfTest = process.argv.includes('--self-test');
  const model = await loadModel();
  const validation = validateModel(model);
  const ledger = await validateEventLedger(model.eventManifest);
  validation.errors.push(...ledger.errors);

  const fingerprints = Object.fromEntries(
    Object.entries(model).map(([key, value]) => [key, hash(value)]),
  );
  const selfTests = runSelfTest ? await selfTest(model) : [];
  const report = {
    schemaVersion: 1,
    reportId: `cpreport_${hash({ fingerprints, eventWatermark: model.eventManifest.eventWatermark }).slice(0, 24)}`,
    generatedAt: new Date().toISOString(),
    sourceRevision: model.liveTruth.workBranchObservedSha,
    eventWatermark: model.eventManifest.eventWatermark,
    projectionRevision: model.liveTruth.projectionRevision,
    passed: validation.errors.length === 0,
    errors: validation.errors,
    warnings: validation.warnings,
    counts: {
      nodes: model.hypergraph.nodes.length,
      edges: model.hypergraph.edges.length,
      hyperedges: model.hypergraph.hyperedges.length,
      tasks: model.program.tasks.length,
      gaps: model.gaps.gaps.length,
      decisions: model.decisions.decisions.length,
      checkpoints: model.checkpoints.checkpoints.length,
      events: ledger.events.length,
    },
    fingerprints,
    selfTests,
    authorityEffect: 'CONTROL_PLANE_ONLY_NO_PRODUCT_SCORE_PROMOTION',
  };

  if (write) {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await writeFile(path.join(EVIDENCE_DIR, 'control-plane-validation.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify(normalizeError(error), null, 2)}\n`);
  process.exitCode = 1;
});
