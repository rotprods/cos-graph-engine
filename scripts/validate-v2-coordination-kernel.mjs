#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DIR = 'control-plane/v2/coordination';
const EVIDENCE = 'control-plane/v2/evidence/coordination-kernel';
const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;

export class CoordinationValidationError extends Error {
  constructor(code, detail) { super(`${code}: ${detail}`); this.code = code; this.detail = detail; }
}
const fail = (code, detail) => { throw new CoordinationValidationError(code, detail); };
const eq = (a, b, code, detail = '') => { if (a !== b) fail(code, `${detail} expected=${b} actual=${a}`); };
const uniq = (values, code) => { const s = new Set(); for (const v of values) { if (s.has(v)) fail(code, String(v)); s.add(v); } };
const time = (v, label) => { const n = Date.parse(v); if (!Number.isFinite(n)) fail('TIME_INVALID', `${label}:${v}`); return n; };
const err = e => e instanceof CoordinationValidationError ? { code: e.code, detail: e.detail } : { code: 'UNEXPECTED', detail: String(e) };

export function canonicalize(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('CANONICAL_NONFINITE', String(value)); return Object.is(value, -0) ? 0 : value; }
  if (Array.isArray(value)) {
    if (seen.has(value)) fail('CANONICAL_CYCLE', 'array');
    seen.add(value); const out = value.map(v => canonicalize(v, seen)); seen.delete(value); return out;
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) fail('CANONICAL_UNSUPPORTED', typeof value);
  if (seen.has(value)) fail('CANONICAL_CYCLE', 'object');
  seen.add(value); const out = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = key.normalize('NFC');
    if (Object.hasOwn(out, normalized)) fail('CANONICAL_KEY_COLLISION', normalized);
    if (value[key] === undefined) fail('CANONICAL_UNDEFINED', normalized);
    out[normalized] = canonicalize(value[key], seen);
  }
  seen.delete(value); return out;
}
export const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonicalize(value))).digest('hex');

async function json(file) { try { return JSON.parse(await readFile(path.join(ROOT, file), 'utf8')); } catch (e) { fail('JSON_LOAD_FAILED', `${file}:${e}`); } }
async function ndjson(file) { return (await readFile(path.join(ROOT, file), 'utf8')).split(/\r?\n/).filter(Boolean).map((line, i) => { try { return JSON.parse(line); } catch (e) { fail('EVENT_JSON_INVALID', `${file}:${i + 1}:${e}`); } }); }

export async function loadCoordinationKernel() {
  return {
    manifest: await json(`${DIR}/manifest.v2.json`), refs: await json(`${DIR}/authority-refs.v2.json`),
    roles: await json(`${DIR}/pr-roles.v2.json`), claims: await json(`${DIR}/claim-leases.v2.json`),
    session: await json(`${DIR}/session.v2.json`), ledger: await json(`${DIR}/event-ledger.v2.json`),
    events: await ndjson(`${DIR}/events.v2.ndjson`), context: await json(`${DIR}/context-pack.v2.json`),
  };
}

export function validateCoordinationKernel(m, { at = new Date().toISOString() } = {}) {
  const now = time(at, 'evaluation'); const errors = []; const warnings = [];
  const run = fn => { try { fn(); } catch (e) { errors.push(err(e)); } };
  run(() => validateHashes(m)); run(() => validateRefs(m)); run(() => validateRoles(m));
  run(() => validateClaims(m, now)); run(() => validateSession(m, now)); run(() => validateEvents(m));
  run(() => validateContext(m, now)); run(() => validateAuthority(m));
  if (m.roles.nonexistentClaimsDetected?.classification === 'NARRATIVE_ONLY_NOT_GITHUB_AUTHORITY') warnings.push({ code: 'HISTORICAL_NONDURABLE_EXECUTION_CLAIMS' });
  if (m.claims.claims.some(c => c.sourceIntegrity === 'QUARANTINED_FUTURE_TIMESTAMP')) warnings.push({ code: 'QUARANTINED_FUTURE_TIMESTAMP' });
  return { passed: errors.length === 0, errors, warnings };
}

