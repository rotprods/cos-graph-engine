#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT=process.cwd();
const BUNDLE='control-plane/v2/integration/coordination-integration.v3.json';
const CURRENT='control-plane/v2/continuity/CURRENT_V3.md';
const OUT='control-plane/v2/evidence/coordination-integration-v3';
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;

class GateError extends Error{constructor(code,detail=''){super(`${code}: ${detail}`);this.code=code;this.detail=detail;}}
const fail=(c,d='')=>{throw new GateError(c,d);};
const eq=(a,b,c,d='')=>{if(a!==b)fail(c,`${d} expected=${b} actual=${a}`);};
const ok=(v,c,d='')=>{if(!v)fail(c,d);};
const uniq=(a,c)=>{const s=new Set();for(const v of a){if(s.has(v))fail(c,String(v));s.add(v);}};
const stamp=(v,l)=>{const n=Date.parse(v);if(!Number.isFinite(n))fail('TIME_INVALID',`${l}:${v}`);return n;};
const err=e=>e instanceof GateError?{code:e.code,detail:e.detail}:{code:'UNEXPECTED',detail:String(e)};

function canonical(v,seen=new WeakSet()){
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='string')return v.normalize('NFC');
  if(typeof v==='number'){if(!Number.isFinite(v))fail('NONFINITE',String(v));return Object.is(v,-0)?0:v;}
  if(Array.isArray(v)){if(seen.has(v))fail('CYCLE','array');seen.add(v);const x=v.map(i=>canonical(i,seen));seen.delete(v);return x;}
  if(!v||typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype)fail('UNSUPPORTED',typeof v);
  if(seen.has(v))fail('CYCLE','object');
  seen.add(v);const x={};
  for(const key of Object.keys(v).sort()){
    const k=key.normalize('NFC');if(Object.hasOwn(x,k))fail('KEY_COLLISION',k);
    if(v[key]===undefined)fail('UNDEFINED',k);x[k]=canonical(v[key],seen);
  }
  seen.delete(v);return x;
}
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(canonical(v))).digest('hex');
const rehash=b=>{const c=structuredClone(b);delete c.contentHash;b.contentHash=hash(c);};

