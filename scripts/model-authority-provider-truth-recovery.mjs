#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const MODEL_VERSION = '1.0.0';
export const CONSISTENCY_WINDOW_MS = 5_000;
export const MAX_ATTEMPTS = 2;

export function initialState() {
  return {
    operationState: 'idle',
    providerEffect: 'none',
    attempt: 0,
    mutationDispatches: 0,
    acceptedEffects: 0,
    currentFence: 1,
    currentProviderKey: 'provider-attempt-1',
    fenceHistory: [1],
    providerKeyHistory: ['provider-attempt-1'],
    activeLease: true,
    leaseOwner: 'worker-a',
    historicalFenceProven: true,
    absenceObservedAt: [],
    absenceProof: false,
    appliedEvidenceObserved: false,
    partialEvidenceObserved: false,
    unknownObservations: 0,
    retryPlans: 0,
    clockMs: 0,
    lastAction: 'initial',
  };
}

function copy(state) {
  return structuredClone(state);
}

function recomputeAbsenceProof(state) {
  const distinct = [...new Set(state.absenceObservedAt)].sort((a, b) => a - b);
  state.absenceObservedAt = distinct;
  state.absenceProof = distinct.length >= 2
    && distinct.at(-1) - distinct[0] >= CONSISTENCY_WINDOW_MS;
}

export function dispatchLostResponse(state, providerOutcome) {
  assert.equal(state.operationState === 'idle' || state.operationState === 'prepared_retry', true, 'dispatch requires idle or prepared_retry');
  assert.ok(['none', 'applied', 'partial'].includes(providerOutcome), 'provider outcome invalid');
  if (state.operationState === 'prepared_retry') {
    assert.equal(state.providerEffect, 'none', 'retry is forbidden once provider effect is known applied/partial');
    assert.equal(state.absenceProof, true, 'retry requires authoritative repeated absence proof');
    assert.ok(state.currentFence > state.fenceHistory.at(-2), 'retry fence must be newer than previous attempt');
    assert.notEqual(state.currentProviderKey, state.providerKeyHistory.at(-2), 'retry provider key must rotate');
  }
  const next = copy(state);
  next.attempt += 1;
  assert.ok(next.attempt <= MAX_ATTEMPTS, 'model bounds attempts');
  next.mutationDispatches += 1;
  next.providerEffect = providerOutcome;
  if (providerOutcome === 'applied') next.acceptedEffects += 1;
  next.operationState = 'reconciliation_required';
  next.absenceObservedAt = [];
  next.absenceProof = false;
  next.appliedEvidenceObserved = false;
  next.partialEvidenceObserved = false;
  next.lastAction = `dispatch_lost_response:${providerOutcome}`;
  return next;
}

export function inspectUnknown(state) {
  assert.equal(state.operationState, 'reconciliation_required');
  const next = copy(state);
  next.unknownObservations += 1;
  next.lastAction = 'inspect_unknown';
  return next;
}

export function inspectApplied(state, workerFence = state.currentFence) {
  assert.equal(state.operationState, 'reconciliation_required');
  assert.equal(state.providerEffect, 'applied', 'applied inspection must reflect provider truth');
  assert.equal(state.historicalFenceProven, true, 'historical execution fence must be proven');
  assert.equal(workerFence, state.currentFence, 'stale writer cannot record current transition');
  const next = copy(state);
  next.appliedEvidenceObserved = true;
  next.operationState = 'committed';
  next.lastAction = 'inspect_applied_commit';
  return next;
}

export function inspectPartial(state, workerFence = state.currentFence) {
  assert.equal(state.operationState, 'reconciliation_required');
  assert.equal(state.providerEffect, 'partial', 'partial inspection must reflect provider truth');
  assert.equal(workerFence, state.currentFence, 'stale writer cannot require compensation');
  const next = copy(state);
  next.partialEvidenceObserved = true;
  next.operationState = 'compensation_required';
  next.lastAction = 'inspect_partial_compensation';
  return next;
}