function validateHashes(m) {
  for (const [name, field] of [['manifest','contentHash'],['refs','contentHash'],['roles','contentHash'],['claims','contentHash'],['session','contentHash'],['context','contextHash']]) {
    const value = m[name], expected = value[field], copy = structuredClone(value); delete copy[field];
    if (!SHA64.test(expected ?? '')) fail('CONTENT_HASH_FORMAT', `${name}.${field}`);
    eq(sha256(copy), expected, 'CONTENT_HASH_MISMATCH', name);
  }
  eq(m.manifest.schemaVersion, 2, 'MANIFEST_SCHEMA'); uniq(m.manifest.selectedFiles, 'MANIFEST_DUPLICATE_FILE');
  if (m.manifest.authorityEffect !== 'CONTROL_PLANE_ONLY_NO_RUNTIME_OR_SCORE_PROMOTION') fail('MANIFEST_AUTHORITY_EFFECT_INVALID', m.manifest.authorityEffect);
}

function validateRefs(m) {
  eq(m.refs.schemaVersion, 2, 'REF_SCHEMA'); uniq(m.refs.refs.map(r => r.refId), 'DUPLICATE_REF_ID');
  const map = new Map(m.refs.refs.map(r => [r.refId, r]));
  for (const r of m.refs.refs) {
    if (Object.hasOwn(r, 'commitSha') && r.commitSha !== null && !SHA40.test(r.commitSha)) fail('REF_SHA_INVALID', r.refId);
    if (r.sourceCommitSha !== undefined && !SHA40.test(r.sourceCommitSha)) fail('PROJECTION_SOURCE_SHA_INVALID', r.refId);
  }
  const candidates = m.refs.refs.filter(r => r.refType === 'CandidateRef' && r.status === 'CURRENT_CANDIDATE');
  uniq(candidates.map(r => r.lane), 'DUPLICATE_CURRENT_CANDIDATE_LANE');
  for (const r of m.refs.refs.filter(r => r.refType === 'ProjectionRef')) {
    const source = map.get(r.sourceRefId); if (!source) fail('PROJECTION_SOURCE_REF_MISSING', r.refId);
    eq(r.sourceCommitSha, source.commitSha, 'PROJECTION_SOURCE_SHA_MISMATCH', r.refId);
  }
  const authorities = m.refs.refs.filter(r => r.refType === 'AuthorityRef'); eq(authorities.length, 1, 'AUTHORITY_REF_COUNT');
  if (authorities[0].status === 'BLOCKED' && authorities[0].commitSha !== null) fail('BLOCKED_AUTHORITY_REF_ASSIGNED', authorities[0].commitSha);
  eq(authorities[0].authority, 'UNASSIGNED', 'AUTHORITY_REF_ESCALATED');
}

function validateRoles(m) {
  eq(m.roles.schemaVersion, 2, 'PR_ROLE_SCHEMA'); uniq(m.roles.roles.map(r => r.pr), 'DUPLICATE_PR_ROLE');
  const active = m.roles.roles.filter(r => r.role === 'ACTIVE_CANDIDATE'); uniq(active.map(r => r.lane), 'DUPLICATE_ACTIVE_PR_LANE');
  for (const r of active) if (!SHA40.test(r.headSha)) fail('PR_ROLE_SHA_INVALID', String(r.pr));
  for (const ref of m.refs.refs.filter(r => r.refType === 'CandidateRef')) {
    const role = active.find(r => r.lane === ref.lane); if (!role) fail('CANDIDATE_PR_ROLE_MISSING', ref.lane);
    if (role.pr !== ref.pullRequest || role.headSha !== ref.commitSha) fail('CANDIDATE_PR_ROLE_MISMATCH', ref.lane);
  }
  const missing = m.roles.nonexistentClaimsDetected;
  eq(missing?.classification, 'NARRATIVE_ONLY_NOT_GITHUB_AUTHORITY', 'MISSING_OBJECT_CLASSIFICATION_INVALID');
  if (!missing.pullRequests.includes(56) || !missing.branches.includes('hardening/t0703-test-truth-campaign')) fail('ESCAPED_FAILURE_OBJECTS_NOT_RECORDED', 'PR56/T0703');
}

