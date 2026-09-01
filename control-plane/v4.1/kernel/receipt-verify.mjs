import { SHA40, SHA64, eq, fail, ok, sha256, timestamp, uniq } from './receipt-canonical.mjs';

function validateModel(model) {
  eq(model.schemaVersion, 1, 'MODEL_SCHEMA');
  eq(model.contractId, 'cos_repo_assurance_v4_1_receipt_kernel', 'MODEL_ID');
  ok(SHA40.test(model.sourceParentSha), 'MODEL_PARENT_SHA');
  eq(model.hashAlgorithm, 'sha256', 'MODEL_HASH_ALGORITHM');
  for (const type of ['OBSERVATION', 'EXECUTION_EVIDENCE', 'SUPERSESSION', 'EVENT']) {
    ok(model.receiptTypes[type], 'MODEL_RECEIPT_TYPE_MISSING', type);
    uniq(model.receiptTypes[type].statuses, 'MODEL_STATUS_DUPLICATE');
  }
  uniq(model.evidenceKinds, 'MODEL_EVIDENCE_KIND_DUPLICATE');
  uniq(model.passLikeEvidenceStates, 'MODEL_PASS_STATUS_DUPLICATE');
  for (const status of model.passLikeEvidenceStates) {
    ok(model.receiptTypes.EXECUTION_EVIDENCE.statuses.includes(status), 'MODEL_PASS_STATUS_UNKNOWN', status);
  }
  for (const invariant of [
    'RECEIPT_HASH_SHA256_CANONICAL',
    'PAYLOAD_HASH_SHA256_CANONICAL',
    'SUPERSESSION_PRESERVES_OLD_RECEIPT',
    'SUPERSESSION_TYPE_STABLE',
    'SUPERSESSION_SEMANTIC_IDENTITY_STABLE',
    'EVENT_PREVIOUS_HASH_CHAINED',
    'EVENT_SEGMENT_ANCHOR_EXPLICIT',
    'EVENT_RECORDED_TIME_MONOTONIC',
    'HISTORY_SUPERSEDED_NOT_REWRITTEN',
  ]) {
    ok(model.hardInvariants.includes(invariant), 'MODEL_INVARIANT_MISSING', invariant);
  }
}

function verifyReceipt(model, receipt) {
  ok(receipt && typeof receipt === 'object' && !Array.isArray(receipt), 'RECEIPT_OBJECT');
  ok(typeof receipt.receiptId === 'string' && receipt.receiptId.length > 0, 'RECEIPT_ID');
  ok(model.receiptTypes[receipt.receiptType], 'RECEIPT_TYPE', String(receipt.receiptType));
  ok(model.receiptTypes[receipt.receiptType].statuses.includes(receipt.status), 'RECEIPT_STATUS', `${receipt.receiptType}:${receipt.status}`);
  eq(receipt.hashAlgorithm, 'sha256', 'RECEIPT_HASH_ALGORITHM');
  ok(SHA64.test(receipt.receiptHash ?? ''), 'RECEIPT_HASH_FORMAT');
  timestamp(receipt.recordedAt, 'recordedAt');

  if (Object.hasOwn(receipt, 'payload')) {
    ok(SHA64.test(receipt.payloadHash ?? ''), 'PAYLOAD_HASH_FORMAT');
    eq(sha256(receipt.payload), receipt.payloadHash, 'PAYLOAD_HASH_MISMATCH');
  } else {
    ok(!Object.hasOwn(receipt, 'payloadHash'), 'PAYLOAD_HASH_WITHOUT_PAYLOAD');
  }

  const copy = structuredClone(receipt);
  delete copy.receiptHash;
  eq(sha256(copy), receipt.receiptHash, 'RECEIPT_HASH_MISMATCH');

  switch (receipt.receiptType) {
    case 'OBSERVATION':
      validateObservation(receipt);
      break;
    case 'EXECUTION_EVIDENCE':
      validateExecutionEvidence(model, receipt);
      break;
    case 'SUPERSESSION':
      validateSupersession(receipt);
      break;
    case 'EVENT':
      validateEvent(receipt);
      break;
    default:
      fail('RECEIPT_TYPE', String(receipt.receiptType));
  }
  return true;
}

