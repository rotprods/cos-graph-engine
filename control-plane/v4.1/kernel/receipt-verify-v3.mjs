import {
  CURRENT_AUTHORITY_CEILING,
  CURRENT_TRUST_CLASS,
  SHA40,
  SHA64,
  canonicalIdentity,
  eq,
  fail,
  ok,
  receiptAuthorityCeiling,
  sha256,
  timestamp,
  uniq,
} from './receipt-canonical-v3.mjs';

const EXPECTED_SOURCE_PARENT = '175c738b0b14e9b82ef97201d3bcc318672b1e7b';
const CANONICAL_RECEIPT_STATUSES = {
  OBSERVATION:['OBSERVED','UNKNOWN','BLOCKED_WITH_EVIDENCE'],
  EXECUTION_EVIDENCE:['EXECUTED_FAIL','TARGETED_PASS','SYSTEM_PASS','PHYSICAL_PASS','ADVERSARIAL_PASS','CLEANROOM_PASS'],
  SUPERSESSION:['SUPERSEDED'],
  EVENT:['RECORDED'],
};
const CANONICAL_EVIDENCE_KINDS=['DEFECT_INVENTORY','REQUIRED_CHECKS','SECURITY','CLEANROOM','AUTHORITY_CONSISTENCY','RUNTIME','RECOVERY','MUTATION','OTHER'];
const CANONICAL_PASS_ORDER = ['TARGETED_PASS','SYSTEM_PASS','PHYSICAL_PASS','ADVERSARIAL_PASS','CLEANROOM_PASS'];
const CANONICAL_TRUST_CLASSES = ['INTEGRITY_ONLY'];
const CANONICAL_FORBIDDEN_AUTHORITY_FIELDS = [
  'authority','authorityClass','authorityCeiling','authenticated','signatureVerified','verifiedByIndependentKernel',
];

