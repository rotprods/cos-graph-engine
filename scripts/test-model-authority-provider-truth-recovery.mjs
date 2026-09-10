#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CONSISTENCY_WINDOW_MS,
  assertSafety,
  dispatchLostResponse,
  initialState,
  observeAuthoritativeAbsence,
} from './model-authority-provider-truth-recovery.mjs';

let assertions = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};

function has(state, code) {
  return assertSafety(state).includes(code);
}

{
  const state = dispatchLostResponse(initialState(), 'applied');
  state.acceptedEffects = 2;
  check(has(state, 'MULTIPLE_ACCEPTED_PROVIDER_EFFECTS'), 'duplicate accepted effect mutant is killed');
}
{
  const state = dispatchLostResponse(initialState(), 'none');
  state.operationState = 'committed';
  check(has(state, 'COMMIT_WITHOUT_APPLIED_PROVIDER_TRUTH'), 'commit-without-provider-truth mutant is killed');
}
{
  const state = dispatchLostResponse(initialState(), 'applied');
  state.operationState = 'committed';
  state.appliedEvidenceObserved = false;
  check(has(state, 'COMMIT_WITHOUT_APPLIED_EVIDENCE'), 'commit-without-evidence mutant is killed');
}
{
  const state = dispatchLostResponse(initialState(), 'none');
  state.operationState = 'prepared_retry';
  state.absenceProof = false;
  check(has(state, 'RETRY_WITHOUT_REPEATED_ABSENCE_PROOF'), 'retry-on-unknown mutant is killed');
}
{
  const state = dispatchLostResponse(initialState(), 'applied');
  state.operationState = 'prepared_retry';
  state.absenceProof = true;
  check(has(state, 'RETRY_DESPITE_EXISTING_PROVIDER_EFFECT'), 'retry-after-applied mutant is killed');
}
{
  const state = dispatchLostResponse(initialState(), 'partial');
  state.operationState = 'committed';
  state.appliedEvidenceObserved = true;
  check(has(state, 'COMMIT_WITHOUT_APPLIED_PROVIDER_TRUTH'), 'partial-as-commit mutant is killed');
}
{
  const state = dispatchLostResponse(initialState(), 'none');
  state.absenceObservedAt = [0];
  state.absenceProof = true;
  check(has(state, 'ABSENCE_PROOF_WITH_FEWER_THAN_TWO_OBSERVATIONS'), 'single-absence proof mutant is killed');
}
{
  const state = dispatchLostResponse(initialState(), 'none');
  state.absenceObservedAt = [0, CONSISTENCY_WINDOW_MS - 1];
  state.absenceProof = true;
  check(has(state, 'ABSENCE_PROOF_BEFORE_CONSISTENCY_WINDOW'), 'early-absence proof mutant is killed');
}
{
  const state = dispatchLostResponse(initialState(), 'none');
  state.retryPlans = 1;
  state.fenceHistory = [1, 1];
  state.providerKeyHistory = ['a', 'b'];
  check(has(state, 'NON_MONOTONIC_RETRY_FENCE'), 'non-monotonic fence mutant is killed');
}
{
  const state = dispatchLostResponse(initialState(), 'none');
  state.retryPlans = 1;
  state.fenceHistory = [1, 2];
  state.providerKeyHistory = ['same', 'same'];
  check(has(state, 'PROVIDER_KEY_REUSE'), 'provider-key reuse mutant is killed');
}
{
  let state = dispatchLostResponse(initialState(), 'none');
  state = observeAuthoritativeAbsence(state);
  state.absenceObservedAt.push(0);
  state.absenceProof = false;
  check(assertSafety(state).length === 0, 'duplicate same-time absence without proof remains safe');
}

console.log(JSON.stringify({ result: 'PASS', mutationAssertions: assertions }, null, 2));