function validateObservation(receipt) {
  ok(typeof receipt.subjectId === 'string' && receipt.subjectId.length > 0, 'OBSERVATION_SUBJECT');
  ok(receipt.source && typeof receipt.source === 'object', 'OBSERVATION_SOURCE');
  ok(typeof receipt.source.kind === 'string' && receipt.source.kind.length > 0, 'OBSERVATION_SOURCE_KIND');
  ok(typeof receipt.source.locator === 'string' && receipt.source.locator.length > 0, 'OBSERVATION_SOURCE_LOCATOR');
  const observedAt = timestamp(receipt.observedAt, 'observedAt');
  const recordedAt = timestamp(receipt.recordedAt, 'recordedAt');
  ok(observedAt <= recordedAt, 'OBSERVATION_TIME_ORDER');
  if (receipt.candidateSha !== undefined) ok(SHA40.test(receipt.candidateSha), 'OBSERVATION_CANDIDATE_SHA');
  if (receipt.status === 'UNKNOWN') {
    ok(receipt.payload && typeof receipt.payload.reason === 'string' && receipt.payload.reason.length > 0, 'UNKNOWN_REASON_REQUIRED');
  }
}

function validateExecutionEvidence(model, receipt) {
  ok(SHA40.test(receipt.candidateSha ?? ''), 'EVIDENCE_CANDIDATE_SHA');
  ok(model.evidenceKinds.includes(receipt.evidenceKind), 'EVIDENCE_KIND', String(receipt.evidenceKind));
  ok(typeof receipt.command === 'string' && receipt.command.trim().length > 0, 'EVIDENCE_COMMAND');
  ok(Number.isInteger(receipt.exitCode), 'EVIDENCE_EXIT_CODE');
  const startedAt = timestamp(receipt.startedAt, 'startedAt');
  const finishedAt = timestamp(receipt.finishedAt, 'finishedAt');
  const recordedAt = timestamp(receipt.recordedAt, 'recordedAt');
  ok(startedAt <= finishedAt && finishedAt <= recordedAt, 'EVIDENCE_TIME_ORDER');
  ok(Array.isArray(receipt.artifactHashes), 'EVIDENCE_ARTIFACT_HASHES');
  for (const digest of receipt.artifactHashes) ok(SHA64.test(digest), 'EVIDENCE_ARTIFACT_HASH', digest);
  if (model.passLikeEvidenceStates.includes(receipt.status)) {
    eq(receipt.exitCode, 0, 'PASS_EXIT_CODE');
  }
  if (receipt.status === 'EXECUTED_FAIL') {
    ok(receipt.exitCode !== 0, 'FAIL_EXIT_CODE');
  }
}

function validateSupersession(receipt) {
  for (const field of ['supersedesReceiptId', 'replacementReceiptId', 'reason']) {
    ok(typeof receipt[field] === 'string' && receipt[field].length > 0, 'SUPERSESSION_FIELD', field);
  }
  ok(SHA64.test(receipt.supersedesReceiptHash ?? ''), 'SUPERSESSION_OLD_HASH');
  ok(SHA64.test(receipt.replacementReceiptHash ?? ''), 'SUPERSESSION_NEW_HASH');
  ok(receipt.supersedesReceiptId !== receipt.replacementReceiptId, 'SUPERSESSION_SELF');
}

function validateEvent(receipt) {
  ok(Number.isSafeInteger(receipt.sequence) && receipt.sequence >= 1, 'EVENT_SEQUENCE');
  ok(typeof receipt.eventType === 'string' && receipt.eventType.length > 0, 'EVENT_TYPE');
  ok(typeof receipt.idempotencyKey === 'string' && receipt.idempotencyKey.length > 0, 'EVENT_IDEMPOTENCY');
  ok(Object.hasOwn(receipt, 'payload') && receipt.payload && typeof receipt.payload === 'object', 'EVENT_PAYLOAD');
  if (receipt.previousEventHash !== null) ok(SHA64.test(receipt.previousEventHash ?? ''), 'EVENT_PREVIOUS_HASH_FORMAT');
  if (receipt.candidateSha !== undefined) ok(SHA40.test(receipt.candidateSha), 'EVENT_CANDIDATE_SHA');
}