function validateModel(model) {
  eq(model.schemaVersion, 3, 'MODEL_SCHEMA');
  eq(model.contractId, 'cos_repo_assurance_v4_1_receipt_kernel', 'MODEL_ID');
  eq(model.version, '4.1.0-alpha.6', 'MODEL_VERSION');
  eq(model.sourceParentSha, EXPECTED_SOURCE_PARENT, 'MODEL_PARENT_SHA_EXACT');
  eq(model.authorityCeiling, CURRENT_AUTHORITY_CEILING, 'MODEL_AUTHORITY_CEILING');
  eq(model.hashAlgorithm, 'sha256', 'MODEL_HASH_ALGORITHM');
  eq(JSON.stringify(model.trustClasses), JSON.stringify(CANONICAL_TRUST_CLASSES), 'MODEL_TRUST_CLASSES');
  eq(JSON.stringify(model.passLikeEvidenceStates), JSON.stringify(CANONICAL_PASS_ORDER), 'MODEL_PASS_STATUS_ORDER');
  eq(JSON.stringify(model.forbiddenReceiptAuthorityFields), JSON.stringify(CANONICAL_FORBIDDEN_AUTHORITY_FIELDS), 'MODEL_FORBIDDEN_AUTHORITY_FIELDS');

  eq(JSON.stringify(model.receiptTypes), JSON.stringify(Object.fromEntries(Object.entries(CANONICAL_RECEIPT_STATUSES).map(([k,statuses])=>[k,{statuses}]))), 'MODEL_RECEIPT_STATUSES_EXACT');
  eq(JSON.stringify(model.evidenceKinds), JSON.stringify(CANONICAL_EVIDENCE_KINDS), 'MODEL_EVIDENCE_KINDS_EXACT');

  eq(model.canonicalization.unicode, 'NFC', 'MODEL_CANONICAL_UNICODE');
  eq(model.canonicalization.objectKeyOrder, 'NORMALIZE_THEN_LEXICOGRAPHIC', 'MODEL_CANONICAL_KEY_ORDER');
  eq(model.canonicalization.rootStrings, 'CANONICAL_JSON_NFC', 'MODEL_CANONICAL_ROOT_STRING');
  eq(model.canonicalization.rejectSymbolKeys, true, 'MODEL_REJECT_SYMBOL_KEYS');
  eq(model.canonicalization.rejectNonEnumerable, true, 'MODEL_REJECT_NONENUMERABLE');
  eq(model.identityStrings, 'NFC_CANONICAL_FORM', 'MODEL_IDENTITY_STRINGS');
  eq(model.eventSegments.genesisStartSequence, 1, 'MODEL_GENESIS_SEQUENCE');
  eq(model.eventSegments.genesisAnchor, 'NULL_ONLY', 'MODEL_GENESIS_ANCHOR');
  eq(model.eventSegments.continuationAnchor, 'SHA256_REQUIRED', 'MODEL_CONTINUATION_ANCHOR');

  const required = [
    'RECEIPT_HASH_SHA256_CANONICAL','PAYLOAD_HASH_SHA256_CANONICAL',
    'ROOT_STRING_NFC_HASH_EQUIVALENCE','OBJECT_KEYS_SORT_AFTER_NFC',
    'RECEIPT_TRUST_CLASS_EXPLICIT','INTEGRITY_ONLY_AUTHORITY_CEILING_SHADOW_ONLY',
    'RECEIPT_AUTHORITY_CLAIMS_FORBIDDEN','IDENTITY_STRINGS_NFC_CANONICAL','INTEGRITY_ONLY_NEVER_PROMOTION_AUTHORITY','EVENT_CONTINUATION_SEGMENT_REQUIRES_ANCHOR',
    'EVENT_GENESIS_SEGMENT_FORBIDS_ANCHOR','SUPERSESSION_GRAPH_ACYCLIC','SYMBOL_KEYS_REJECTED','NONENUMERABLE_FIELDS_REJECTED','SEAL_VALIDATES_INPUT_BEFORE_CLONE','SOURCE_PARENT_EXACT','RECEIPT_STATUS_VOCABULARY_EXACT','EVIDENCE_KIND_VOCABULARY_EXACT',
    'EVENT_PREVIOUS_HASH_CHAINED','EVENT_RECORDED_TIME_MONOTONIC','HISTORY_SUPERSEDED_NOT_REWRITTEN',
  ];
  for (const invariant of required) ok(model.hardInvariants.includes(invariant), 'MODEL_INVARIANT_MISSING', invariant);
}

function rejectAuthorityClaims(model, receipt) {
  for (const field of model.forbiddenReceiptAuthorityFields) {
    ok(!Object.hasOwn(receipt, field), 'RECEIPT_AUTHORITY_CLAIM_FORBIDDEN', field);
  }
}

function verifyReceipt(model, receipt) {
  ok(receipt && typeof receipt === 'object' && !Array.isArray(receipt), 'RECEIPT_OBJECT');
  rejectAuthorityClaims(model, receipt);
  eq(receipt.trustClass, CURRENT_TRUST_CLASS, 'RECEIPT_TRUST_CLASS');
  eq(receiptAuthorityCeiling(receipt), CURRENT_AUTHORITY_CEILING, 'RECEIPT_AUTHORITY_CEILING');
  canonicalIdentity(receipt.receiptId, 'receiptId');
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
    case 'OBSERVATION': validateObservation(receipt); break;
    case 'EXECUTION_EVIDENCE': validateExecutionEvidence(model, receipt); break;
    case 'SUPERSESSION': validateSupersession(receipt); break;
    case 'EVENT': validateEvent(receipt); break;
    default: fail('RECEIPT_TYPE', String(receipt.receiptType));
  }
  return true;
}

