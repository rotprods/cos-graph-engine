#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const BUNDLE = 'control-plane/v2/integration/coordination-integration.v4.json';
const CURRENT = 'control-plane/v2/continuity/CURRENT_V4.md';
const INCIDENT = 'control-plane/v2/incidents/INC-2026-08-30-PR57-UNREPRODUCIBLE-EVIDENCE.md';
const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;

class GateError extends Error {
  constructor(code, detail = '') {
    super(`${code}: ${detail}`);
    this.code = code;
    this.detail = detail;
  }
}
const fail = (code, detail = '') => { throw new GateError(code, detail); };
const ok = (condition, code, detail = '') => { if (!condition) fail(code, detail); };
const eq = (actual, expected, code, detail = '') => {
  if (actual !== expected) fail(code, `${detail} expected=${expected} actual=${actual}`);
};
const uniq = (values, code) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(code, String(value));
    seen.add(value);
  }
};
const stamp = (value, label) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail('TIME_INVALID', `${label}:${value}`);
  return parsed;
};
const errorRecord = error => error instanceof GateError
  ? { code: error.code, detail: error.detail }
  : { code: 'UNEXPECTED', detail: String(error) };

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail('ARG_VALUE_MISSING', name);
  return value;
}

function canonical(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('CANONICAL_NONFINITE', String(value));
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) fail('CANONICAL_CYCLE', 'array');
    seen.add(value);
    const out = value.map(item => canonical(item, seen));
    seen.delete(value);
    return out;
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('CANONICAL_UNSUPPORTED', typeof value);
  }
  if (seen.has(value)) fail('CANONICAL_CYCLE', 'object');
  seen.add(value);
  const out = {};
  for (const rawKey of Object.keys(value).sort()) {
    const key = rawKey.normalize('NFC');
    if (Object.hasOwn(out, key)) fail('CANONICAL_KEY_COLLISION', key);
    if (value[rawKey] === undefined) fail('CANONICAL_UNDEFINED', key);
    out[key] = canonical(value[rawKey], seen);
  }
  seen.delete(value);
  return out;
}
const hash = value => createHash('sha256')
  .update(typeof value === 'string' ? value : JSON.stringify(canonical(value)))
  .digest('hex');

async function load() {
  const [bundle, current, incident] = await Promise.all([
    readFile(path.join(ROOT, BUNDLE), 'utf8').then(JSON.parse),
    readFile(path.join(ROOT, CURRENT), 'utf8'),
    readFile(path.join(ROOT, INCIDENT), 'utf8'),
  ]);
  return { bundle, current, incident };
}

function validate(model, { at }) {
  const errors = [];
  const warnings = [];
  const run = fn => { try { fn(); } catch (error) { errors.push(errorRecord(error)); } };
  run(() => validateBundle(model.bundle));
  run(() => validateRefs(model.bundle));
  run(() => validateTemporal(model.bundle));
  run(() => validateClaims(model.bundle));
  run(() => validateLedger(model.bundle));
  run(() => validateContext(model.bundle, at));
  run(() => validateContinuity(model));
  run(() => validateAuthority(model.bundle));
  run(() => rebuild(model.bundle));
  warnings.push({
    code: 'RUNTIME_QUALIFICATION_NOT_RUN',
    detail: 'This repair gate validates only control-plane evidence reproducibility and restore semantics.',
  });
  return { passed: errors.length === 0, errors, warnings };
}

function validateBundle(bundle) {
  eq(bundle.schemaVersion, 4, 'SCHEMA_VERSION');
  ok(SHA40.test(bundle.sourceParentSha), 'SOURCE_PARENT_SHA');
  ok(SHA64.test(bundle.contentHash), 'BUNDLE_HASH_FORMAT');
  const copy = structuredClone(bundle);
  delete copy.contentHash;
  eq(hash(copy), bundle.contentHash, 'BUNDLE_HASH_MISMATCH');
  eq(bundle.authorityEffect, 'TARGETED_CONTROL_PLANE_REPAIR_ONLY_NO_GLOBAL_SCORE_PROMOTION', 'AUTHORITY_EFFECT');
}