async function load(){
  return {
    bundle:JSON.parse(await readFile(path.join(ROOT,BUNDLE),'utf8')),
    readme:await readFile(path.join(ROOT,'README_FIRST.md'),'utf8'),
    current:await readFile(path.join(ROOT,CURRENT),'utf8')
  };
}
function validate(m,{at='2026-08-30T10:09:00Z'}={}){
  const errors=[];const warnings=[];const run=f=>{try{f();}catch(e){errors.push(err(e));}};
  run(()=>validateBundle(m.bundle));
  run(()=>validateRefs(m.bundle));
  run(()=>validateTemporal(m.bundle));
  run(()=>validateClaim(m.bundle,at));
  run(()=>validateLedger(m.bundle));
  run(()=>validateContext(m.bundle,at));
  run(()=>validateContinuity(m));
  run(()=>validateAuthority(m.bundle));
  if(m.bundle.historicalObservation.stillUnproven.length)warnings.push({code:'OBJECTS_STILL_UNPROVEN',detail:m.bundle.historicalObservation.stillUnproven.join(',')});
  warnings.push({code:'RUNTIME_NOT_RUN',detail:'This gate does not qualify the monorepo runtime.'});
  return {passed:errors.length===0,errors,warnings};
}
function validateBundle(b){
  eq(b.schemaVersion,3,'SCHEMA');
  ok(SHA64.test(b.contentHash),'BUNDLE_HASH_FORMAT');
  const c=structuredClone(b);delete c.contentHash;eq(hash(c),b.contentHash,'BUNDLE_HASH');
  ok(SHA40.test(b.observedParentSha),'PARENT_SHA');
  eq(b.authorityEffect,'TARGETED_CONTROL_PLANE_ONLY_NO_GLOBAL_SCORE_PROMOTION','AUTHORITY_EFFECT');
}
function validateRefs(b){
  eq(b.refs.controlPlane.pr,57,'CONTROL_PR');
  eq(b.refs.controlPlane.observedHeadSha,b.observedParentSha,'CONTROL_HEAD');
  eq(b.refs.controlPlane.semantics,'PRE_MUTATION_HEAD','SELF_REFERENCE_LAW');
  eq(b.refs.coordination.pr,56,'COMPONENT_PR');
  eq(b.refs.coordination.status,'TARGETED_PASS','COMPONENT_STATUS');
  eq(b.refs.authority.sha,null,'AUTHORITY_ASSIGNED');
  eq(b.refs.authority.status,'BLOCKED','AUTHORITY_STATUS');
  const active=b.roles.filter(r=>r.role==='ACTIVE_CANDIDATE');
  uniq(active.map(r=>r.lane),'DUPLICATE_ACTIVE_LANE');
  eq(active.find(r=>r.lane==='control-plane')?.pr,57,'ROLE_CONTROL_PR');
  eq(active.find(r=>r.lane==='control-plane')?.sha,b.observedParentSha,'ROLE_CONTROL_SHA');
  for(const r of b.roles)ok(SHA40.test(r.sha),'ROLE_SHA',String(r.pr));
}
function validateTemporal(b){
  ok(b.historicalObservation.reportedMissing.includes(56),'HISTORY_PR56');
  for(const [pr,created] of Object.entries(b.historicalObservation.createdLater)){
    ok(stamp(created,'created')>stamp(b.historicalObservation.at,'observed'),'RETROACTIVE_EXISTENCE',pr);
  }
  ok(b.historicalObservation.stillUnproven.includes(58),'UNPROVEN_58_MISSING');
  eq(b.historicalObservation.law,'later creation never retroactively validates an earlier claim','TEMPORAL_LAW');
}
function validateClaim(b,at){
  eq(b.claim.status,'ACTIVE','CLAIM_STATUS');
  eq(b.claim.revision,3,'CLAIM_REVISION');
  eq(b.claim.fence,3,'CLAIM_FENCE');
  eq(b.claim.expectedHead,b.observedParentSha,'CLAIM_HEAD');
  eq(b.session.id,b.claim.sessionId,'SESSION_CLAIM');
  eq(b.session.expectedHead,b.claim.expectedHead,'SESSION_HEAD');
  eq(b.session.authorityCeiling,'IMPLEMENTED_UNVERIFIED','SESSION_CEILING');
  const now=stamp(at,'evaluation');ok(stamp(b.claim.heartbeatAt,'heartbeat')<=now,'HEARTBEAT_FUTURE');
  ok(now<stamp(b.claim.expiresAt,'expiry'),'CLAIM_EXPIRED');
}
function validateLedger(b){
  const l=b.ledger;eq(l.events.length,4,'EVENT_COUNT');
  eq(l.events[0].sequence,l.firstSequence,'FIRST_SEQUENCE');
  eq(l.events.at(-1).sequence,l.lastSequence,'LAST_SEQUENCE');
  uniq(l.events.map(e=>e.eventId),'DUPLICATE_EVENT_ID');
  uniq(l.events.map(e=>e.idempotencyKey),'DUPLICATE_IDEMPOTENCY');
  let previous=l.anchorHash;
  l.events.forEach((e,i)=>{
    eq(e.sequence,l.firstSequence+i,'EVENT_SEQUENCE',e.eventId);
    eq(e.previousEventHash,previous,'EVENT_PREVIOUS_HASH',e.eventId);
    const c=structuredClone(e);delete c.eventHash;eq(hash(c),e.eventHash,'EVENT_HASH',e.eventId);
    previous=e.eventHash;
  });
  eq(previous,l.tipHash,'EVENT_TIP');
  ok(l.events.some(e=>e.eventType==='TEMPORAL_OBJECT_EXISTENCE_CORRECTED'),'TEMPORAL_EVENT');
}
function validateContext(b,at){
  ok(b.context.staleByDefault,'CONTEXT_STALE_DEFAULT');
  const now=stamp(at,'evaluation');ok(stamp(b.context.generatedAt,'generated')<=now,'CONTEXT_FUTURE');
  ok(now<stamp(b.context.expiresAt,'expires'),'CONTEXT_EXPIRED');
  eq(b.context.fences.controlPlane,b.observedParentSha,'CONTEXT_HEAD');
  eq(b.context.fences.watermark,b.ledger.lastSequence,'CONTEXT_WATERMARK');
  eq(b.context.fences.claim,b.claim.id,'CONTEXT_CLAIM');
  eq(b.context.fences.fence,b.claim.fence,'CONTEXT_FENCE');
  ok(b.context.facts.some(f=>f.includes('NOT_RUN')),'RUNTIME_BOUNDARY');
}
function validateContinuity(m){
  ok(m.readme.includes('CURRENT_V3.md'),'README_POINTER');
  ok(m.readme.includes('SHADOW_ONLY'),'README_BOUNDARY');
  for(const n of ['PR #57','PR #56','NOT_RUN','SHADOW_ONLY','Next safe sequence'])ok(m.current.includes(n),'CURRENT_STALE',n);
}
function validateAuthority(b){
  eq(b.refs.authority.sha,null,'AUTHORITY_PROMOTED');
  eq(b.context.authorityCeiling,'IMPLEMENTED_UNVERIFIED','CONTEXT_CEILING');
}
function rebuild(b){
  validateLedger(b);
  const active=b.roles.find(r=>r.role==='ACTIVE_CANDIDATE'&&r.lane==='control-plane');
  const runtime=b.roles.find(r=>r.role==='ACTIVE_CANDIDATE'&&r.lane==='runtime');
  if(!active||!runtime)fail('RESTORE_ROLE_MISSING');
  eq(active.sha,b.refs.controlPlane.observedHeadSha,'RESTORE_CONTROL_ROLE');
  eq(runtime.sha,b.refs.runtime.headSha,'RESTORE_RUNTIME_ROLE');
  eq(b.refs.authority.sha,null,'RESTORE_AUTHORITY');
  const state={
    projectId:'COS_GRAPH_ENGINE',mainSha:b.refs.main.sha,controlPlanePr:active.pr,
    controlPlaneObservedHead:active.sha,coordinationPr:b.refs.coordination.pr,
    coordinationImplementation:b.refs.coordination.implementationSha,coordinationEvidence:b.refs.coordination.evidenceCommitSha,
    runtimePr:runtime.pr,runtimeHead:runtime.sha,eventWatermark:b.ledger.lastSequence,
    eventTip:b.ledger.tipHash,activeClaim:{id:b.claim.id,revision:b.claim.revision,fence:b.claim.fence,expectedHead:b.claim.expectedHead},
    authorityRef:null,authorityStatus:'SHADOW_ONLY',
    nextSafeAction:'bind exact-SHA integration evidence, obtain independent review, then create a real runtime qualification branch'
  };
  eq(hash(state),b.restore.expectedHash,'RESTORE_HASH');return state;
}
function selfTests(base,docs,at){
  const out=[];const expect=(name,codes,mutate,timeOverride=at)=>{
    const m={bundle:structuredClone(base),readme:docs.readme,current:docs.current};mutate(m);const r=validate(m,{at:timeOverride});
    const list=Array.isArray(codes)?codes:[codes];out.push({name,expected:list,observed:r.errors.map(e=>e.code),passed:list.some(c=>r.errors.some(e=>e.code===c))});
  };
  expect('event-tamper','EVENT_HASH',m=>{m.bundle.ledger.events[0].payload.main='0'.repeat(40);rehash(m.bundle);});
  expect('event-reorder',['FIRST_SEQUENCE','EVENT_SEQUENCE'],m=>{[m.bundle.ledger.events[0],m.bundle.ledger.events[1]]=[m.bundle.ledger.events[1],m.bundle.ledger.events[0]];rehash(m.bundle);});
  expect('duplicate-idempotency','DUPLICATE_IDEMPOTENCY',m=>{m.bundle.ledger.events[1].idempotencyKey=m.bundle.ledger.events[0].idempotencyKey;rehash(m.bundle);});
  expect('duplicate-lane','DUPLICATE_ACTIVE_LANE',m=>{m.bundle.roles.push({...m.bundle.roles[0],pr:999});rehash(m.bundle);});
  expect('stale-fence','CLAIM_FENCE',m=>{m.bundle.claim.fence=2;rehash(m.bundle);});
  expect('expired-context','CONTEXT_EXPIRED',m=>{},'2026-08-30T14:08:00Z');
  expect('retroactive-pr','RETROACTIVE_EXISTENCE',m=>{m.bundle.historicalObservation.createdLater['56']='2026-08-30T06:00:00Z';rehash(m.bundle);});
  expect('authority-assignment',['AUTHORITY_ASSIGNED','AUTHORITY_PROMOTED'],m=>{m.bundle.refs.authority.sha='a'.repeat(40);rehash(m.bundle);});
  expect('stale-current-doc','CURRENT_STALE',m=>{m.current=m.current.replaceAll('PR #57','PR #55');});
  expect('wrong-claim-head','CLAIM_HEAD',m=>{m.bundle.claim.expectedHead='b'.repeat(40);rehash(m.bundle);});
  const bad=out.filter(x=>!x.passed);if(bad.length)fail('SELF_TEST',bad.map(x=>x.name).join(','));return out;
}
async function diskRoundTrip(state){
  const dir=await mkdtemp(path.join(os.tmpdir(),'cos-v3-'));
  try{await writeFile(path.join(dir,'state.json'),JSON.stringify(state));return JSON.parse(await readFile(path.join(dir,'state.json'),'utf8'));}
  finally{await rm(dir,{recursive:true,force:true});}
}
async function main(){
  const at=process.argv.includes('--at')?process.argv[process.argv.indexOf('--at'+1]:'2026-08-30T10:09:00Z';
  const m=await load();const v=validate(m,{at});const tests=process.argv.includes('--self-test')?selfTests(m.bundle,m,at):[];
  const state=rebuild(m.bundle);const disk=await diskRoundTrip(state);eq(hash(disk),hash(state),'DISK_RESTORE');
  const report={schemaVersion:1,status:v.passed?'PASS':'FAIL',generatedAt:new Date().toISOString(),evaluatedAt:at,
    executionRevision:process.env.COS_GIT_SHA??'UNBOUND_LOCAL_EXECUTION',sourceParentSha:m.bundle.observedParentSha,
    validation:v,selfTests:tests,restoredState:state,restoredStateHash:hash(state),counts:{events:m.bundle.ledger.events.length,roles:m.bundle.roles.length,selfTests:tests.length},
    proofBoundary:m.bundle.proofBoundary,authorityEffect:'TARGETED_CONTROL_PLANE_ASSURANCE_ONLY_NO_GLOBAL_SCORE_PROMOTION'};
  report.reportHash=hash(report);
  if(process.argv.includes('--write')){await mkdir(path.join(ROOT,OUT),{recursive:true});await writeFile(path.join(ROOT,OUT,'evidence.json'),JSON.stringify(report,null,2)+'\n');}
  process.stdout.write(JSON.stringify(report,null,2)+'\n');if(!v.passed)process.exitCode=1;
}
main().catch(e=>{process.stderr.write(JSON.stringify(err(e),null,2)+'\n');process.exitCode=1;});