function buildReceiptIndex(model, receipts) {
  ok(Array.isArray(receipts), 'RECEIPT_SET');
  uniq(receipts.map(receipt => receipt.receiptId), 'DUPLICATE_RECEIPT_ID');
  uniq(receipts.map(receipt => receipt.receiptHash), 'DUPLICATE_RECEIPT_HASH');
  const byId = new Map();
  for (const receipt of receipts) {
    verifyReceipt(model, receipt);
    byId.set(receipt.receiptId, receipt);
  }

  const supersedes = new Map();
  for (const receipt of receipts.filter(item => item.receiptType === 'SUPERSESSION')) {
    const oldReceipt = byId.get(receipt.supersedesReceiptId);
    const replacement = byId.get(receipt.replacementReceiptId);
    ok(oldReceipt, 'SUPERSESSION_OLD_MISSING', receipt.supersedesReceiptId);
    ok(replacement, 'SUPERSESSION_REPLACEMENT_MISSING', receipt.replacementReceiptId);
    eq(oldReceipt.receiptHash, receipt.supersedesReceiptHash, 'SUPERSESSION_OLD_HASH_MISMATCH');
    eq(replacement.receiptHash, receipt.replacementReceiptHash, 'SUPERSESSION_NEW_HASH_MISMATCH');
    ok(!['SUPERSESSION', 'EVENT'].includes(oldReceipt.receiptType), 'SUPERSESSION_OLD_TYPE', oldReceipt.receiptType);
    ok(!['SUPERSESSION', 'EVENT'].includes(replacement.receiptType), 'SUPERSESSION_REPLACEMENT_TYPE', replacement.receiptType);
    eq(replacement.receiptType, oldReceipt.receiptType, 'SUPERSESSION_TYPE_MISMATCH');
    if (oldReceipt.receiptType === 'EXECUTION_EVIDENCE') {
      eq(replacement.candidateSha, oldReceipt.candidateSha, 'SUPERSESSION_CANDIDATE_MISMATCH');
      eq(replacement.evidenceKind, oldReceipt.evidenceKind, 'SUPERSESSION_EVIDENCE_KIND_MISMATCH');
    }
    if (oldReceipt.receiptType === 'OBSERVATION') {
      eq(replacement.subjectId, oldReceipt.subjectId, 'SUPERSESSION_SUBJECT_MISMATCH');
    }
    ok(!supersedes.has(oldReceipt.receiptId), 'SUPERSESSION_DUPLICATE_OLD', oldReceipt.receiptId);
    const oldAt = timestamp(oldReceipt.recordedAt, 'old.recordedAt');
    const replacementAt = timestamp(replacement.recordedAt, 'replacement.recordedAt');
    const supersessionAt = timestamp(receipt.recordedAt, 'supersession.recordedAt');
    ok(oldAt <= replacementAt, 'SUPERSESSION_REPLACEMENT_BEFORE_OLD');
    ok(replacementAt <= supersessionAt, 'SUPERSESSION_REPLACEMENT_TIME');
    supersedes.set(oldReceipt.receiptId, replacement.receiptId);
  }

  for (const start of supersedes.keys()) {
    const visited = new Set();
    let current = start;
    while (supersedes.has(current)) {
      if (visited.has(current)) fail('SUPERSESSION_CYCLE', current);
      visited.add(current);
      current = supersedes.get(current);
    }
  }

  const isActive = receiptId => !supersedes.has(receiptId);
  return { byId, supersedes, isActive };
}

function verifyEventChain(model, events, { anchorHash = null, startSequence = 1 } = {}) {
  ok(Array.isArray(events) && events.length > 0, 'EVENT_CHAIN_EMPTY');
  ok(Number.isSafeInteger(startSequence) && startSequence >= 1, 'EVENT_START_SEQUENCE');
  if (anchorHash !== null) ok(SHA64.test(anchorHash), 'EVENT_ANCHOR_HASH');
  uniq(events.map(event => event.receiptId), 'EVENT_DUPLICATE_RECEIPT_ID');
  uniq(events.map(event => event.receiptHash), 'EVENT_DUPLICATE_RECEIPT_HASH');
  uniq(events.map(event => event.idempotencyKey), 'EVENT_DUPLICATE_IDEMPOTENCY');
  let previous = anchorHash;
  let previousRecordedAt = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    verifyReceipt(model, event);
    eq(event.receiptType, 'EVENT', 'EVENT_CHAIN_NON_EVENT');
    eq(event.sequence, startSequence + index, 'EVENT_SEQUENCE_GAP');
    eq(event.previousEventHash, previous, 'EVENT_CHAIN_PREVIOUS_HASH');
    const recordedAt = timestamp(event.recordedAt, 'event.recordedAt');
    if (previousRecordedAt !== null) ok(previousRecordedAt <= recordedAt, 'EVENT_RECORDED_TIME_ORDER');
    previousRecordedAt = recordedAt;
    previous = event.receiptHash;
  }
  return { tipHash: previous, length: events.length, startSequence };
}

function qualifyingEvidence(model, receipts, candidateSha) {
  const index = buildReceiptIndex(model, receipts);
  return receipts.filter(receipt =>
    receipt.receiptType === 'EXECUTION_EVIDENCE'
    && receipt.candidateSha === candidateSha
    && model.passLikeEvidenceStates.includes(receipt.status)
    && index.isActive(receipt.receiptId));
}


export { buildReceiptIndex, qualifyingEvidence, validateModel, verifyEventChain, verifyReceipt };