export function observeAuthoritativeAbsence(state) {
  assert.equal(state.operationState, 'reconciliation_required');
  assert.equal(state.providerEffect, 'none', 'absence cannot be authoritative when an effect exists');
  const next = copy(state);
  next.absenceObservedAt.push(next.clockMs);
  recomputeAbsenceProof(next);
  next.lastAction = 'observe_authoritative_absence';
  return next;
}

export function advanceTime(state, deltaMs = CONSISTENCY_WINDOW_MS) {
  assert.ok(Number.isSafeInteger(deltaMs) && deltaMs > 0, 'time delta must be positive safe integer');
  const next = copy(state);
  next.clockMs += deltaMs;
  next.lastAction = `advance_time:${deltaMs}`;
  return next;
}

export function expireLease(state) {
  assert.equal(state.activeLease, true, 'lease must be active before expiry');
  const next = copy(state);
  next.activeLease = false;
  next.leaseOwner = null;
  next.lastAction = 'expire_lease';
  return next;
}

export function takeoverLease(state, owner = 'worker-b') {
  assert.equal(state.activeLease, false, 'takeover requires previous lease to be inactive');
  const next = copy(state);
  next.currentFence += 1;
  next.activeLease = true;
  next.leaseOwner = owner;
  next.lastAction = `takeover_lease:${owner}`;
  return next;
}

export function releaseLease(state) {
  assert.equal(state.activeLease, true, 'release requires active lease');
  const next = copy(state);
  next.activeLease = false;
  next.leaseOwner = null;
  next.lastAction = 'release_lease';
  return next;
}

export function planRetry(state) {
  assert.equal(state.operationState, 'reconciliation_required', 'retry planning requires reconciliation_required');
  assert.equal(state.providerEffect, 'none', 'retry forbidden when provider effect exists');
  assert.equal(state.absenceProof, true, 'retry requires repeated authoritative absence proof');
  assert.equal(state.activeLease, false, 'retry planner cannot steal an active lease implicitly');
  assert.ok(state.attempt < MAX_ATTEMPTS, 'model retry bound exceeded');
  const next = copy(state);
  const previousFence = next.currentFence;
  const previousKey = next.currentProviderKey;
  next.currentFence = previousFence + 1;
  next.activeLease = true;
  next.leaseOwner = 'retry-worker';
  next.currentProviderKey = `provider-attempt-${next.attempt + 1}`;
  assert.ok(next.currentFence > previousFence, 'retry fence must advance');
  assert.notEqual(next.currentProviderKey, previousKey, 'retry key must rotate');
  next.fenceHistory.push(next.currentFence);
  next.providerKeyHistory.push(next.currentProviderKey);
  next.retryPlans += 1;
  next.operationState = 'prepared_retry';
  next.lastAction = 'plan_retry';
  return next;
}