function validateClaims(m, now) {
  eq(m.claims.schemaVersion, 2, 'CLAIM_SCHEMA'); uniq(m.claims.claims.map(c => c.claimId), 'DUPLICATE_CLAIM_ID');
  const active = m.claims.claims.filter(c => c.status === 'ACTIVE'); eq(active.length, 1, 'ACTIVE_CLAIM_COUNT'); const c = active[0];
  eq(c.revision, m.claims.revision, 'CLAIM_REVISION_MISMATCH'); eq(c.fencingToken, m.claims.currentFencingToken, 'CLAIM_FENCE_MISMATCH');
  const prior = m.claims.claims.filter(x => x !== c); if (c.revision <= Math.max(0, ...prior.map(x => x.revision ?? 0))) fail('CLAIM_REVISION_NOT_MONOTONIC', c.claimId);
  if (c.fencingToken <= Math.max(0, ...prior.map(x => x.fencingToken ?? 0))) fail('CLAIM_FENCE_NOT_MONOTONIC', c.claimId);
  const candidate = m.refs.refs.find(r => r.refId === 'ref:candidate:control-plane'); eq(c.expectedCandidateSha, candidate.commitSha, 'CLAIM_CANDIDATE_SHA_MISMATCH');
  if (now >= time(c.expiresAt, 'claim expiry')) fail('CLAIM_EXPIRED', c.claimId); if (time(c.heartbeatAt, 'claim heartbeat') > now) fail('CLAIM_HEARTBEAT_IN_FUTURE', c.claimId);
  for (const h of prior) if (h.sourceIntegrity === 'QUARANTINED_FUTURE_TIMESTAMP' && h.status !== 'QUARANTINED_SUPERSEDED') fail('INVALID_TIMESTAMP_CLAIM_NOT_QUARANTINED', h.claimId);
  for (const required of ['claimId','expectedRevision','fencingToken','expectedCandidateSha']) if (!m.claims.writeContract.required.includes(required)) fail('CLAIM_WRITE_CONTRACT_FIELD_MISSING', required);
}

function validateSession(m, now) {
  eq(m.session.schemaVersion, 2, 'SESSION_SCHEMA'); const c = m.claims.claims.find(x => x.status === 'ACTIVE');
  eq(m.session.sessionId, c.sessionId, 'SESSION_ACTIVE_CLAIM_MISMATCH'); eq(m.session.claimId, c.claimId, 'SESSION_CLAIM_ID_MISMATCH');
  eq(m.session.claimRevision, c.revision, 'SESSION_CLAIM_REVISION_MISMATCH'); eq(m.session.fencingToken, c.fencingToken, 'SESSION_FENCE_MISMATCH');
  eq(m.session.expectedBaseSha, c.expectedCandidateSha, 'SESSION_BASE_SHA_MISMATCH'); if (time(m.session.heartbeatAt, 'session heartbeat') > now) fail('SESSION_HEARTBEAT_IN_FUTURE', m.session.sessionId);
}

function validateEvents(m) {
  eq(m.ledger.schemaVersion, 2, 'LEDGER_SCHEMA'); if (!SHA64.test(m.ledger.legacyAnchor.anchorHash)) fail('LEDGER_ANCHOR_INVALID', '');
  eq(m.events.length, m.ledger.eventCount, 'LEDGER_EVENT_COUNT_MISMATCH'); eq(m.events[0].sequence, m.ledger.firstSequence, 'LEDGER_FIRST_SEQUENCE_MISMATCH');
  uniq(m.events.map(e => e.eventId), 'DUPLICATE_EVENT_ID'); uniq(m.events.map(e => e.idempotencyKey), 'DUPLICATE_EVENT_IDEMPOTENCY_KEY');
  let previous = m.ledger.legacyAnchor.anchorHash;
  m.events.forEach((event, index) => {
    eq(event.sequence, m.ledger.firstSequence + index, 'EVENT_SEQUENCE_GAP', event.eventId); eq(event.previousEventHash, previous, 'EVENT_PREVIOUS_HASH_MISMATCH', event.eventId);
    const copy = structuredClone(event); delete copy.eventHash; eq(sha256(copy), event.eventHash, 'EVENT_HASH_MISMATCH', event.eventId); previous = event.eventHash;
  });
  eq(previous, m.ledger.lastEventHash, 'LEDGER_LAST_HASH_MISMATCH');
  const incident = m.events.find(e => e.eventType === 'ESCAPED_FAILURE_DETECTED'); if (!incident) fail('ESCAPED_FAILURE_EVENT_MISSING', '');
  eq(incident.payload.authorityCorrection, 'NOT_RUN / NONEXISTENT_OBJECTS', 'ESCAPED_FAILURE_AUTHORITY_CORRECTION_INVALID');
}