function validateObservation(receipt) {
  canonicalIdentity(receipt.subjectId, 'subjectId');
  ok(receipt.source && typeof receipt.source === 'object' && !Array.isArray(receipt.source), 'OBSERVATION_SOURCE');
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
  if (model.passLikeEvidenceStates.includes(receipt.status)) eq(receipt.exitCode, 0, 'PASS_EXIT_CODE');
  if (receipt.status === 'EXECUTED_FAIL') ok(receipt.exitCode !== 0, 'FAIL_EXIT_CODE');
}

function validateSupersession(receipt) {
  for (const field of ['supersedesReceiptId','replacementReceiptId']) canonicalIdentity(receipt[field], field);
  ok(typeof receipt.reason === 'string' && receipt.reason.length > 0, 'SUPERSESSION_FIELD', 'reason');
  ok(SHA64.test(receipt.supersedesReceiptHash ?? ''), 'SUPERSESSION_OLD_HASH');
  ok(SHA64.test(receipt.replacementReceiptHash ?? ''), 'SUPERSESSION_NEW_HASH');
  ok(receipt.supersedesReceiptId !== receipt.replacementReceiptId, 'SUPERSESSION_SELF');
}

function validateEvent(receipt) {
  ok(Number.isSafeInteger(receipt.sequence) && receipt.sequence >= 1, 'EVENT_SEQUENCE');
  ok(typeof receipt.eventType === 'string' && receipt.eventType.length > 0, 'EVENT_TYPE');
  canonicalIdentity(receipt.idempotencyKey, 'idempotencyKey');
  ok(Object.hasOwn(receipt, 'payload') && receipt.payload && typeof receipt.payload === 'object' && !Array.isArray(receipt.payload), 'EVENT_PAYLOAD');
  if (receipt.previousEventHash !== null) ok(SHA64.test(receipt.previousEventHash ?? ''), 'EVENT_PREVIOUS_HASH_FORMAT');
  if (receipt.candidateSha !== undefined) ok(SHA40.test(receipt.candidateSha), 'EVENT_CANDIDATE_SHA');
}

function buildReceiptIndex(model, receipts) {
  ok(Array.isArray(receipts), 'RECEIPT_SET');
  uniq(receipts.map(receipt => receipt.receiptId), 'DUPLICATE_RECEIPT_ID');
  uniq(receipts.map(receipt => receipt.receiptHash), 'DUPLICATE_RECEIPT_HASH');
  const byId = new Map();
  for (const receipt of receipts) { verifyReceipt(model, receipt); byId.set(receipt.receiptId, receipt); }

  const supersedes = new Map();
  for (const receipt of receipts.filter(item => item.receiptType === 'SUPERSESSION')) {
    const oldReceipt = byId.get(receipt.supersedesReceiptId);
    const replacement = byId.get(receipt.replacementReceiptId);
    ok(oldReceipt, 'SUPERSESSION_OLD_MISSING', receipt.supersedesReceiptId);
    ok(replacement, 'SUPERSESSION_REPLACEMENT_MISSING', receipt.replacementReceiptId);
    eq(oldReceipt.receiptHash, receipt.supersedesReceiptHash, 'SUPERSESSION_OLD_HASH_MISMATCH');
    eq(replacement.receiptHash, receipt.replacementReceiptHash, 'SUPERSESSION_NEW_HASH_MISMATCH');
    ok(!['SUPERSESSION','EVENT'].includes(oldReceipt.receiptType), 'SUPERSESSION_OLD_TYPE', oldReceipt.receiptType);
    ok(!['SUPERSESSION','EVENT'].includes(replacement.receiptType), 'SUPERSESSION_REPLACEMENT_TYPE', replacement.receiptType);
    eq(replacement.receiptType, oldReceipt.receiptType, 'SUPERSESSION_TYPE_MISMATCH');
    if (oldReceipt.receiptType === 'EXECUTION_EVIDENCE') {
      eq(replacement.candidateSha, oldReceipt.candidateSha, 'SUPERSESSION_CANDIDATE_MISMATCH');
      eq(replacement.evidenceKind, oldReceipt.evidenceKind, 'SUPERSESSION_EVIDENCE_KIND_MISMATCH');
    }
    if (oldReceipt.receiptType === 'OBSERVATION') eq(replacement.subjectId, oldReceipt.subjectId, 'SUPERSESSION_SUBJECT_MISMATCH');
    ok(!supersedes.has(oldReceipt.receiptId), 'SUPERSESSION_DUPLICATE_OLD', oldReceipt.receiptId);
    const oldAt = timestamp(oldReceipt.recordedAt, 'old.recordedAt');
    const replacementAt = timestamp(replacement.recordedAt, 'replacement.recordedAt');
    const supersessionAt = timestamp(receipt.recordedAt, 'supersession.recordedAt');
    ok(oldAt <= replacementAt, 'SUPERSESSION_REPLACEMENT_BEFORE_OLD');
    ok(replacementAt <= supersessionAt, 'SUPERSESSION_REPLACEMENT_TIME');
    supersedes.set(oldReceipt.receiptId, replacement.receiptId);
  }

  for (const start of supersedes.keys()) {
    const visited = new Set(); let current = start;
    while (supersedes.has(current)) {
      if (visited.has(current)) fail('SUPERSESSION_CYCLE', current);
      visited.add(current); current = supersedes.get(current);
    }
  }
  return { byId, supersedes, isActive: receiptId => !supersedes.has(receiptId) };
}