function validateRefs(bundle) {
  eq(bundle.refs.repairCandidate.pr, 58, 'REPAIR_PR');
  eq(bundle.refs.repairCandidate.preMutationHeadSha, bundle.sourceParentSha, 'REPAIR_PARENT');
  eq(bundle.refs.integrationV3.pr, 57, 'V3_PR');
  eq(bundle.refs.integrationV3.status, 'UNREPRODUCIBLE_EVIDENCE', 'V3_EVIDENCE_NOT_DEMOTED');
  eq(bundle.refs.integrationV3.implementationSha, '23f303a31554ec3b6ff0ce770429e1aa27d2e7be', 'V3_IMPLEMENTATION_SHA');
  eq(bundle.refs.integrationV3.claimedEvidenceCommit, 'ea88a78dba70f695d387f4ea068fbe3e326ca2be', 'V3_EVIDENCE_SHA');
  eq(bundle.refs.coordinationV2.status, 'TARGETED_PASS', 'COORDINATION_STATUS');
  eq(bundle.refs.runtime.status, 'IMPLEMENTED_UNVERIFIED', 'RUNTIME_STATUS');
  eq(bundle.refs.authority.sha, null, 'AUTHORITY_ASSIGNED');
  eq(bundle.refs.authority.status, 'BLOCKED', 'AUTHORITY_STATUS');
  const active = bundle.roles.filter(role => role.role === 'ACTIVE_CANDIDATE');
  uniq(active.map(role => role.lane), 'DUPLICATE_ACTIVE_LANE');
  eq(active.find(role => role.lane === 'control-plane-repair')?.pr, 58, 'REPAIR_ROLE');
  eq(active.find(role => role.lane === 'runtime')?.pr, 54, 'RUNTIME_ROLE');
  for (const role of bundle.roles) ok(SHA40.test(role.sha), 'ROLE_SHA_INVALID', String(role.pr));
}

function validateTemporal(bundle) {
  ok(stamp(bundle.temporalTruth.pr57EvidenceFailureObservedAt, 'failure') > stamp(bundle.temporalTruth.pr57CreatedAt, 'pr57'), 'FAILURE_BEFORE_PR57');
  ok(stamp(bundle.temporalTruth.pr58CreatedAt, 'pr58') > stamp(bundle.temporalTruth.pr57EvidenceFailureObservedAt, 'failure'), 'PR58_BEFORE_DISCOVERY');
  eq(bundle.temporalTruth.pullRequests59To61, 'NOT_FOUND_AT_V4_OBSERVATION', 'FUTURE_PRS_NOT_UNPROVEN');
  ok(bundle.temporalTruth.law.includes('never retroactively validates'), 'TEMPORAL_LAW_MISSING');
}

function validateClaims(bundle) {
  eq(bundle.claims.length, 2, 'CLAIM_COUNT');
  const c4 = bundle.claims.find(claim => claim.revision === 4);
  const c5 = bundle.claims.find(claim => claim.revision === 5);
  ok(c4 && c5, 'CLAIM_REVISIONS_MISSING');
  eq(c4.status, 'CONSUMED', 'CLAIM4_STATUS');
  eq(c4.resultingCommit, bundle.sourceParentSha, 'CLAIM4_RESULT');
  eq(c5.status, 'CONSUMED_BY_IMPLEMENTATION_COMMIT', 'CLAIM5_STATUS');
  eq(c5.expectedHead, bundle.sourceParentSha, 'CLAIM5_EXPECTED_HEAD');
  ok(c5.fence > c4.fence, 'FENCE_NOT_MONOTONIC');
  ok(c5.revision > c4.revision, 'CLAIM_REVISION_NOT_MONOTONIC');
  eq(bundle.session.id, 'ses_e73f2954-bbbb-4ddb-9761-0a9dd862f84e', 'SESSION_ID');
  eq(bundle.session.status, 'EVIDENCE_PENDING', 'SESSION_STATUS');
  eq(bundle.session.authorityCeiling, 'IMPLEMENTED_UNVERIFIED', 'SESSION_CEILING');
}

