import { GateError, errorCode, receiptAuthorityCeiling, sealReceipt, sha256 } from './receipt-canonical-v3.mjs';
import { activeIntegrityEvidence, buildReceiptIndex, validateModel, verifyEventChain, verifyReceipt } from './receipt-verify-v3.mjs';

const eq=(a,b,code,detail='')=>{if(a!==b) throw new GateError(code,`${detail} expected=${JSON.stringify(b)} actual=${JSON.stringify(a)}`)};
const ok=(v,code,detail='')=>{if(!v) throw new GateError(code,detail)};

function withoutSeal(receipt){const copy=structuredClone(receipt);delete copy.receiptHash;delete copy.payloadHash;delete copy.hashAlgorithm;delete copy.trustClass;return copy}

function selfTests(model){
  const scenarios=[];
  const reject=(name,code,fn)=>{try{fn();scenarios.push({name,expected:code,observed:null,passed:false})}catch(error){const observed=errorCode(error);scenarios.push({name,expected:code,observed,passed:observed===code})}};
  const pass=(name,fn)=>{try{fn();scenarios.push({name,expected:'PASS',observed:'PASS',passed:true})}catch(error){scenarios.push({name,expected:'PASS',observed:errorCode(error),passed:false})}};

  const A='a'.repeat(40), B='b'.repeat(40);
  const t0='2026-09-02T08:00:00.000Z',t1='2026-09-02T08:00:01.000Z',t2='2026-09-02T08:00:02.000Z',t3='2026-09-02T08:00:03.000Z';
  const observation=sealReceipt({receiptId:'obs-1',receiptType:'OBSERVATION',status:'OBSERVED',recordedAt:t1,observedAt:t0,subjectId:'repo:x',source:{kind:'git',locator:'repo:x',revision:A},candidateSha:A,payload:{defaultBranch:'main'}});
  const unknown=sealReceipt({receiptId:'obs-u',receiptType:'OBSERVATION',status:'UNKNOWN',recordedAt:t1,observedAt:t0,subjectId:'ruleset:x',source:{kind:'github',locator:'ruleset:x'},payload:{reason:'provider unavailable'}});
  const ev1=sealReceipt({receiptId:'ev-1',receiptType:'EXECUTION_EVIDENCE',status:'TARGETED_PASS',recordedAt:t2,candidateSha:A,evidenceKind:'REQUIRED_CHECKS',command:'node test.js',exitCode:0,startedAt:t0,finishedAt:t1,artifactHashes:[sha256('artifact-1')],payload:{assertions:12}});
  const ev2=sealReceipt({receiptId:'ev-2',receiptType:'EXECUTION_EVIDENCE',status:'SYSTEM_PASS',recordedAt:t2,candidateSha:A,evidenceKind:'REQUIRED_CHECKS',command:'node test-v2.js',exitCode:0,startedAt:t0,finishedAt:t1,artifactHashes:[sha256('artifact-2')],payload:{assertions:20}});
  const sup=sealReceipt({receiptId:'sup-1',receiptType:'SUPERSESSION',status:'SUPERSEDED',recordedAt:t3,supersedesReceiptId:ev1.receiptId,supersedesReceiptHash:ev1.receiptHash,replacementReceiptId:ev2.receiptId,replacementReceiptHash:ev2.receiptHash,reason:'stronger evidence',payload:{historicalReceiptPreserved:true}});

  pass('baseline-model',()=>validateModel(model));
  pass('root-string-nfc-equivalence',()=>eq(sha256('\u00e9'),sha256('e\u0301'),'ROOT_STRING_NFC'));
  pass('normalized-key-order-equivalence',()=>eq(sha256({'\u00e9':1,z:2}),sha256({'e\u0301':1,z:2}),'NORMALIZED_KEY_ORDER'));
  reject('normalized-key-collision', 'CANONICAL_KEY_COLLISION',()=>sha256({'\u00e9':1,'e\u0301':2}));
  pass('seal-adds-integrity-trust-class',()=>eq(observation.trustClass,'INTEGRITY_ONLY','TRUST_CLASS'));
  pass('integrity-receipt-ceiling-shadow-only',()=>eq(receiptAuthorityCeiling(observation),'SHADOW_ONLY','AUTHORITY_CEILING'));
  reject('seal-trust-escalation-authenticated','RECEIPT_TRUST_ESCALATION',()=>sealReceipt({...withoutSeal(observation),receiptId:'trust-up',trustClass:'AUTHENTICATED'}));
  reject('receipt-authority-field-forbidden','RECEIPT_AUTHORITY_CLAIM_FORBIDDEN',()=>{
    const bad=sealReceipt({...withoutSeal(observation),receiptId:'authority-claim',authority:'CANONICAL_AUTHORITY'});verifyReceipt(model,bad);
  });
  reject('receipt-authenticated-field-forbidden','RECEIPT_AUTHORITY_CLAIM_FORBIDDEN',()=>{
    const bad=sealReceipt({...withoutSeal(observation),receiptId:'auth-claim',authenticated:true});verifyReceipt(model,bad);
  });
  pass('malicious-writer-recomputed-integrity-still-shadow-only',()=>{
    const rewritten=sealReceipt({...withoutSeal(observation),receiptId:'rewritten',payload:{defaultBranch:'evil'}});verifyReceipt(model,rewritten);eq(receiptAuthorityCeiling(rewritten),'SHADOW_ONLY','WRITER_CEILING');
  });

  reject('receipt-id-noncanonical-nfc','IDENTITY_NOT_NFC',()=>{const bad=sealReceipt({...withoutSeal(observation),receiptId:'e\u0301'});verifyReceipt(model,bad)});
  reject('event-idempotency-noncanonical-nfc','IDENTITY_NOT_NFC',()=>{const bad=sealReceipt({receiptId:'event-nfc',receiptType:'EVENT',status:'RECORDED',recordedAt:t0,sequence:1,previousEventHash:null,eventType:'START',idempotencyKey:'e\u0301',payload:{x:1}});verifyReceipt(model,bad)});
  pass('active-integrity-evidence-cannot-exceed-shadow',()=>{const active=activeIntegrityEvidence(model,[ev1],A);eq(active[0].authorityCeiling,'SHADOW_ONLY','INTEGRITY_CEILING')});

  pass('observation-roundtrip',()=>verifyReceipt(model,observation));
  pass('unknown-observation-roundtrip',()=>verifyReceipt(model,unknown));
  pass('execution-evidence-roundtrip',()=>verifyReceipt(model,ev1));
  reject('unknown-without-reason','UNKNOWN_REASON_REQUIRED',()=>{const bad=sealReceipt({...withoutSeal(unknown),receiptId:'u2',payload:{}});verifyReceipt(model,bad)});
  reject('observation-time-reversal','OBSERVATION_TIME_ORDER',()=>{const bad=sealReceipt({...withoutSeal(observation),receiptId:'obs-time',observedAt:t2,recordedAt:t1});verifyReceipt(model,bad)});
  reject('timestamp-nonstring','TIME_TYPE',()=>{const bad=sealReceipt({...withoutSeal(observation),receiptId:'obs-number-time',recordedAt:123});verifyReceipt(model,bad)});
  reject('payload-tamper','PAYLOAD_HASH_MISMATCH',()=>{const c=structuredClone(ev1);c.payload.assertions=999;verifyReceipt(model,c)});
  reject('metadata-tamper','RECEIPT_HASH_MISMATCH',()=>{const c=structuredClone(ev1);c.command='other';verifyReceipt(model,c)});
  reject('hash-algorithm-mismatch','RECEIPT_HASH_ALGORITHM',()=>{const c=structuredClone(ev1);c.hashAlgorithm='fnv';verifyReceipt(model,c)});
  reject('pass-nonzero-exit','PASS_EXIT_CODE',()=>{const bad=sealReceipt({...withoutSeal(ev1),receiptId:'ev-bad',exitCode:1});verifyReceipt(model,bad)});
  reject('fail-zero-exit','FAIL_EXIT_CODE',()=>{const bad=sealReceipt({...withoutSeal(ev1),receiptId:'ev-fail',status:'EXECUTED_FAIL',exitCode:0});verifyReceipt(model,bad)});
  reject('invalid-artifact-hash','EVIDENCE_ARTIFACT_HASH',()=>{const bad=sealReceipt({...withoutSeal(ev1),receiptId:'ev-hash',artifactHashes:['abc']});verifyReceipt(model,bad)});
  reject('evidence-time-reversal','EVIDENCE_TIME_ORDER',()=>{const bad=sealReceipt({...withoutSeal(ev1),receiptId:'ev-time',startedAt:t2,finishedAt:t0});verifyReceipt(model,bad)});
  pass('valid-supersession-index',()=>buildReceiptIndex(model,[ev1,ev2,sup]));
  pass('superseded-evidence-inactive',()=>{const active=activeIntegrityEvidence(model,[ev1,ev2,sup],A);eq(active.length,1,'ACTIVE_COUNT');eq(active[0].receipt.receiptId,'ev-2','ACTIVE_ID');eq(active[0].authorityCeiling,'SHADOW_ONLY','ACTIVE_CEILING')});
  reject('duplicate-receipt-id','DUPLICATE_RECEIPT_ID',()=>buildReceiptIndex(model,[ev1,{...ev2,receiptId:ev1.receiptId}]));
  reject('supersession-old-hash-mismatch','SUPERSESSION_OLD_HASH_MISMATCH',()=>{const bad=sealReceipt({...withoutSeal(sup),receiptId:'sup-hash',supersedesReceiptHash:'0'.repeat(64)});buildReceiptIndex(model,[ev1,ev2,bad])});
  reject('supersession-old-missing','SUPERSESSION_OLD_MISSING',()=>{const bad=sealReceipt({...withoutSeal(sup),receiptId:'sup-missing',supersedesReceiptId:'missing'});buildReceiptIndex(model,[ev1,ev2,bad])});
  reject('supersession-cross-candidate','SUPERSESSION_CANDIDATE_MISMATCH',()=>{const other=sealReceipt({...withoutSeal(ev2),receiptId:'ev-b',candidateSha:B});const bad=sealReceipt({receiptId:'sup-b',receiptType:'SUPERSESSION',status:'SUPERSEDED',recordedAt:t3,supersedesReceiptId:ev1.receiptId,supersedesReceiptHash:ev1.receiptHash,replacementReceiptId:other.receiptId,replacementReceiptHash:other.receiptHash,reason:'bad'});buildReceiptIndex(model,[ev1,other,bad])});
  reject('supersession-kind-swap','SUPERSESSION_EVIDENCE_KIND_MISMATCH',()=>{const other=sealReceipt({...withoutSeal(ev2),receiptId:'ev-kind',evidenceKind:'SECURITY'});const bad=sealReceipt({receiptId:'sup-kind',receiptType:'SUPERSESSION',status:'SUPERSEDED',recordedAt:t3,supersedesReceiptId:ev1.receiptId,supersedesReceiptHash:ev1.receiptHash,replacementReceiptId:other.receiptId,replacementReceiptHash:other.receiptHash,reason:'bad'});buildReceiptIndex(model,[ev1,other,bad])});
  reject('supersession-replacement-before-old','SUPERSESSION_REPLACEMENT_BEFORE_OLD',()=>{const old=sealReceipt({...withoutSeal(ev1),receiptId:'old-late',recordedAt:t2});const repl=sealReceipt({...withoutSeal(ev2),receiptId:'repl-early',recordedAt:t1});const bad=sealReceipt({receiptId:'sup-time',receiptType:'SUPERSESSION',status:'SUPERSEDED',recordedAt:t3,supersedesReceiptId:old.receiptId,supersedesReceiptHash:old.receiptHash,replacementReceiptId:repl.receiptId,replacementReceiptHash:repl.receiptHash,reason:'bad'});buildReceiptIndex(model,[old,repl,bad])});
  reject('duplicate-supersession-old','SUPERSESSION_DUPLICATE_OLD',()=>{const ev3=sealReceipt({...withoutSeal(ev2),receiptId:'ev3',payload:{assertions:30}});const sup2=sealReceipt({...withoutSeal(sup),receiptId:'sup2',replacementReceiptId:ev3.receiptId,replacementReceiptHash:ev3.receiptHash});buildReceiptIndex(model,[ev1,ev2,ev3,sup,sup2])});
  reject('supersession-cycle','SUPERSESSION_CYCLE',()=>{const a=sealReceipt({...withoutSeal(ev1),receiptId:'ca'}),b=sealReceipt({...withoutSeal(ev2),receiptId:'cb'});const sa=sealReceipt({receiptId:'sa',receiptType:'SUPERSESSION',status:'SUPERSEDED',recordedAt:t3,supersedesReceiptId:a.receiptId,supersedesReceiptHash:a.receiptHash,replacementReceiptId:b.receiptId,replacementReceiptHash:b.receiptHash,reason:'a-b'});const sb=sealReceipt({receiptId:'sb',receiptType:'SUPERSESSION',status:'SUPERSEDED',recordedAt:t3,supersedesReceiptId:b.receiptId,supersedesReceiptHash:b.receiptHash,replacementReceiptId:a.receiptId,replacementReceiptHash:a.receiptHash,reason:'b-a'});buildReceiptIndex(model,[a,b,sa,sb])});

  const e1=sealReceipt({receiptId:'event-1',receiptType:'EVENT',status:'RECORDED',recordedAt:t0,sequence:1,previousEventHash:null,eventType:'START',idempotencyKey:'idem-1',payload:{x:1}});
  const e2=sealReceipt({receiptId:'event-2',receiptType:'EVENT',status:'RECORDED',recordedAt:t1,sequence:2,previousEventHash:e1.receiptHash,eventType:'NEXT',idempotencyKey:'idem-2',payload:{x:2}});
  const e3=sealReceipt({receiptId:'event-3',receiptType:'EVENT',status:'RECORDED',recordedAt:t2,sequence:3,previousEventHash:e2.receiptHash,eventType:'DONE',idempotencyKey:'idem-3',payload:{x:3}});
  pass('genesis-event-chain-valid',()=>verifyEventChain(model,[e1,e2,e3]));
  pass('continuation-segment-with-anchor-valid',()=>{const anchor=sha256('prior-tip');const s12=sealReceipt({receiptId:'event-12',receiptType:'EVENT',status:'RECORDED',recordedAt:t1,sequence:12,previousEventHash:anchor,eventType:'RESUME',idempotencyKey:'idem-12',payload:{x:12}});verifyEventChain(model,[s12],{anchorHash:anchor,startSequence:12})});
  reject('continuation-without-anchor','EVENT_CONTINUATION_ANCHOR_REQUIRED',()=>{const s12=sealReceipt({receiptId:'event-12b',receiptType:'EVENT',status:'RECORDED',recordedAt:t1,sequence:12,previousEventHash:null,eventType:'RESUME',idempotencyKey:'idem-12b',payload:{x:12}});verifyEventChain(model,[s12],{startSequence:12})});
  reject('genesis-with-anchor','EVENT_GENESIS_ANCHOR_FORBIDDEN',()=>verifyEventChain(model,[e1],{anchorHash:sha256('bad-anchor'),startSequence:1}));
  reject('invalid-continuation-anchor','EVENT_CONTINUATION_ANCHOR_REQUIRED',()=>verifyEventChain(model,[e1],{anchorHash:'abc',startSequence:12}));
  reject('event-reorder','EVENT_SEQUENCE_GAP',()=>verifyEventChain(model,[e2,e1,e3]));
  reject('event-link-tamper','EVENT_CHAIN_PREVIOUS_HASH',()=>{const bad=sealReceipt({...withoutSeal(e3),receiptId:'event-3b',previousEventHash:e1.receiptHash});verifyEventChain(model,[e1,e2,bad])});
  reject('event-idempotency-duplicate','EVENT_DUPLICATE_IDEMPOTENCY',()=>{const bad=sealReceipt({...withoutSeal(e3),receiptId:'event-3c',idempotencyKey:'idem-2'});verifyEventChain(model,[e1,e2,bad])});
  reject('event-recorded-time-reversal','EVENT_RECORDED_TIME_ORDER',()=>{const late=sealReceipt({...withoutSeal(e1),receiptId:'late',recordedAt:t2});const early=sealReceipt({...withoutSeal(e2),receiptId:'early',recordedAt:t1,previousEventHash:late.receiptHash});verifyEventChain(model,[late,early])});

  reject('canonical-symbol-key','CANONICAL_SYMBOL_KEY',()=>{const x={a:1};x[Symbol('hidden')]=2;sha256(x)});
  reject('seal-symbol-key-before-clone','CANONICAL_SYMBOL_KEY',()=>{const x={receiptId:'sym',receiptType:'OBSERVATION',status:'OBSERVED',recordedAt:t1,observedAt:t0,subjectId:'x',source:{kind:'git',locator:'x'}};x[Symbol('hidden')]=2;sealReceipt(x)});
  reject('canonical-nonenumerable','CANONICAL_NONENUMERABLE',()=>{const x={a:1};Object.defineProperty(x,'hidden',{value:2,enumerable:false});sha256(x)});
  reject('seal-nonenumerable-before-clone','CANONICAL_NONENUMERABLE',()=>{const x={receiptId:'hidden',receiptType:'OBSERVATION',status:'OBSERVED',recordedAt:t1,observedAt:t0,subjectId:'x',source:{kind:'git',locator:'x'}};Object.defineProperty(x,'hidden',{value:2,enumerable:false});sealReceipt(x)});
  reject('model-source-parent-drift','MODEL_PARENT_SHA_EXACT',()=>{const m=structuredClone(model);m.sourceParentSha='f'.repeat(40);validateModel(m)});
  reject('model-evidence-kind-drift','MODEL_EVIDENCE_KINDS_EXACT',()=>{const m=structuredClone(model);m.evidenceKinds.push('AUTHENTICATED');validateModel(m)});
  reject('model-receipt-status-drift','MODEL_RECEIPT_STATUSES_EXACT',()=>{const m=structuredClone(model);m.receiptTypes.EXECUTION_EVIDENCE.statuses.push('AUTHENTICATED_PASS');validateModel(m)});

  reject('canonical-nonfinite','CANONICAL_NONFINITE',()=>sha256({x:Infinity}));
  reject('canonical-sparse-array','CANONICAL_SPARSE_ARRAY',()=>{const x=[];x[1]=2;sha256(x)});
  reject('canonical-cycle','CANONICAL_CYCLE',()=>{const x={};x.self=x;sha256(x)});
  reject('canonical-accessor','CANONICAL_ACCESSOR',()=>{const x={};Object.defineProperty(x,'y',{get(){return 1},enumerable:true});sha256(x)});
  reject('presealed-input','RECEIPT_PRESEALED',()=>sealReceipt(observation));
  reject('payload-hash-without-payload','PAYLOAD_HASH_WITHOUT_PAYLOAD',()=>{const bad=sealReceipt({receiptId:'nopayload',receiptType:'OBSERVATION',status:'OBSERVED',recordedAt:t1,observedAt:t0,subjectId:'x',source:{kind:'git',locator:'x'}});const c=structuredClone(bad);c.payloadHash='0'.repeat(64);c.receiptHash=sha256(Object.fromEntries(Object.entries(c).filter(([k])=>k!=='receiptHash')));verifyReceipt(model,c)});
  reject('candidate-sha-invalid-evidence','EVIDENCE_CANDIDATE_SHA',()=>{const bad=sealReceipt({...withoutSeal(ev1),receiptId:'badsha',candidateSha:'abc'});verifyReceipt(model,bad)});
  reject('unknown-evidence-kind','EVIDENCE_KIND',()=>{const bad=sealReceipt({...withoutSeal(ev1),receiptId:'badkind',evidenceKind:'MAGIC'});verifyReceipt(model,bad)});

  const failed=scenarios.filter(item=>!item.passed);
  return {passed:failed.length===0,total:scenarios.length,failed:failed.length,scenarios};
}

export { selfTests };