function validateContext(m, now) {
  eq(m.context.schemaVersion, 2, 'CONTEXT_SCHEMA'); if (!m.context.staleByDefault) fail('CONTEXT_NOT_STALE_BY_DEFAULT', m.context.contextPackId);
  if (now >= time(m.context.expiresAt, 'context expiry')) fail('CONTEXT_EXPIRED', m.context.contextPackId); if (time(m.context.generatedAt, 'context generated') > now) fail('CONTEXT_GENERATED_IN_FUTURE', m.context.contextPackId);
  const refs = new Map(m.refs.refs.map(r => [r.refId, r]));
  eq(m.context.fences.defaultBranchSha, refs.get('ref:default:main').commitSha, 'CONTEXT_DEFAULT_SHA_STALE');
  eq(m.context.fences.controlPlaneCandidateSha, refs.get('ref:candidate:control-plane').commitSha, 'CONTEXT_CANDIDATE_SHA_STALE');
  eq(m.context.fences.runtimeCandidateSha, refs.get('ref:candidate:runtime').commitSha, 'CONTEXT_RUNTIME_SHA_STALE');
  eq(m.context.fences.eventWatermark, m.ledger.lastSequence, 'CONTEXT_EVENT_WATERMARK_STALE');
  const c = m.claims.claims.find(x => x.status === 'ACTIVE'); eq(m.context.fences.claimId, c.claimId, 'CONTEXT_CLAIM_ID_STALE'); eq(m.context.fences.claimRevision, c.revision, 'CONTEXT_CLAIM_REVISION_STALE'); eq(m.context.fences.fencingToken, c.fencingToken, 'CONTEXT_CLAIM_FENCE_STALE');
  uniq(m.context.facts.map(f => f.factId), 'DUPLICATE_CONTEXT_FACT'); for (const f of m.context.facts) if (!f.source?.uri || !f.source?.revision) fail('CONTEXT_FACT_PROVENANCE_MISSING', f.factId);
  if (!m.context.unknowns.some(u => u.unknownId === 'unknown:runtime-build' && u.statement.includes('NOT_RUN'))) fail('CONTEXT_RUNTIME_NOTRUN_CORRECTION_MISSING', '');
}

function validateAuthority(m) {
  const authority = m.refs.refs.find(r => r.refType === 'AuthorityRef'); if (authority.commitSha !== null || authority.status !== 'BLOCKED') fail('AUTHORITY_PROMOTION_WITHOUT_EVIDENCE', String(authority.commitSha));
  for (const [name, value] of [['session',m.session.authorityCeiling],['context',m.context.authorityCeiling]]) eq(value, 'IMPLEMENTED_UNVERIFIED', 'AUTHORITY_CEILING_INVALID', name);
}