function verifyEventChain(model, events, { anchorHash = null, startSequence = 1 } = {}) {
  ok(Array.isArray(events) && events.length > 0, 'EVENT_CHAIN_EMPTY');
  ok(Number.isSafeInteger(startSequence) && startSequence >= 1, 'EVENT_START_SEQUENCE');
  if (startSequence === model.eventSegments.genesisStartSequence) {
    eq(anchorHash, null, 'EVENT_GENESIS_ANCHOR_FORBIDDEN');
  } else {
    ok(anchorHash !== null && SHA64.test(anchorHash), 'EVENT_CONTINUATION_ANCHOR_REQUIRED');
  }
  uniq(events.map(event => event.receiptId), 'EVENT_DUPLICATE_RECEIPT_ID');
  uniq(events.map(event => event.receiptHash), 'EVENT_DUPLICATE_RECEIPT_HASH');
  uniq(events.map(event => event.idempotencyKey), 'EVENT_DUPLICATE_IDEMPOTENCY');
  let previous = anchorHash; let previousRecordedAt = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    verifyReceipt(model, event);
    eq(event.receiptType, 'EVENT', 'EVENT_CHAIN_NON_EVENT');
    eq(event.sequence, startSequence + index, 'EVENT_SEQUENCE_GAP');
    eq(event.previousEventHash, previous, 'EVENT_CHAIN_PREVIOUS_HASH');
    const recordedAt = timestamp(event.recordedAt, 'event.recordedAt');
    if (previousRecordedAt !== null) ok(previousRecordedAt <= recordedAt, 'EVENT_RECORDED_TIME_ORDER');
    previousRecordedAt = recordedAt; previous = event.receiptHash;
  }
  return { tipHash: previous, length: events.length, startSequence, anchorHash };
}

function activeIntegrityEvidence(model, receipts, candidateSha) {
  const index = buildReceiptIndex(model, receipts);
  return receipts.filter(receipt =>
    receipt.receiptType === 'EXECUTION_EVIDENCE'
    && receipt.candidateSha === candidateSha
    && model.passLikeEvidenceStates.includes(receipt.status)
    && receipt.trustClass === CURRENT_TRUST_CLASS
    && receiptAuthorityCeiling(receipt) === CURRENT_AUTHORITY_CEILING
    && index.isActive(receipt.receiptId))
    .map(receipt => ({ receipt, authorityCeiling: CURRENT_AUTHORITY_CEILING }));
}

export { activeIntegrityEvidence, buildReceiptIndex, validateModel, verifyEventChain, verifyReceipt };
