#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const CONTRACTS_PATH = 'control-plane/v4.1/model/contracts.v3.json';
const SHA40 = /^[0-9a-f]{40}$/;
const CANONICAL_PASS_ORDER = [
  'TARGETED_PASS',
  'SYSTEM_PASS',
  'PHYSICAL_PASS',
  'ADVERSARIAL_PASS',
  'CLEANROOM_PASS',
];

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
  ok(Array.isArray(machine.transitions), 'MACHINE_TRANSITIONS', name);
  uniq(machine.states, 'MACHINE_DUPLICATE_STATE');
  ok(machine.states.includes(machine.initial), 'MACHINE_INITIAL_UNKNOWN', name);
  for (const terminal of machine.terminal ?? []) {
    ok(machine.states.includes(terminal), 'MACHINE_TERMINAL_UNKNOWN', `${name}:${terminal}`);
  }
  uniq(machine.transitions.map(pair => pair.join('=>')), 'MACHINE_DUPLICATE_TRANSITION');
  for (const pair of machine.transitions) {
    ok(Array.isArray(pair) && pair.length === 2, 'MACHINE_TRANSITION_SHAPE', name);
    const [from, to] = pair;
    ok(machine.states.includes(from), 'MACHINE_TRANSITION_FROM_UNKNOWN', `${name}:${from}`);
    ok(machine.states.includes(to), 'MACHINE_TRANSITION_TO_UNKNOWN', `${name}:${to}`);
    ok(from !== to, 'MACHINE_SELF_TRANSITION', `${name}:${from}`);
  }
}

function validateModel(model) {
  eq(model.schemaVersion, 3, 'SCHEMA_VERSION');
  eq(model.contractId, 'cos_repo_assurance_v4_1_contract_kernel', 'CONTRACT_ID');
  ok(SHA40.test(model.sourceParentSha), 'SOURCE_PARENT_SHA');
  eq(model.authorityCeiling, 'IMPLEMENTED_UNVERIFIED', 'AUTHORITY_CEILING');

  uniq(model.authorityLattice, 'AUTHORITY_DUPLICATE');
  eq(model.authorityLattice[0], 'UNTRUSTED_DATA', 'AUTHORITY_LATTICE_FLOOR');
  eq(model.authorityLattice.at(-1), 'CANONICAL_AUTHORITY', 'AUTHORITY_LATTICE_CEILING');
  eq(JSON.stringify(model.passLikeEvidenceStates), JSON.stringify(CANONICAL_PASS_ORDER), 'PASS_STATUS_ORDER');

  for (const name of ['Defect', 'Evidence', 'Candidate', 'ClaimLease']) {
    validateMachine(name, model.stateMachines[name]);
  }

  const defectTransitions = transitionSet(model.stateMachines.Defect);
  for (const required of [
    'DISCOVERED=>REPRODUCED',
    'REPRODUCED=>ROOT_CAUSED',
    'ROOT_CAUSED=>PATCHED',
    'PATCHED=>TARGETED_PASS',
    'TARGETED_PASS=>SYSTEM_PASS',
    'SYSTEM_PASS=>ADVERSARIAL_PASS',
    'ADVERSARIAL_PASS=>CLOSED',
  ]) {
    ok(defectTransitions.has(required), 'DEFECT_REQUIRED_TRANSITION_MISSING', required);
  }

  const candidateTransitions = transitionSet(model.stateMachines.Candidate);
  ok(candidateTransitions.has('PROMOTION_ELIGIBLE=>CANONICAL_AUTHORITY'), 'CANDIDATE_PROMOTION_PATH_MISSING');
  for (const forbidden of [
    'OBSERVED=>CANONICAL_AUTHORITY',
    'TARGETED_PASS=>CANONICAL_AUTHORITY',
    'FULL_PASS=>CANONICAL_AUTHORITY',
    'CLEANROOM_PASS=>CANONICAL_AUTHORITY',
  ]) {
    ok(!candidateTransitions.has(forbidden), 'CANDIDATE_PROMOTION_SKIP', forbidden);
  }

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
    'CANDIDATE_CANNOT_SELF_ATTEST_GATES',
    'CANDIDATE_CANNOT_SELF_ATTEST_DEFECT_COUNTS',
    'PASS_STATUS_ORDER_CANONICAL',
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

  eq(JSON.stringify(model.candidateRequirements.allowedFields), JSON.stringify(['candidateSha']), 'CANDIDATE_ALLOWED_FIELDS');
  eq(model.promotionRequirements.requiredDefectCounts.openP0, 0, 'PROMOTION_P0');
  eq(model.promotionRequirements.requiredDefectCounts.openP1, 0, 'PROMOTION_P1');
  ok(model.promotionRequirements.requiredEvidenceKinds && typeof model.promotionRequirements.requiredEvidenceKinds === 'object', 'PROMOTION_EVIDENCE_KINDS');
  uniq(model.evidenceRequirements.allowedKinds, 'EVIDENCE_KIND_DUPLICATE');
  for (const requiredKind of ['DEFECT_INVENTORY', 'REQUIRED_CHECKS', 'SECURITY', 'CLEANROOM', 'AUTHORITY_CONSISTENCY']) {
    ok(Object.hasOwn(model.promotionRequirements.requiredEvidenceKinds, requiredKind), 'PROMOTION_REQUIRED_KIND_MISSING', requiredKind);
  }
  for (const [kind, requiredStatus] of Object.entries(model.promotionRequirements.requiredEvidenceKinds)) {
    ok(model.evidenceRequirements.allowedKinds.includes(kind), 'PROMOTION_KIND_UNKNOWN', kind);
    ok(model.passLikeEvidenceStates.includes(requiredStatus), 'PROMOTION_STATUS_NOT_PASSLIKE', `${kind}:${requiredStatus}`);
  }

  ok(model.uncertaintyStates.includes('UNKNOWN'), 'UNKNOWN_STATE_MISSING');
  ok(!model.passLikeEvidenceStates.includes('UNKNOWN'), 'UNKNOWN_MARKED_PASS');
}

