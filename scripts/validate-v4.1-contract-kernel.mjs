#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const CONTRACTS_PATH = 'control-plane/v4.1/model/contracts.v1.json';
const SHA40 = /^[0-9a-f]{40}$/;

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
  if (actual !== expected) fail(code, `${detail} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};
const uniq = (items, code) => {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) fail(code, String(item));
    seen.add(item);
  }
};
const errorRecord = error => error instanceof GateError
  ? { code: error.code, detail: error.detail }
  : { code: 'UNEXPECTED', detail: String(error) };

function transitionSet(machine) {
  return new Set(machine.transitions.map(([from, to]) => `${from}=>${to}`));
}

function validateMachine(name, machine) {
  ok(machine && typeof machine === 'object', 'MACHINE_MISSING', name);
  ok(Array.isArray(machine.states) && machine.states.length > 0, 'MACHINE_STATES', name);
  uniq(machine.states, 'MACHINE_DUPLICATE_STATE');
  ok(machine.states.includes(machine.initial), 'MACHINE_INITIAL_UNKNOWN', name);
  for (const terminal of machine.terminal ?? []) {
    ok(machine.states.includes(terminal), 'MACHINE_TERMINAL_UNKNOWN', `${name}:${terminal}`);
  }
  uniq(machine.transitions.map(pair => pair.join('=>')), 'MACHINE_DUPLICATE_TRANSITION');
  for (const [from, to] of machine.transitions) {
    ok(machine.states.includes(from), 'MACHINE_TRANSITION_FROM_UNKNOWN', `${name}:${from}`);
    ok(machine.states.includes(to), 'MACHINE_TRANSITION_TO_UNKNOWN', `${name}:${to}`);
    ok(from !== to, 'MACHINE_SELF_TRANSITION', `${name}:${from}`);
  }
}

function validateModel(model) {
  eq(model.schemaVersion, 1, 'SCHEMA_VERSION');
  eq(model.contractId, 'cos_repo_assurance_v4_1_contract_kernel', 'CONTRACT_ID');
  ok(SHA40.test(model.sourceParentSha), 'SOURCE_PARENT_SHA');
  eq(model.authorityCeiling, 'IMPLEMENTED_UNVERIFIED', 'AUTHORITY_CEILING');

  uniq(model.authorityLattice, 'AUTHORITY_DUPLICATE');
  eq(model.authorityLattice[0], 'UNTRUSTED_DATA', 'AUTHORITY_LATTICE_FLOOR');
  eq(model.authorityLattice.at(-1), 'CANONICAL_AUTHORITY', 'AUTHORITY_LATTICE_CEILING');
  ok(model.authorityLattice.indexOf('IMPLEMENTED_UNVERIFIED') < model.authorityLattice.indexOf('TARGETED_PASS'), 'AUTHORITY_ORDER_IMPLEMENTED');
  ok(model.authorityLattice.indexOf('CLEANROOM_PASS') < model.authorityLattice.indexOf('PROMOTION_ELIGIBLE'), 'AUTHORITY_ORDER_CLEANROOM');

  for (const name of ['Defect', 'Evidence', 'Candidate', 'ClaimLease']) {
    validateMachine(name, model.stateMachines[name]);
  }

  const candidateTransitions = transitionSet(model.stateMachines.Candidate);
  ok(candidateTransitions.has('PROMOTION_ELIGIBLE=>CANONICAL_AUTHORITY'), 'CANDIDATE_PROMOTION_PATH_MISSING');
  ok(!candidateTransitions.has('OBSERVED=>CANONICAL_AUTHORITY'), 'CANDIDATE_PROMOTION_SKIP');
  ok(!candidateTransitions.has('TARGETED_PASS=>CANONICAL_AUTHORITY'), 'CANDIDATE_TARGETED_SKIP');
  ok(!candidateTransitions.has('FULL_PASS=>CANONICAL_AUTHORITY'), 'CANDIDATE_FULL_SKIP');

  const evidenceTransitions = transitionSet(model.stateMachines.Evidence);
  ok(!evidenceTransitions.has('WRITTEN_UNEXECUTED=>CLEANROOM_PASS'), 'EVIDENCE_SKIP_EXECUTION');
  ok(!evidenceTransitions.has('INVALIDATED=>TARGETED_PASS'), 'EVIDENCE_REVALIDATION_WITHOUT_NEW_OBJECT');

  const requiredHardInvariants = [
    'UNKNOWN_NEVER_IMPLIES_PASS',
    'NO_PASS_WITHOUT_EXACT_CANDIDATE_SHA',
    'STALE_SHA_EVIDENCE_CANNOT_QUALIFY',
    'INVALIDATED_EVIDENCE_CANNOT_QUALIFY',
    'OPEN_P0_BLOCKS_PROMOTION',
    'OPEN_P1_BLOCKS_PROMOTION',
    'PROMOTION_IS_CONJUNCTIVE_NOT_AVERAGED',
    'PROJECTION_CANNOT_ASSIGN_CANONICAL_AUTHORITY',
    'IMPLEMENTED_UNVERIFIED_CANNOT_SKIP_TO_AUTHORITY',
  ];
  for (const invariant of requiredHardInvariants) {
    ok(model.hardInvariants.includes(invariant), 'HARD_INVARIANT_MISSING', invariant);
  }

  eq(model.checkpoints.length, 13, 'CHECKPOINT_COUNT');
  uniq(model.checkpoints.map(cp => cp.id), 'CHECKPOINT_DUPLICATE_ID');
  model.checkpoints.forEach((checkpoint, index) => {
    eq(checkpoint.id, `CP${index}`, 'CHECKPOINT_SEQUENCE', checkpoint.id);
    ok(typeof checkpoint.name === 'string' && checkpoint.name.length > 0, 'CHECKPOINT_NAME', checkpoint.id);
  });

  eq(model.promotionRequirements.openP0, 0, 'PROMOTION_P0');
  eq(model.promotionRequirements.openP1, 0, 'PROMOTION_P1');
  eq(model.promotionRequirements.requiredChecks, 'PASS', 'PROMOTION_CHECKS');
  eq(model.promotionRequirements.cleanroom, 'PASS', 'PROMOTION_CLEANROOM');
  eq(model.promotionRequirements.security, 'PASS', 'PROMOTION_SECURITY');
  eq(model.promotionRequirements.authorityConsistent, true, 'PROMOTION_AUTHORITY');
  eq(model.promotionRequirements.criticalEvidenceExactSha, true, 'PROMOTION_EXACT_SHA');

  ok(model.uncertaintyStates.includes('UNKNOWN'), 'UNKNOWN_STATE_MISSING');
  ok(!model.passLikeEvidenceStates.includes('UNKNOWN'), 'UNKNOWN_MARKED_PASS');
}

function canTransition(model, machineName, from, to) {
  const machine = model.stateMachines[machineName];
  if (!machine) fail('MACHINE_MISSING', machineName);
  return transitionSet(machine).has(`${from}=>${to}`);
}

function validateEvidence(model, evidence, candidateSha) {
  ok(SHA40.test(candidateSha), 'CANDIDATE_SHA_INVALID', candidateSha);
  ok(evidence && typeof evidence === 'object', 'EVIDENCE_OBJECT');
  ok(typeof evidence.status === 'string', 'EVIDENCE_STATUS');
  ok(model.stateMachines.Evidence.states.includes(evidence.status), 'EVIDENCE_STATUS_UNKNOWN', evidence.status);

  if (model.passLikeEvidenceStates.includes(evidence.status)) {
    ok(SHA40.test(evidence.candidateSha ?? ''), 'EVIDENCE_SHA_MISSING');
    eq(evidence.candidateSha, candidateSha, 'EVIDENCE_SHA_STALE');
    ok(typeof evidence.command === 'string' && evidence.command.trim().length > 0, 'EVIDENCE_COMMAND_MISSING');
    ok(Number.isInteger(evidence.exitCode), 'EVIDENCE_EXIT_CODE_MISSING');
    eq(evidence.exitCode, 0, 'EVIDENCE_EXIT_CODE_NONZERO');
  }

  ok(!model.evidenceRequirements.terminalNonQualifyingStates.includes(evidence.status), 'EVIDENCE_NON_QUALIFYING_STATE', evidence.status);
  ok(!model.evidenceRequirements.writtenOnlyStates.includes(evidence.status), 'EVIDENCE_UNEXECUTED', evidence.status);
  return true;
}

function evaluatePromotion(model, candidate, evidence = []) {
  ok(candidate && typeof candidate === 'object', 'PROMOTION_INPUT');
  ok(SHA40.test(candidate.candidateSha ?? ''), 'PROMOTION_CANDIDATE_SHA');

  const req = model.promotionRequirements;
  eq(candidate.openP0, req.openP0, 'PROMOTION_BLOCKED_P0');
  eq(candidate.openP1, req.openP1, 'PROMOTION_BLOCKED_P1');
  eq(candidate.requiredChecks, req.requiredChecks, 'PROMOTION_BLOCKED_CHECKS');
  eq(candidate.cleanroom, req.cleanroom, 'PROMOTION_BLOCKED_CLEANROOM');
  eq(candidate.security, req.security, 'PROMOTION_BLOCKED_SECURITY');
  eq(candidate.authorityConsistent, req.authorityConsistent, 'PROMOTION_BLOCKED_AUTHORITY');
  eq(candidate.criticalEvidenceExactSha, req.criticalEvidenceExactSha, 'PROMOTION_BLOCKED_EXACT_SHA');

  ok(evidence.length > 0, 'PROMOTION_EVIDENCE_EMPTY');
  for (const packet of evidence) validateEvidence(model, packet, candidate.candidateSha);

  return {
    eligible: true,
    state: 'PROMOTION_ELIGIBLE',
    candidateSha: candidate.candidateSha,
  };
}

function validateProjectionAuthority(projection) {
  if (projection.authority === 'CANONICAL_AUTHORITY') {
    fail('PROJECTION_AUTHORITY_ESCALATION', projection.id ?? 'unknown');
  }
  return true;
}

function runValidation(model) {
  const errors = [];
  try { validateModel(model); } catch (error) { errors.push(errorRecord(error)); }
  return { passed: errors.length === 0, errors };
}

function selfTests(model) {
  const scenarios = [];
  const expectReject = (name, code, fn) => {
    try {
      fn();
      scenarios.push({ name, expected: code, observed: null, passed: false });
    } catch (error) {
      const observed = error instanceof GateError ? error.code : 'UNEXPECTED';
      scenarios.push({ name, expected: code, observed, passed: observed === code });
    }
  };
  const expectPass = (name, fn) => {
    try {
      fn();
      scenarios.push({ name, expected: 'PASS', observed: 'PASS', passed: true });
    } catch (error) {
      scenarios.push({ name, expected: 'PASS', observed: error instanceof GateError ? error.code : 'UNEXPECTED', passed: false });
    }
  };

  const shaA = 'a'.repeat(40);
  const shaB = 'b'.repeat(40);
  const goodEvidence = {
    status: 'CLEANROOM_PASS',
    candidateSha: shaA,
    command: 'node scripts/validate-v4.1-contract-kernel.mjs --self-test',
    exitCode: 0,
  };
  const goodCandidate = {
    candidateSha: shaA,
    openP0: 0,
    openP1: 0,
    requiredChecks: 'PASS',
    cleanroom: 'PASS',
    security: 'PASS',
    authorityConsistent: true,
    criticalEvidenceExactSha: true,
  };

  expectPass('baseline-model', () => validateModel(model));
  expectPass('legal-candidate-promotion-path', () => {
    ok(canTransition(model, 'Candidate', 'CLEANROOM_PASS', 'PROMOTION_ELIGIBLE'), 'LEGAL_PATH_MISSING');
    ok(canTransition(model, 'Candidate', 'PROMOTION_ELIGIBLE', 'CANONICAL_AUTHORITY'), 'LEGAL_AUTHORITY_PATH_MISSING');
  });
  expectReject('skip-targeted-to-authority', 'ILLEGAL_TRANSITION', () => {
    if (!canTransition(model, 'Candidate', 'TARGETED_PASS', 'CANONICAL_AUTHORITY')) fail('ILLEGAL_TRANSITION', 'TARGETED_PASS=>CANONICAL_AUTHORITY');
  });
  expectReject('missing-evidence-sha', 'EVIDENCE_SHA_MISSING', () => validateEvidence(model, { ...goodEvidence, candidateSha: undefined }, shaA));
  expectReject('stale-evidence-sha', 'EVIDENCE_SHA_STALE', () => validateEvidence(model, { ...goodEvidence, candidateSha: shaB }, shaA));
  expectReject('unexecuted-evidence', 'EVIDENCE_UNEXECUTED', () => validateEvidence(model, { status: 'WRITTEN_UNEXECUTED' }, shaA));
  expectReject('invalidated-evidence', 'EVIDENCE_NON_QUALIFYING_STATE', () => validateEvidence(model, { status: 'INVALIDATED' }, shaA));
  expectReject('nonzero-pass-evidence', 'EVIDENCE_EXIT_CODE_NONZERO', () => validateEvidence(model, { ...goodEvidence, exitCode: 1 }, shaA));
  expectPass('promotion-happy-path', () => evaluatePromotion(model, goodCandidate, [goodEvidence]));
  expectReject('open-p0-blocks-promotion', 'PROMOTION_BLOCKED_P0', () => evaluatePromotion(model, { ...goodCandidate, openP0: 1 }, [goodEvidence]));
  expectReject('open-p1-blocks-promotion', 'PROMOTION_BLOCKED_P1', () => evaluatePromotion(model, { ...goodCandidate, openP1: 1 }, [goodEvidence]));
  expectReject('unknown-check-cannot-pass', 'PROMOTION_BLOCKED_CHECKS', () => evaluatePromotion(model, { ...goodCandidate, requiredChecks: 'UNKNOWN' }, [goodEvidence]));
  expectReject('security-fail-blocks-promotion', 'PROMOTION_BLOCKED_SECURITY', () => evaluatePromotion(model, { ...goodCandidate, security: 'FAIL' }, [goodEvidence]));
  expectReject('authority-inconsistency-blocks-promotion', 'PROMOTION_BLOCKED_AUTHORITY', () => evaluatePromotion(model, { ...goodCandidate, authorityConsistent: false }, [goodEvidence]));
  expectReject('projection-cannot-assign-authority', 'PROJECTION_AUTHORITY_ESCALATION', () => validateProjectionAuthority({ id: 'projection:test', authority: 'CANONICAL_AUTHORITY' }));

  const mutated = structuredClone(model);
  mutated.checkpoints[7].id = 'CP8';
  expectReject('checkpoint-gap-detected', 'CHECKPOINT_DUPLICATE_ID', () => validateModel(mutated));

  const skip = structuredClone(model);
  skip.stateMachines.Candidate.transitions.push(['OBSERVED', 'CANONICAL_AUTHORITY']);
  expectReject('model-rejects-authority-skip', 'CANDIDATE_PROMOTION_SKIP', () => validateModel(skip));

  const unknownPass = structuredClone(model);
  unknownPass.passLikeEvidenceStates.push('UNKNOWN');
  expectReject('model-rejects-unknown-as-pass', 'UNKNOWN_MARKED_PASS', () => validateModel(unknownPass));

  const failed = scenarios.filter(scenario => !scenario.passed);
  return { passed: failed.length === 0, total: scenarios.length, failed: failed.length, scenarios };
}

async function main() {
  const model = JSON.parse(await readFile(CONTRACTS_PATH, 'utf8'));
  const validation = runValidation(model);
  const report = { validation };

  if (process.argv.includes('--self-test')) {
    report.selfTest = selfTests(model);
  }

  const passed = validation.passed && (!report.selfTest || report.selfTest.passed);
  report.passed = passed;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = passed ? 0 : 1;
}

main().catch(error => {
  const record = errorRecord(error);
  process.stderr.write(`${JSON.stringify({ passed: false, fatal: record }, null, 2)}\n`);
  process.exitCode = 1;
});
