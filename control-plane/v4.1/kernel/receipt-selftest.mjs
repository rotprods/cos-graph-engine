import {
  GateError,
  errorCode,
  sealReceipt,
  sha256,
} from './receipt-canonical.mjs';
import {
  buildReceiptIndex,
  qualifyingEvidence,
  validateModel,
  verifyEventChain,
  verifyReceipt,
} from './receipt-verify.mjs';

const eq = (actual, expected, code, detail = '') => {
  if (actual !== expected) {
    throw new GateError(code, `${detail} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  }
};

function selfTests(model) {
  const scenarios = [];
  const expectReject = (name, code, fn) => {
    try {
      fn();
      scenarios.push({ name, expected: code, observed: null, passed: false });
    } catch (error) {
      const observed = errorCode(error);
      scenarios.push({ name, expected: code, observed, passed: observed === code });
    }
  };
  const expectPass = (name, fn) => {
    try {
      fn();
      scenarios.push({ name, expected: 'PASS', observed: 'PASS', passed: true });
    } catch (error) {
      scenarios.push({ name, expected: 'PASS', observed: errorCode(error), passed: false });
    }
  };

  const shaA = 'a'.repeat(40);
  const t0 = '2026-09-01T10:00:00.000Z';
  const t1 = '2026-09-01T10:00:01.000Z';
  const t2 = '2026-09-01T10:00:02.000Z';

  const observation = sealReceipt({
    receiptId: 'obs-1', receiptType: 'OBSERVATION', status: 'OBSERVED', recordedAt: t1,
    observedAt: t0, subjectId: 'repo:x', source: { kind: 'git', locator: 'repo:x', revision: shaA },
    candidateSha: shaA, payload: { defaultBranch: 'main' },
  });
  const unknownObservation = sealReceipt({
    receiptId: 'obs-unknown', receiptType: 'OBSERVATION', status: 'UNKNOWN', recordedAt: t1,
    observedAt: t0, subjectId: 'ruleset:x', source: { kind: 'github', locator: 'ruleset:x' },
    payload: { reason: 'provider access unavailable' },
  });
  const evidence1 = sealReceipt({
    receiptId: 'ev-1', receiptType: 'EXECUTION_EVIDENCE', status: 'TARGETED_PASS', recordedAt: t2,
    candidateSha: shaA, evidenceKind: 'REQUIRED_CHECKS', command: 'node test.js', exitCode: 0,
    startedAt: t0, finishedAt: t1, artifactHashes: [sha256('artifact-1')], payload: { assertions: 12 },
  });
  const evidence2 = sealReceipt({
    receiptId: 'ev-2', receiptType: 'EXECUTION_EVIDENCE', status: 'SYSTEM_PASS', recordedAt: t2,
    candidateSha: shaA, evidenceKind: 'REQUIRED_CHECKS', command: 'node test-v2.js', exitCode: 0,
    startedAt: t0, finishedAt: t1, artifactHashes: [sha256('artifact-2')], payload: { assertions: 20 },
  });
  const supersession = sealReceipt({
    receiptId: 'sup-1', receiptType: 'SUPERSESSION', status: 'SUPERSEDED', recordedAt: '2026-09-01T10:00:03.000Z',
    supersedesReceiptId: evidence1.receiptId, supersedesReceiptHash: evidence1.receiptHash,
    replacementReceiptId: evidence2.receiptId, replacementReceiptHash: evidence2.receiptHash,
    reason: 'stronger exact-SHA system evidence', payload: { historicalReceiptPreserved: true },
  });

  expectPass('baseline-model', () => validateModel(model));
  expectPass('observation-roundtrip', () => verifyReceipt(model, observation));
  expectPass('explicit-unknown-observation', () => verifyReceipt(model, unknownObservation));
  expectPass('execution-evidence-roundtrip', () => verifyReceipt(model, evidence1));
  expectPass('valid-supersession-index', () => buildReceiptIndex(model, [evidence1, evidence2, supersession]));
  expectPass('superseded-evidence-no-longer-qualifies', () => {
    const active = qualifyingEvidence(model, [evidence1, evidence2, supersession], shaA);
    eq(active.length, 1, 'ACTIVE_EVIDENCE_COUNT');
    eq(active[0].receiptId, 'ev-2', 'ACTIVE_EVIDENCE_WRONG');
  });

  expectReject('presealed-input-rejected', 'RECEIPT_PRESEALED', () => sealReceipt({ ...observation }));
  expectReject('payload-tamper-rejected', 'PAYLOAD_HASH_MISMATCH', () => {
    const copy = structuredClone(evidence1); copy.payload.assertions = 999; verifyReceipt(model, copy);
  });
  expectReject('metadata-tamper-rejected', 'RECEIPT_HASH_MISMATCH', () => {
    const copy = structuredClone(evidence1); copy.command = 'other'; verifyReceipt(model, copy);
  });
  expectReject('hash-algorithm-mismatch', 'RECEIPT_HASH_ALGORITHM', () => {
    const copy = structuredClone(evidence1); copy.hashAlgorithm = 'fnv'; verifyReceipt(model, copy);
  });
  expectReject('pass-nonzero-exit-rejected', 'PASS_EXIT_CODE', () => {
    const bad = sealReceipt({ ...withoutSeal(evidence1), receiptId: 'ev-bad-exit', exitCode: 1 }); verifyReceipt(model, bad);
  });
  expectReject('failed-zero-exit-rejected', 'FAIL_EXIT_CODE', () => {
    const bad = sealReceipt({ ...withoutSeal(evidence1), receiptId: 'ev-fail-zero', status: 'EXECUTED_FAIL', exitCode: 0 }); verifyReceipt(model, bad);
  });
  expectReject('invalid-artifact-hash-rejected', 'EVIDENCE_ARTIFACT_HASH', () => {
    const bad = sealReceipt({ ...withoutSeal(evidence1), receiptId: 'ev-artifact', artifactHashes: ['abc'] }); verifyReceipt(model, bad);
  });
  expectReject('evidence-time-reversal-rejected', 'EVIDENCE_TIME_ORDER', () => {
    const bad = sealReceipt({ ...withoutSeal(evidence1), receiptId: 'ev-time', startedAt: t2, finishedAt: t0 }); verifyReceipt(model, bad);
  });
  expectReject('unknown-without-reason-rejected', 'UNKNOWN_REASON_REQUIRED', () => {
    const bad = sealReceipt({ ...withoutSeal(unknownObservation), receiptId: 'obs-no-reason', payload: {} }); verifyReceipt(model, bad);
  });
  expectReject('duplicate-receipt-id-rejected', 'DUPLICATE_RECEIPT_ID', () => buildReceiptIndex(model, [evidence1, { ...evidence2, receiptId: evidence1.receiptId }]));
  expectReject('supersession-old-hash-mismatch', 'SUPERSESSION_OLD_HASH_MISMATCH', () => {
    const badSup = sealReceipt({ ...withoutSeal(supersession), receiptId: 'sup-bad-old', supersedesReceiptHash: '0'.repeat(64) });
    buildReceiptIndex(model, [evidence1, evidence2, badSup]);
  });
  expectReject('supersession-unknown-target', 'SUPERSESSION_OLD_MISSING', () => {
    const badSup = sealReceipt({ ...withoutSeal(supersession), receiptId: 'sup-missing', supersedesReceiptId: 'missing' });
    buildReceiptIndex(model, [evidence1, evidence2, badSup]);
  });
  expectReject('supersession-cross-type-rejected', 'SUPERSESSION_TYPE_MISMATCH', () => {
    const obsReplacement = sealReceipt({ receiptId: 'obs-replacement', receiptType: 'OBSERVATION', status: 'OBSERVED', recordedAt: t2, observedAt: t1, subjectId: 'repo:x', source: { kind: 'git', locator: 'repo:x' }, payload: { ok: true } });
    const badSup = sealReceipt({ receiptId: 'sup-cross-type', receiptType: 'SUPERSESSION', status: 'SUPERSEDED', recordedAt: '2026-09-01T10:00:03.000Z', supersedesReceiptId: evidence1.receiptId, supersedesReceiptHash: evidence1.receiptHash, replacementReceiptId: obsReplacement.receiptId, replacementReceiptHash: obsReplacement.receiptHash, reason: 'invalid cross type' });
    buildReceiptIndex(model, [evidence1, obsReplacement, badSup]);
  });
  expectReject('supersession-observation-subject-swap-rejected', 'SUPERSESSION_SUBJECT_MISMATCH', () => {
    const oldObs = sealReceipt({ ...withoutSeal(observation), receiptId: 'obs-old', recordedAt: t1 });
    const newObs = sealReceipt({ ...withoutSeal(observation), receiptId: 'obs-new-subject', subjectId: 'repo:y', recordedAt: t2, observedAt: t1 });
    const badSup = sealReceipt({ receiptId: 'sup-subject-swap', receiptType: 'SUPERSESSION', status: 'SUPERSEDED', recordedAt: '2026-09-01T10:00:03.000Z', supersedesReceiptId: oldObs.receiptId, supersedesReceiptHash: oldObs.receiptHash, replacementReceiptId: newObs.receiptId, replacementReceiptHash: newObs.receiptHash, reason: 'invalid subject swap' });
    buildReceiptIndex(model, [oldObs, newObs, badSup]);
  });
  expectReject('event-cannot-be-superseded', 'SUPERSESSION_OLD_TYPE', () => {
    const oldEvent = sealReceipt({ receiptId: 'old-event-for-sup', receiptType: 'EVENT', status: 'RECORDED', recordedAt: t0, sequence: 1, previousEventHash: null, eventType: 'OLD', idempotencyKey: 'old-event-idem', payload: { x: 1 } });
    const newEvent = sealReceipt({ receiptId: 'new-event-for-sup', receiptType: 'EVENT', status: 'RECORDED', recordedAt: t1, sequence: 2, previousEventHash: oldEvent.receiptHash, eventType: 'NEW', idempotencyKey: 'new-event-idem', payload: { x: 2 } });
    const badSup = sealReceipt({ receiptId: 'sup-event', receiptType: 'SUPERSESSION', status: 'SUPERSEDED', recordedAt: t2, supersedesReceiptId: oldEvent.receiptId, supersedesReceiptHash: oldEvent.receiptHash, replacementReceiptId: newEvent.receiptId, replacementReceiptHash: newEvent.receiptHash, reason: 'events are append-only' });
    buildReceiptIndex(model, [oldEvent, newEvent, badSup]);
  });
  expectReject('supersession-cross-candidate-rejected', 'SUPERSESSION_CANDIDATE_MISMATCH', () => {
    const other = sealReceipt({ ...withoutSeal(evidence2), receiptId: 'ev-other-candidate', candidateSha: 'b'.repeat(40) });
    const badSup = sealReceipt({ receiptId: 'sup-cross-candidate', receiptType: 'SUPERSESSION', status: 'SUPERSEDED', recordedAt: '2026-09-01T10:00:03.000Z', supersedesReceiptId: evidence1.receiptId, supersedesReceiptHash: evidence1.receiptHash, replacementReceiptId: other.receiptId, replacementReceiptHash: other.receiptHash, reason: 'invalid candidate swap' });
    buildReceiptIndex(model, [evidence1, other, badSup]);
  });
  expectReject('supersession-evidence-kind-swap-rejected', 'SUPERSESSION_EVIDENCE_KIND_MISMATCH', () => {
    const other = sealReceipt({ ...withoutSeal(evidence2), receiptId: 'ev-other-kind', evidenceKind: 'SECURITY' });
    const badSup = sealReceipt({ receiptId: 'sup-kind-swap', receiptType: 'SUPERSESSION', status: 'SUPERSEDED', recordedAt: '2026-09-01T10:00:03.000Z', supersedesReceiptId: evidence1.receiptId, supersedesReceiptHash: evidence1.receiptHash, replacementReceiptId: other.receiptId, replacementReceiptHash: other.receiptHash, reason: 'invalid evidence-kind swap' });
    buildReceiptIndex(model, [evidence1, other, badSup]);
  });
  expectReject('supersession-replacement-before-old-rejected', 'SUPERSESSION_REPLACEMENT_BEFORE_OLD', () => {
    const lateOld = sealReceipt({ ...withoutSeal(evidence1), receiptId: 'ev-late-old', recordedAt: t2, finishedAt: t1 });
    const earlyReplacement = sealReceipt({ ...withoutSeal(evidence2), receiptId: 'ev-early-replacement', recordedAt: t1, finishedAt: t1 });
    const badSup = sealReceipt({ receiptId: 'sup-time-reversal', receiptType: 'SUPERSESSION', status: 'SUPERSEDED', recordedAt: '2026-09-01T10:00:03.000Z', supersedesReceiptId: lateOld.receiptId, supersedesReceiptHash: lateOld.receiptHash, replacementReceiptId: earlyReplacement.receiptId, replacementReceiptHash: earlyReplacement.receiptHash, reason: 'invalid time reversal' });
    buildReceiptIndex(model, [lateOld, earlyReplacement, badSup]);
  });
  expectReject('duplicate-supersession-old-rejected', 'SUPERSESSION_DUPLICATE_OLD', () => {
    const ev3 = sealReceipt({ ...withoutSeal(evidence2), receiptId: 'ev-3', payload: { assertions: 30 } });
    const sup2 = sealReceipt({ ...withoutSeal(supersession), receiptId: 'sup-2', replacementReceiptId: ev3.receiptId, replacementReceiptHash: ev3.receiptHash });
    buildReceiptIndex(model, [evidence1, evidence2, ev3, supersession, sup2]);
  });
  expectReject('supersession-cycle-rejected', 'SUPERSESSION_CYCLE', () => {
    const evA = sealReceipt({ ...withoutSeal(evidence1), receiptId: 'cycle-a' });
    const evB = sealReceipt({ ...withoutSeal(evidence2), receiptId: 'cycle-b' });
    const supA = sealReceipt({ receiptId: 'cycle-sup-a', receiptType: 'SUPERSESSION', status: 'SUPERSEDED', recordedAt: '2026-09-01T10:00:04.000Z', supersedesReceiptId: evA.receiptId, supersedesReceiptHash: evA.receiptHash, replacementReceiptId: evB.receiptId, replacementReceiptHash: evB.receiptHash, reason: 'a to b' });
    const supB = sealReceipt({ receiptId: 'cycle-sup-b', receiptType: 'SUPERSESSION', status: 'SUPERSEDED', recordedAt: '2026-09-01T10:00:04.000Z', supersedesReceiptId: evB.receiptId, supersedesReceiptHash: evB.receiptHash, replacementReceiptId: evA.receiptId, replacementReceiptHash: evA.receiptHash, reason: 'b to a' });
    buildReceiptIndex(model, [evA, evB, supA, supB]);
  });

  const event1 = sealReceipt({ receiptId: 'event-1', receiptType: 'EVENT', status: 'RECORDED', recordedAt: t0, sequence: 1, previousEventHash: null, eventType: 'START', idempotencyKey: 'idem-1', payload: { x: 1 } });
  const event2 = sealReceipt({ receiptId: 'event-2', receiptType: 'EVENT', status: 'RECORDED', recordedAt: t1, sequence: 2, previousEventHash: event1.receiptHash, eventType: 'OBSERVE', idempotencyKey: 'idem-2', payload: { x: 2 } });
  const event3 = sealReceipt({ receiptId: 'event-3', receiptType: 'EVENT', status: 'RECORDED', recordedAt: t2, sequence: 3, previousEventHash: event2.receiptHash, eventType: 'PASS', idempotencyKey: 'idem-3', payload: { x: 3 } });
  expectPass('event-chain-valid', () => verifyEventChain(model, [event1, event2, event3]));
  expectPass('anchored-event-segment-valid', () => {
    const anchorHash = sha256('prior-segment-tip');
    const seg1 = sealReceipt({ receiptId: 'event-12', receiptType: 'EVENT', status: 'RECORDED', recordedAt: t1, sequence: 12, previousEventHash: anchorHash, eventType: 'RESUME', idempotencyKey: 'idem-12', payload: { x: 12 } });
    const seg2 = sealReceipt({ receiptId: 'event-13', receiptType: 'EVENT', status: 'RECORDED', recordedAt: t2, sequence: 13, previousEventHash: seg1.receiptHash, eventType: 'CONTINUE', idempotencyKey: 'idem-13', payload: { x: 13 } });
    verifyEventChain(model, [seg1, seg2], { anchorHash, startSequence: 12 });
  });
  expectReject('invalid-event-anchor-hash-rejected', 'EVENT_ANCHOR_HASH', () => verifyEventChain(model, [event1], { anchorHash: 'abc', startSequence: 1 }));
  expectReject('duplicate-event-receipt-id-rejected', 'EVENT_DUPLICATE_RECEIPT_ID', () => {
    const duplicateId = sealReceipt({ receiptId: event1.receiptId, receiptType: 'EVENT', status: 'RECORDED', recordedAt: t1, sequence: 2, previousEventHash: event1.receiptHash, eventType: 'DUP', idempotencyKey: 'idem-dup-id', payload: { x: 2 } });
    verifyEventChain(model, [event1, duplicateId]);
  });
  expectReject('event-chain-reorder-rejected', 'EVENT_SEQUENCE_GAP', () => verifyEventChain(model, [event2, event1, event3]));
  expectReject('event-recorded-time-reversal-rejected', 'EVENT_RECORDED_TIME_ORDER', () => {
    const late = sealReceipt({ receiptId: 'event-late', receiptType: 'EVENT', status: 'RECORDED', recordedAt: t2, sequence: 1, previousEventHash: null, eventType: 'LATE', idempotencyKey: 'idem-late', payload: { x: 1 } });
    const early = sealReceipt({ receiptId: 'event-early', receiptType: 'EVENT', status: 'RECORDED', recordedAt: t1, sequence: 2, previousEventHash: late.receiptHash, eventType: 'EARLY', idempotencyKey: 'idem-early', payload: { x: 2 } });
    verifyEventChain(model, [late, early]);
  });
  expectReject('event-chain-link-tamper-rejected', 'EVENT_CHAIN_PREVIOUS_HASH', () => {
    const bad = sealReceipt({ ...withoutSeal(event3), receiptId: 'event-3b', previousEventHash: event1.receiptHash });
    verifyEventChain(model, [event1, event2, bad]);
  });
  expectReject('event-idempotency-duplicate-rejected', 'EVENT_DUPLICATE_IDEMPOTENCY', () => {
    const bad = sealReceipt({ ...withoutSeal(event3), receiptId: 'event-3c', idempotencyKey: 'idem-2', previousEventHash: event2.receiptHash });
    verifyEventChain(model, [event1, event2, bad]);
  });

  expectReject('canonical-nonfinite-rejected', 'CANONICAL_NONFINITE', () => sha256({ x: Infinity }));
  expectReject('canonical-sparse-array-rejected', 'CANONICAL_SPARSE_ARRAY', () => { const x = []; x[1] = 2; sha256(x); });
  expectReject('canonical-key-collision-rejected', 'CANONICAL_KEY_COLLISION', () => sha256({ '\u00e9': 1, 'e\u0301': 2 }));
  expectReject('canonical-cycle-rejected', 'CANONICAL_CYCLE', () => { const x = {}; x.self = x; sha256(x); });

  const failed = scenarios.filter(item => !item.passed);
  return { passed: failed.length === 0, total: scenarios.length, failed: failed.length, scenarios };
}

function withoutSeal(receipt) {
  const copy = structuredClone(receipt);
  delete copy.receiptHash;
  delete copy.payloadHash;
  delete copy.hashAlgorithm;
  return copy;
}


export { selfTests };