function canTransition(model, machineName, from, to) {
  const machine = model.stateMachines[machineName];
  if (!machine) fail('MACHINE_MISSING', machineName);
  return transitionSet(machine).has(`${from}=>${to}`);
}

function evidenceRank(model, status) {
  return model.passLikeEvidenceStates.indexOf(status);
}

function validateEvidence(model, evidence, candidateSha) {
  ok(SHA40.test(candidateSha), 'CANDIDATE_SHA_INVALID', candidateSha);
  ok(evidence && typeof evidence === 'object', 'EVIDENCE_OBJECT');
  ok(typeof evidence.status === 'string', 'EVIDENCE_STATUS');
  ok(model.stateMachines.Evidence.states.includes(evidence.status), 'EVIDENCE_STATUS_UNKNOWN', evidence.status);
  ok(typeof evidence.kind === 'string' && model.evidenceRequirements.allowedKinds.includes(evidence.kind), 'EVIDENCE_KIND_UNKNOWN', evidence.kind ?? '');

  if (model.passLikeEvidenceStates.includes(evidence.status)) {
    ok(SHA40.test(evidence.candidateSha ?? ''), 'EVIDENCE_SHA_MISSING');
    eq(evidence.candidateSha, candidateSha, 'EVIDENCE_SHA_STALE');
    ok(typeof evidence.command === 'string' && evidence.command.trim().length > 0, 'EVIDENCE_COMMAND_MISSING');
    ok(Number.isInteger(evidence.exitCode), 'EVIDENCE_EXIT_CODE_MISSING');
    eq(evidence.exitCode, 0, 'EVIDENCE_EXIT_CODE_NONZERO');
  }

  if (evidence.kind === 'DEFECT_INVENTORY') {
    ok(evidence.details && typeof evidence.details === 'object', 'DEFECT_INVENTORY_DETAILS');
    for (const key of ['openP0', 'openP1']) {
      ok(Number.isSafeInteger(evidence.details[key]) && evidence.details[key] >= 0, 'DEFECT_COUNT_INVALID', key);
    }
  }

  ok(!model.evidenceRequirements.terminalNonQualifyingStates.includes(evidence.status), 'EVIDENCE_NON_QUALIFYING_STATE', evidence.status);
  ok(!model.evidenceRequirements.writtenOnlyStates.includes(evidence.status), 'EVIDENCE_UNEXECUTED', evidence.status);
  return true;
}

function validateCandidate(model, candidate) {
  ok(candidate && typeof candidate === 'object' && !Array.isArray(candidate), 'PROMOTION_INPUT');
  ok(SHA40.test(candidate.candidateSha ?? ''), 'PROMOTION_CANDIDATE_SHA');
  const allowed = new Set(model.candidateRequirements.allowedFields);
  for (const field of Object.keys(candidate)) {
    ok(allowed.has(field), 'CANDIDATE_SELF_ATTESTATION_FORBIDDEN', field);
  }
}