function validateLedger(bundle) {
  const ledger = bundle.ledger;
  eq(ledger.anchorSequence, 11, 'ANCHOR_SEQUENCE');
  ok(SHA64.test(ledger.anchorHash), 'ANCHOR_HASH');
  eq(ledger.events.length, 4, 'EVENT_COUNT');
  eq(ledger.events[0].sequence, ledger.firstSequence, 'FIRST_SEQUENCE');
  eq(ledger.events.at(-1).sequence, ledger.lastSequence, 'LAST_SEQUENCE');
  uniq(ledger.events.map(event => event.eventId), 'DUPLICATE_EVENT_ID');
  uniq(ledger.events.map(event => event.idempotencyKey), 'DUPLICATE_IDEMPOTENCY');
  let previous = ledger.anchorHash;
  ledger.events.forEach((event, index) => {
    eq(event.sequence, ledger.firstSequence + index, 'EVENT_SEQUENCE', event.eventId);
    eq(event.previousEventHash, previous, 'EVENT_PREVIOUS_HASH', event.eventId);
    const copy = structuredClone(event);
    delete copy.eventHash;
    eq(hash(copy), event.eventHash, 'EVENT_HASH', event.eventId);
    previous = event.eventHash;
  });
  eq(previous, ledger.tipHash, 'EVENT_TIP');
  ok(ledger.events.some(event => event.eventType === 'EVIDENCE_REPRODUCIBILITY_FAILURE'), 'EVIDENCE_FAILURE_EVENT_MISSING');
  const failure = ledger.events.find(event => event.eventType === 'EVIDENCE_REPRODUCIBILITY_FAILURE');
  eq(failure.payload.authorityCorrection, 'PR57_TARGETED_PASS_DEMOTED_TO_UNREPRODUCIBLE', 'EVIDENCE_AUTHORITY_CORRECTION');
}

function validateContext(bundle, at) {
  const now = stamp(at, 'evaluation');
  ok(bundle.context.staleByDefault, 'CONTEXT_STALE_DEFAULT');
  ok(stamp(bundle.context.generatedAt, 'generated') <= now, 'CONTEXT_FROM_FUTURE');
  ok(now < stamp(bundle.context.expiresAt, 'expires'), 'CONTEXT_EXPIRED');
  eq(bundle.context.fences.repairParent, bundle.sourceParentSha, 'CONTEXT_PARENT_STALE');
  eq(bundle.context.fences.watermark, bundle.ledger.lastSequence, 'CONTEXT_WATERMARK');
  eq(bundle.context.fences.claimRevision, 5, 'CONTEXT_CLAIM_REVISION');
  eq(bundle.context.fences.fencingToken, 5, 'CONTEXT_FENCE');
  ok(bundle.context.facts.some(fact => fact.includes('UNREPRODUCIBLE')), 'CONTEXT_EVIDENCE_DEMOTION_MISSING');
  ok(bundle.context.facts.some(fact => fact.includes('NOT_RUN')), 'CONTEXT_RUNTIME_BOUNDARY_MISSING');
}

function validateContinuity(model) {
  for (const token of ['PR #58', 'PR #57', 'UNREPRODUCIBLE', 'SHADOW_ONLY', 'Next safe sequence']) {
    ok(model.current.includes(token), 'CURRENT_V4_STALE', token);
  }
  for (const token of ['Broken invariant', 'Authority correction', 'Permanent defenses']) {
    ok(model.incident.includes(token), 'INCIDENT_INCOMPLETE', token);
  }
}

function validateAuthority(bundle) {
  eq(bundle.refs.authority.sha, null, 'AUTHORITY_PROMOTED');
  eq(bundle.session.authorityCeiling, 'IMPLEMENTED_UNVERIFIED', 'AUTHORITY_CEILING');
  ok(bundle.proofBoundary.some(item => item.includes('runtime build/tests')), 'PROOF_BOUNDARY_RUNTIME');
}

function rebuild(bundle) {
  validateLedger(bundle);
  const state = {
    projectId: 'COS_GRAPH_ENGINE',
    mainSha: bundle.refs.main.sha,
    repairPr: bundle.refs.repairCandidate.pr,
    repairPreMutationHead: bundle.refs.repairCandidate.preMutationHeadSha,
    integrationPr: bundle.refs.integrationV3.pr,
    integrationStatus: bundle.refs.integrationV3.status,
    coordinationPr: bundle.refs.coordinationV2.pr,
    coordinationStatus: bundle.refs.coordinationV2.status,
    runtimePr: bundle.refs.runtime.pr,
    runtimeHead: bundle.refs.runtime.headSha,
    eventWatermark: bundle.ledger.lastSequence,
    eventTip: bundle.ledger.tipHash,
    claimRevision: 5,
    fencingToken: 5,
    authorityRef: null,
    authorityStatus: 'SHADOW_ONLY',
    nextSafeAction: 'execute V4 validator from exact published bytes, bind evidence to the implementation commit, then begin real runtime qualification',
  };
  eq(hash(state), bundle.restore.expectedHash, 'RESTORE_HASH');
  return state;
}