const rehash = (object, field) => { const copy = structuredClone(object); delete copy[field]; object[field] = sha256(copy); };
export function runMutationSelfTests(base, at) {
  const scenarios = []; const expect = (name, code, mutate, evaluationAt = at) => { const m = structuredClone(base); mutate(m); const r = validateCoordinationKernel(m, { at: evaluationAt }); scenarios.push({ name, expectedCode: code, passed: r.errors.some(e => e.code === code), observed: r.errors.map(e => e.code) }); };
  expect('event payload tamper','EVENT_HASH_MISMATCH',m=>{m.events[1].payload.observedMismatch='tampered';});
  expect('event reorder','EVENT_SEQUENCE_GAP',m=>{[m.events[1],m.events[2]]=[m.events[2],m.events[1]];});
  expect('duplicate event id','DUPLICATE_EVENT_ID',m=>{m.events[1].eventId=m.events[0].eventId;});
  expect('duplicate idempotency','DUPLICATE_EVENT_IDEMPOTENCY_KEY',m=>{m.events[1].idempotencyKey=m.events[0].idempotencyKey;});
  expect('duplicate candidate lane','DUPLICATE_CURRENT_CANDIDATE_LANE',m=>{const x=structuredClone(m.refs.refs.find(r=>r.refId==='ref:candidate:control-plane'));x.refId+=':duplicate';x.pullRequest=999;m.refs.refs.push(x);rehash(m.refs,'contentHash');});
  expect('stale claim fence','CLAIM_FENCE_MISMATCH',m=>{m.claims.currentFencingToken++;rehash(m.claims,'contentHash');});
  expect('stale candidate sha','CONTEXT_CANDIDATE_SHA_STALE',m=>{m.context.fences.controlPlaneCandidateSha='0'.repeat(40);rehash(m.context,'contextHash');});
  expect('expired context','CONTEXT_EXPIRED',()=>{},new Date(time(base.context.expiresAt,'expiry')+1).toISOString());
  expect('authority assignment','BLOCKED_AUTHORITY_REF_ASSIGNED',m=>{const r=m.refs.refs.find(x=>x.refType==='AuthorityRef');r.commitSha='1'.repeat(40);r.authority='CANONICAL_AUTHORITY';rehash(m.refs,'contentHash');});
  expect('unquarantined future claim','INVALID_TIMESTAMP_CLAIM_NOT_QUARANTINED',m=>{m.claims.claims.find(c=>c.sourceIntegrity==='QUARANTINED_FUTURE_TIMESTAMP').status='SUPERSEDED';rehash(m.claims,'contentHash');});
  const failed = scenarios.filter(s => !s.passed); if (failed.length) fail('SELF_TEST_FAILED', failed.map(s => s.name).join(',')); return scenarios;
}

async function main() {
  const args = process.argv.slice(2), index = args.indexOf('--at'), at = index >= 0 ? args[index + 1] : new Date().toISOString();
  const model = await loadCoordinationKernel(), result = validateCoordinationKernel(model, { at }), selfTests = args.includes('--self-test') ? runMutationSelfTests(model, at) : [];
  const report = { schemaVersion: 2, reportId: `coord_${sha256({at,tip:model.ledger.lastEventHash}).slice(0,24)}`, generatedAt: new Date().toISOString(), evaluatedAt: at, executionRevision: process.env.COS_GIT_SHA ?? 'UNBOUND_LOCAL_EXECUTION', expectedBaseSha: model.manifest.observedBaseSha, passed: result.passed, errors: result.errors, warnings: result.warnings, counts: { refs:model.refs.refs.length, prRoles:model.roles.roles.length, claims:model.claims.claims.length, events:model.events.length, contextFacts:model.context.facts.length, selfTests:selfTests.length }, selfTests, fingerprints: { refs:model.refs.contentHash, roles:model.roles.contentHash, claims:model.claims.contentHash, session:model.session.contentHash, context:model.context.contextHash, manifest:model.manifest.contentHash, eventTip:model.ledger.lastEventHash }, authorityEffect:'COORDINATION_KERNEL_ONLY_NO_RUNTIME_OR_SCORE_PROMOTION' };
  if (args.includes('--write')) { await mkdir(path.join(ROOT,EVIDENCE), {recursive:true}); await writeFile(path.join(ROOT,EVIDENCE,'preflight-validation.json'), JSON.stringify(report,null,2)+'\n'); }
  process.stdout.write(JSON.stringify(report,null,2)+'\n'); if (!report.passed) process.exitCode=1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e=>{process.stderr.write(JSON.stringify(err(e),null,2)+'\n');process.exitCode=1;});