function evaluatePromotion(model, candidate, evidence = []) {
  validateCandidate(model, candidate);
  ok(evidence.length > 0, 'PROMOTION_EVIDENCE_EMPTY');
  for (const packet of evidence) validateEvidence(model, packet, candidate.candidateSha);

  for (const [kind, requiredStatus] of Object.entries(model.promotionRequirements.requiredEvidenceKinds)) {
    const packets = evidence.filter(packet => packet.kind === kind);
    ok(packets.length > 0, 'PROMOTION_REQUIRED_EVIDENCE_MISSING', kind);
    const requiredRank = evidenceRank(model, requiredStatus);
    ok(requiredRank >= 0, 'PROMOTION_REQUIRED_STATUS_UNKNOWN', `${kind}:${requiredStatus}`);
    const strongest = Math.max(...packets.map(packet => evidenceRank(model, packet.status)));
    ok(strongest >= requiredRank, 'PROMOTION_EVIDENCE_TOO_WEAK', `${kind}: requires ${requiredStatus}`);
  }

  const defectPackets = evidence.filter(packet => packet.kind === 'DEFECT_INVENTORY');
  ok(defectPackets.length === 1, 'PROMOTION_DEFECT_INVENTORY_CARDINALITY', String(defectPackets.length));
  const defectInventory = defectPackets[0];
  eq(defectInventory.details.openP0, model.promotionRequirements.requiredDefectCounts.openP0, 'PROMOTION_BLOCKED_P0');
  eq(defectInventory.details.openP1, model.promotionRequirements.requiredDefectCounts.openP1, 'PROMOTION_BLOCKED_P1');

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
  const packet = (kind, status, candidateSha = shaA, exitCode = 0, details = undefined) => ({
    kind,
    status,
    candidateSha,
    command: `verify:${kind}`,
    exitCode,
    ...(details === undefined ? {} : { details }),
  });
  const defectPacket = (openP0 = 0, openP1 = 0) => packet('DEFECT_INVENTORY', 'SYSTEM_PASS', shaA, 0, { openP0, openP1 });
  const goodEvidence = [
    defectPacket(),
    packet('REQUIRED_CHECKS', 'SYSTEM_PASS'),
    packet('SECURITY', 'ADVERSARIAL_PASS'),
    packet('CLEANROOM', 'CLEANROOM_PASS'),
    packet('AUTHORITY_CONSISTENCY', 'SYSTEM_PASS'),
  ];
  const goodCandidate = { candidateSha: shaA };

  expectPass('baseline-model', () => validateModel(model));
  expectPass('legal-candidate-promotion-path', () => {
    ok(canTransition(model, 'Candidate', 'CLEANROOM_PASS', 'PROMOTION_ELIGIBLE'), 'LEGAL_PATH_MISSING');
    ok(canTransition(model, 'Candidate', 'PROMOTION_ELIGIBLE', 'CANONICAL_AUTHORITY'), 'LEGAL_AUTHORITY_PATH_MISSING');
  });
  expectReject('skip-targeted-to-authority', 'ILLEGAL_TRANSITION', () => {
    if (!canTransition(model, 'Candidate', 'TARGETED_PASS', 'CANONICAL_AUTHORITY')) fail('ILLEGAL_TRANSITION', 'TARGETED_PASS=>CANONICAL_AUTHORITY');
  });
  expectReject('missing-evidence-sha', 'EVIDENCE_SHA_MISSING', () => validateEvidence(model, { ...packet('CLEANROOM', 'CLEANROOM_PASS'), candidateSha: undefined }, shaA));
  expectReject('stale-evidence-sha', 'EVIDENCE_SHA_STALE', () => validateEvidence(model, packet('CLEANROOM', 'CLEANROOM_PASS', shaB), shaA));
  expectReject('unexecuted-evidence', 'EVIDENCE_UNEXECUTED', () => validateEvidence(model, { kind: 'OTHER', status: 'WRITTEN_UNEXECUTED' }, shaA));
  expectReject('invalidated-evidence', 'EVIDENCE_NON_QUALIFYING_STATE', () => validateEvidence(model, { kind: 'OTHER', status: 'INVALIDATED' }, shaA));
  expectReject('unknown-evidence-kind', 'EVIDENCE_KIND_UNKNOWN', () => validateEvidence(model, packet('MAGIC_PASS', 'CLEANROOM_PASS'), shaA));
  expectReject('nonzero-pass-evidence', 'EVIDENCE_EXIT_CODE_NONZERO', () => validateEvidence(model, packet('CLEANROOM', 'CLEANROOM_PASS', shaA, 1), shaA));
  expectReject('defect-inventory-missing-details', 'DEFECT_INVENTORY_DETAILS', () => validateEvidence(model, packet('DEFECT_INVENTORY', 'SYSTEM_PASS'), shaA));
  expectPass('promotion-happy-path', () => evaluatePromotion(model, goodCandidate, goodEvidence));
  expectReject('candidate-security-self-attestation-forbidden', 'CANDIDATE_SELF_ATTESTATION_FORBIDDEN', () => evaluatePromotion(model, { ...goodCandidate, security: 'PASS' }, goodEvidence));
  expectReject('candidate-p0-self-attestation-forbidden', 'CANDIDATE_SELF_ATTESTATION_FORBIDDEN', () => evaluatePromotion(model, { ...goodCandidate, openP0: 0 }, goodEvidence));
  expectReject('missing-security-evidence', 'PROMOTION_REQUIRED_EVIDENCE_MISSING', () => evaluatePromotion(model, goodCandidate, goodEvidence.filter(item => item.kind !== 'SECURITY')));
  expectReject('weak-security-evidence', 'PROMOTION_EVIDENCE_TOO_WEAK', () => evaluatePromotion(model, goodCandidate, goodEvidence.map(item => item.kind === 'SECURITY' ? packet('SECURITY', 'TARGETED_PASS') : item)));
  expectReject('targeted-cleanroom-cannot-promote', 'PROMOTION_EVIDENCE_TOO_WEAK', () => evaluatePromotion(model, goodCandidate, goodEvidence.map(item => item.kind === 'CLEANROOM' ? packet('CLEANROOM', 'TARGETED_PASS') : item)));
  expectReject('open-p0-from-evidence-blocks-promotion', 'PROMOTION_BLOCKED_P0', () => evaluatePromotion(model, goodCandidate, [defectPacket(1, 0), ...goodEvidence.filter(item => item.kind !== 'DEFECT_INVENTORY')]));
  expectReject('open-p1-from-evidence-blocks-promotion', 'PROMOTION_BLOCKED_P1', () => evaluatePromotion(model, goodCandidate, [defectPacket(0, 1), ...goodEvidence.filter(item => item.kind !== 'DEFECT_INVENTORY')]));
  expectReject('duplicate-defect-inventory-rejected', 'PROMOTION_DEFECT_INVENTORY_CARDINALITY', () => evaluatePromotion(model, goodCandidate, [defectPacket(), ...goodEvidence]));
  expectReject('projection-cannot-assign-authority', 'PROJECTION_AUTHORITY_ESCALATION', () => validateProjectionAuthority({ id: 'projection:test', authority: 'CANONICAL_AUTHORITY' }));

  const mutated = structuredClone(model);
  mutated.checkpoints[7].id = 'CP8';
  expectReject('checkpoint-gap-detected', 'CHECKPOINT_DUPLICATE_ID', () => validateModel(mutated));

  const missingDefectStep = structuredClone(model);
  missingDefectStep.stateMachines.Defect.transitions = missingDefectStep.stateMachines.Defect.transitions
    .filter(([from, to]) => !(from === 'ROOT_CAUSED' && to === 'PATCHED'));
  expectReject('model-rejects-missing-defect-transition', 'DEFECT_REQUIRED_TRANSITION_MISSING', () => validateModel(missingDefectStep));

  const skip = structuredClone(model);
  skip.stateMachines.Candidate.transitions.push(['OBSERVED', 'CANONICAL_AUTHORITY']);
  expectReject('model-rejects-authority-skip', 'CANDIDATE_PROMOTION_SKIP', () => validateModel(skip));

  const unknownPass = structuredClone(model);
  unknownPass.passLikeEvidenceStates.push('UNKNOWN');
  expectReject('model-rejects-unknown-as-pass', 'PASS_STATUS_ORDER', () => validateModel(unknownPass));

  const reorderedPass = structuredClone(model);
  [reorderedPass.passLikeEvidenceStates[0], reorderedPass.passLikeEvidenceStates[4]] = [reorderedPass.passLikeEvidenceStates[4], reorderedPass.passLikeEvidenceStates[0]];
  expectReject('model-rejects-pass-order-mutation', 'PASS_STATUS_ORDER', () => validateModel(reorderedPass));

  const missingKind = structuredClone(model);
  delete missingKind.promotionRequirements.requiredEvidenceKinds.SECURITY;
  expectReject('model-rejects-missing-security-gate-contract', 'PROMOTION_REQUIRED_KIND_MISSING', () => validateModel(missingKind));

  const candidateFields = structuredClone(model);
  candidateFields.candidateRequirements.allowedFields.push('security');
  expectReject('model-rejects-candidate-gate-field', 'CANDIDATE_ALLOWED_FIELDS', () => validateModel(candidateFields));

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