async function roundTrip(state) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cos-v4-'));
  try {
    const file = path.join(dir, 'state.json');
    await writeFile(file, JSON.stringify(state));
    return JSON.parse(await readFile(file, 'utf8'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function selfTests(model, at) {
  const scenarios = [];
  const expect = (name, expected, mutate, atOverride = at) => {
    const copy = structuredClone(model);
    mutate(copy);
    const result = validate(copy, { at: atOverride });
    const codes = Array.isArray(expected) ? expected : [expected];
    scenarios.push({ name, expected: codes, observed: result.errors.map(error => error.code), passed: codes.some(code => result.errors.some(error => error.code === code)) });
  };
  const rehash = bundle => {
    const copy = structuredClone(bundle);
    delete copy.contentHash;
    bundle.contentHash = hash(copy);
  };
  expect('event-tamper', 'EVENT_HASH', copy => { copy.bundle.ledger.events[0].payload.mainSha = '0'.repeat(40); rehash(copy.bundle); });
  expect('event-reorder', ['FIRST_SEQUENCE', 'EVENT_SEQUENCE'], copy => { [copy.bundle.ledger.events[0], copy.bundle.ledger.events[1]] = [copy.bundle.ledger.events[1], copy.bundle.ledger.events[0]]; rehash(copy.bundle); });
  expect('duplicate-idempotency', 'DUPLICATE_IDEMPOTENCY', copy => { copy.bundle.ledger.events[1].idempotencyKey = copy.bundle.ledger.events[0].idempotencyKey; rehash(copy.bundle); });
  expect('evidence-repromotion', 'V3_EVIDENCE_NOT_DEMOTED', copy => { copy.bundle.refs.integrationV3.status = 'TARGETED_PASS'; rehash(copy.bundle); });
  expect('authority-assignment', ['AUTHORITY_ASSIGNED', 'AUTHORITY_PROMOTED'], copy => { copy.bundle.refs.authority.sha = 'a'.repeat(40); rehash(copy.bundle); });
  expect('stale-fence', 'CONTEXT_FENCE', copy => { copy.bundle.context.fences.fencingToken = 4; rehash(copy.bundle); });
  expect('missing-failure-event', ['EVENT_COUNT', 'EVIDENCE_FAILURE_EVENT_MISSING'], copy => { copy.bundle.ledger.events = copy.bundle.ledger.events.filter(event => event.eventType !== 'EVIDENCE_REPRODUCIBILITY_FAILURE'); copy.bundle.ledger.firstSequence = copy.bundle.ledger.events[0].sequence; copy.bundle.ledger.lastSequence = copy.bundle.ledger.events.at(-1).sequence; rehash(copy.bundle); });
  expect('stale-current', 'CURRENT_V4_STALE', copy => { copy.current = copy.current.replaceAll('UNREPRODUCIBLE', 'PASS'); });
  expect('expired-context', 'CONTEXT_EXPIRED', copy => {}, '2026-08-30T19:40:00Z');
  expect('wrong-repair-parent', 'REPAIR_PARENT', copy => { copy.bundle.refs.repairCandidate.preMutationHeadSha = 'b'.repeat(40); rehash(copy.bundle); });
  const failed = scenarios.filter(scenario => !scenario.passed);
  if (failed.length) fail('SELF_TEST_FAILED', failed.map(item => item.name).join(','));
  return scenarios;
}

async function main() {
  const at = arg('--at', '2026-08-30T15:41:00Z');
  const model = await load();
  const validation = validate(model, { at });
  const tests = process.argv.includes('--self-test') ? selfTests(model, at) : [];
  const restored = rebuild(model.bundle);
  const disk = await roundTrip(restored);
  eq(hash(disk), hash(restored), 'DISK_RESTORE_MISMATCH');
  const report = {
    schemaVersion: 1,
    status: validation.passed ? 'PASS' : 'FAIL',
    evaluatedAt: at,
    executionRevision: process.env.COS_GIT_SHA ?? 'UNBOUND_LOCAL_EXECUTION',
    sourceParentSha: model.bundle.sourceParentSha,
    validation,
    selfTests: tests,
    restoredStateHash: hash(restored),
    counts: { events: model.bundle.ledger.events.length, roles: model.bundle.roles.length, selfTests: tests.length },
    proofBoundary: model.bundle.proofBoundary,
    authorityEffect: 'TARGETED_CONTROL_PLANE_REPAIR_EVIDENCE_ONLY_NO_GLOBAL_SCORE_PROMOTION',
  };
  report.reportHash = hash(report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!validation.passed) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify(errorRecord(error), null, 2)}\n`);
  process.exitCode = 1;
});