export function attemptStaleCommit(state, staleFence) {
  try {
    inspectApplied(state, staleFence);
    return { accepted: true };
  } catch (error) {
    return { accepted: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function assertSafety(state) {
  const violations = [];
  const fail = condition => { if (condition) violations.push(condition); };
  if (state.acceptedEffects > 1) fail('MULTIPLE_ACCEPTED_PROVIDER_EFFECTS');
  if (state.mutationDispatches > MAX_ATTEMPTS) fail('MUTATION_DISPATCH_BOUND_EXCEEDED');
  if (state.operationState === 'committed' && state.providerEffect !== 'applied') fail('COMMIT_WITHOUT_APPLIED_PROVIDER_TRUTH');
  if (state.operationState === 'committed' && !state.appliedEvidenceObserved) fail('COMMIT_WITHOUT_APPLIED_EVIDENCE');
  if (state.operationState === 'compensation_required' && state.providerEffect !== 'partial') fail('COMPENSATION_WITHOUT_PARTIAL_PROVIDER_TRUTH');
  if (state.operationState === 'prepared_retry' && !state.absenceProof) fail('RETRY_WITHOUT_REPEATED_ABSENCE_PROOF');
  if (state.operationState === 'prepared_retry' && state.providerEffect !== 'none') fail('RETRY_DESPITE_EXISTING_PROVIDER_EFFECT');
  if (state.retryPlans > 0) {
    if (new Set(state.providerKeyHistory).size !== state.providerKeyHistory.length) fail('PROVIDER_KEY_REUSE');
    for (let i = 1; i < state.fenceHistory.length; i += 1) {
      if (!(state.fenceHistory[i] > state.fenceHistory[i - 1])) fail('NON_MONOTONIC_RETRY_FENCE');
    }
  }
  if (state.absenceProof) {
    const times = [...new Set(state.absenceObservedAt)].sort((a, b) => a - b);
    if (times.length < 2) fail('ABSENCE_PROOF_WITH_FEWER_THAN_TWO_OBSERVATIONS');
    else if (times.at(-1) - times[0] < CONSISTENCY_WINDOW_MS) fail('ABSENCE_PROOF_BEFORE_CONSISTENCY_WINDOW');
  }
  if (state.attempt >= 2 && state.providerKeyHistory.length < 2) fail('RETRY_ATTEMPT_WITHOUT_ROTATED_KEY_HISTORY');
  if (state.attempt >= 2 && state.fenceHistory.length < 2) fail('RETRY_ATTEMPT_WITHOUT_FENCE_HISTORY');
  return violations;
}

function canonicalState(state) {
  return JSON.stringify({
    ...state,
    absenceObservedAt: [...state.absenceObservedAt].sort((a, b) => a - b),
  });
}

function transitions(state) {
  const out = [];
  const add = (name, fn) => {
    try { out.push([name, fn()]); } catch { /* invalid action is not a transition */ }
  };
  if (state.operationState === 'idle') {
    for (const outcome of ['none', 'applied', 'partial']) add(`dispatch:${outcome}`, () => dispatchLostResponse(state, outcome));
    return out;
  }
  if (state.operationState === 'reconciliation_required') {
    add('inspect:unknown', () => inspectUnknown(state));
    if (state.providerEffect === 'applied') add('inspect:applied', () => inspectApplied(state));
    if (state.providerEffect === 'partial') add('inspect:partial', () => inspectPartial(state));
    if (state.providerEffect === 'none') {
      add('absence', () => observeAuthoritativeAbsence(state));
      if (state.absenceProof && !state.activeLease && state.attempt < MAX_ATTEMPTS) add('plan-retry', () => planRetry(state));
    }
    if (state.activeLease) add('expire-lease', () => expireLease(state));
    else add('takeover-lease', () => takeoverLease(state));
    if (state.clockMs < CONSISTENCY_WINDOW_MS * 2) add('advance-time', () => advanceTime(state));
    return out;
  }
  if (state.operationState === 'prepared_retry') {
    for (const outcome of ['none', 'applied', 'partial']) add(`retry-dispatch:${outcome}`, () => dispatchLostResponse(state, outcome));
    return out;
  }
  return out;
}

export function explore({ maxDepth = 11 } = {}) {
  const start = initialState();
  const queue = [{ state: start, depth: 0, trace: [] }];
  const seen = new Map([[canonicalState(start), 0]]);
  const violations = [];
  let transitionsExplored = 0;
  let maxObservedDepth = 0;
  const terminal = { committed: 0, compensation_required: 0, prepared_retry: 0, reconciliation_required: 0 };

  while (queue.length) {
    const current = queue.shift();
    maxObservedDepth = Math.max(maxObservedDepth, current.depth);
    const errors = assertSafety(current.state);
    for (const code of errors) violations.push({ code, trace: current.trace, state: current.state });
    if (current.depth >= maxDepth) continue;
    const nexts = transitions(current.state);
    transitionsExplored += nexts.length;
    for (const [action, next] of nexts) {
      const key = canonicalState(next);
      const nextDepth = current.depth + 1;
      const priorDepth = seen.get(key);
      if (priorDepth !== undefined && priorDepth <= nextDepth) continue;
      seen.set(key, nextDepth);
      queue.push({ state: next, depth: nextDepth, trace: [...current.trace, action] });
    }
  }

  for (const key of seen.keys()) {
    const state = JSON.parse(key);
    if (Object.hasOwn(terminal, state.operationState)) terminal[state.operationState] += 1;
  }

  return {
    modelVersion: MODEL_VERSION,
    maxDepth,
    statesVisited: seen.size,
    transitionsExplored,
    maxObservedDepth,
    terminalStateCounts: terminal,
    safetyViolations: violations,
  };
}

function runTargetedScenarios() {
  let assertions = 0;
  const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };

  let applied = dispatchLostResponse(initialState(), 'applied');
  check(applied.mutationDispatches === 1, 'one provider mutation dispatched');
  applied = expireLease(applied);
  applied = takeoverLease(applied, 'worker-b');
  const stale = attemptStaleCommit(applied, 1);
  check(stale.accepted === false, 'stale worker fence is rejected after takeover');
  applied = inspectApplied(applied, applied.currentFence);
  check(applied.operationState === 'committed', 'applied provider truth commits after takeover');
  check(applied.mutationDispatches === 1, 'applied recovery performs no second provider mutation');
  check(applied.acceptedEffects === 1, 'exactly one accepted provider effect remains');

  let absent = dispatchLostResponse(initialState(), 'none');
  absent = inspectUnknown(absent);
  check(absent.operationState === 'reconciliation_required', 'unknown remains reconciliation_required');
  check(absent.retryPlans === 0, 'unknown does not authorize retry');
  absent = observeAuthoritativeAbsence(absent);
  check(absent.absenceProof === false, 'one authoritative absence is insufficient');
  absent = advanceTime(absent, CONSISTENCY_WINDOW_MS);
  absent = observeAuthoritativeAbsence(absent);
  check(absent.absenceProof === true, 'two separated authoritative absences prove not_applied');
  let activeLeaseRejected = false;
  try { planRetry(absent); } catch { activeLeaseRejected = true; }
  check(activeLeaseRejected, 'retry planner cannot steal active lease');
  absent = expireLease(absent);
  absent = planRetry(absent);
  check(absent.operationState === 'prepared_retry', 'proven absence prepares retry');
  check(absent.currentFence === 2, 'retry gets strictly newer fence');
  check(absent.currentProviderKey !== 'provider-attempt-1', 'retry rotates provider key');
  absent = dispatchLostResponse(absent, 'applied');
  absent = inspectApplied(absent);
  check(absent.operationState === 'committed', 'retry can commit after independently observed application');
  check(absent.mutationDispatches === 2, 'one original plus one authorized retry mutation');
  check(absent.acceptedEffects === 1, 'authorized retry still yields at most one accepted effect');

  let partial = dispatchLostResponse(initialState(), 'partial');
  partial = inspectPartial(partial);
  check(partial.operationState === 'compensation_required', 'partial outcome requires compensation');
  let partialRetryRejected = false;
  try { planRetry(partial); } catch { partialRetryRejected = true; }
  check(partialRetryRejected, 'partial application cannot be retried as absence');

  let duplicateAbsence = dispatchLostResponse(initialState(), 'none');
  duplicateAbsence = observeAuthoritativeAbsence(duplicateAbsence);
  duplicateAbsence = observeAuthoritativeAbsence(duplicateAbsence);
  check(duplicateAbsence.absenceProof === false, 'duplicate same-time absence does not satisfy proof');

  return assertions;
}

function reportDigest(report) {
  return createHash('sha256').update(JSON.stringify(report)).digest('hex');
}

if (process.argv.includes('--self-test')) {
  const targetedAssertions = runTargetedScenarios();
  const exploration = explore({ maxDepth: 11 });
  assert.equal(exploration.safetyViolations.length, 0, `state exploration found ${exploration.safetyViolations.length} violations`);
  const report = {
    schemaVersion: 1,
    model: 'authority-provider-truth-recovery',
    version: MODEL_VERSION,
    targetedAssertions,
    ...exploration,
    result: 'PASS',
  };
  report.reportSha256 = reportDigest(report);
  console.log(JSON.stringify(report, null, 2));
}
