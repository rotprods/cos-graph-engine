#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const CONTRACTS_PATH = 'control-plane/v4.1/model/contracts.v4.json';
const SHA40 = /^[0-9a-f]{40}$/;
const CANONICAL_AUTHORITY_LATTICE = [
  'UNTRUSTED_DATA','REFERENCE_ONLY','PROJECTION','SHADOW_ONLY','IMPLEMENTED_UNVERIFIED',
  'TARGETED_PASS','SYSTEM_PASS','PHYSICAL_PASS','ADVERSARIAL_PASS','CLEANROOM_PASS',
  'PROMOTION_ELIGIBLE','CANONICAL_AUTHORITY',
];
const CANONICAL_PASS_ORDER = ['TARGETED_PASS','SYSTEM_PASS','PHYSICAL_PASS','ADVERSARIAL_PASS','CLEANROOM_PASS'];

class GateError extends Error {
  constructor(code, detail='') { super(`${code}: ${detail}`); this.code=code; this.detail=detail; }
}
const fail=(code,detail='')=>{throw new GateError(code,detail)};
const ok=(condition,code,detail='')=>{if(!condition) fail(code,detail)};
const eq=(actual,expected,code,detail='')=>{if(actual!==expected) fail(code,`${detail} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`)};
const uniq=(items,code)=>{const seen=new Set(); for(const item of items){if(seen.has(item)) fail(code,String(item)); seen.add(item)}};
const errorRecord=e=>e instanceof GateError?{code:e.code,detail:e.detail}:{code:'UNEXPECTED',detail:String(e)};

const key=([from,to])=>`${from}=>${to}`;
function adjacency(machine){
  const out=new Map(machine.states.map(s=>[s,[]]));
  const rev=new Map(machine.states.map(s=>[s,[]]));
  for(const [from,to] of machine.transitions){out.get(from).push(to); rev.get(to).push(from)}
  return {out,rev};
}
function reachable(start, map){
  const seen=new Set([start]); const q=[start];
  while(q.length){const n=q.shift(); for(const next of map.get(n)??[]){if(!seen.has(next)){seen.add(next); q.push(next)}}}
  return seen;
}
function validateMachine(name,machine,policy){
  ok(machine&&typeof machine==='object','MACHINE_MISSING',name);
  ok(Array.isArray(machine.states)&&machine.states.length>0,'MACHINE_STATES',name);
  ok(Array.isArray(machine.transitions),'MACHINE_TRANSITIONS',name);
  uniq(machine.states,'MACHINE_DUPLICATE_STATE');
  uniq(machine.transitions.map(key),'MACHINE_DUPLICATE_TRANSITION');
  ok(machine.states.includes(machine.initial),'MACHINE_INITIAL_UNKNOWN',name);
  for(const terminal of machine.terminal??[]) ok(machine.states.includes(terminal),'MACHINE_TERMINAL_UNKNOWN',`${name}:${terminal}`);
  for(const pair of machine.transitions){
    ok(Array.isArray(pair)&&pair.length===2,'MACHINE_TRANSITION_SHAPE',name);
    const [from,to]=pair;
    ok(machine.states.includes(from),'MACHINE_TRANSITION_FROM_UNKNOWN',`${name}:${from}`);
    ok(machine.states.includes(to),'MACHINE_TRANSITION_TO_UNKNOWN',`${name}:${to}`);
    ok(from!==to,'MACHINE_SELF_TRANSITION',`${name}:${from}`);
  }
  const {out,rev}=adjacency(machine); const terminals=new Set(machine.terminal??[]);
  if(policy.terminalStatesHaveNoOutgoing){
    for(const terminal of terminals) eq(out.get(terminal).length,0,'TERMINAL_HAS_OUTGOING',`${name}:${terminal}`);
  }
  if(policy.nonTerminalStatesMustHaveOutgoing){
    for(const state of machine.states) if(!terminals.has(state)) ok(out.get(state).length>0,'NONTERMINAL_DEAD_END',`${name}:${state}`);
  }
  if(policy.allStatesReachableFromInitial){
    const seen=reachable(machine.initial,out);
    for(const state of machine.states) ok(seen.has(state),'MACHINE_STATE_UNREACHABLE',`${name}:${state}`);
  }
  if(policy.allNonTerminalStatesCanReachTerminal){
    const terminalReach=new Set(); const q=[...terminals]; for(const t of q) terminalReach.add(t);
    while(q.length){const n=q.shift(); for(const prev of rev.get(n)??[]){if(!terminalReach.has(prev)){terminalReach.add(prev); q.push(prev)}}}
    for(const state of machine.states) if(!terminals.has(state)) ok(terminalReach.has(state),'MACHINE_NO_TERMINAL_PATH',`${name}:${state}`);
  }
}
function predecessors(machine,state){return machine.transitions.filter(([,to])=>to===state).map(([from])=>from).sort()}
function validateCriticalPredecessors(model){
  for(const [path,expected] of Object.entries(model.stateMachinePolicy.criticalPredecessors)){
    const [machineName,state]=path.split('.'); const machine=model.stateMachines[machineName];
    ok(machine,'CRITICAL_MACHINE_UNKNOWN',path);
    eq(JSON.stringify(predecessors(machine,state)),JSON.stringify([...expected].sort()),'CRITICAL_PREDECESSOR_MISMATCH',path);
  }
}
function validateModel(model){
  eq(model.schemaVersion,4,'SCHEMA_VERSION');
  eq(model.contractId,'cos_repo_assurance_v4_1_contract_kernel','CONTRACT_ID');
  ok(SHA40.test(model.sourceParentSha),'SOURCE_PARENT_SHA');
  eq(model.authorityCeiling,'IMPLEMENTED_UNVERIFIED','AUTHORITY_CEILING');
  eq(JSON.stringify(model.authorityLattice),JSON.stringify(CANONICAL_AUTHORITY_LATTICE),'AUTHORITY_LATTICE_ORDER');
  eq(JSON.stringify(model.passLikeEvidenceStates),JSON.stringify(CANONICAL_PASS_ORDER),'PASS_STATUS_ORDER');
  const policy=model.stateMachinePolicy;
  ok(policy&&typeof policy==='object','STATE_MACHINE_POLICY_MISSING');
  for(const name of ['Defect','Evidence','Candidate','ClaimLease']) validateMachine(name,model.stateMachines[name],policy);
  validateCriticalPredecessors(model);
  eq(JSON.stringify(model.candidateRequirements.allowedFields),JSON.stringify(['candidateSha']),'CANDIDATE_ALLOWED_FIELDS');
  eq(model.promotionRequirements.requiredDefectCounts.openP0,0,'PROMOTION_P0');
  eq(model.promotionRequirements.requiredDefectCounts.openP1,0,'PROMOTION_P1');
  const kinds=model.promotionRequirements.requiredEvidenceKinds;
  for(const required of ['DEFECT_INVENTORY','REQUIRED_CHECKS','SECURITY','CLEANROOM','AUTHORITY_CONSISTENCY']) ok(Object.hasOwn(kinds,required),'PROMOTION_REQUIRED_KIND_MISSING',required);
  uniq(model.evidenceRequirements.allowedKinds,'EVIDENCE_KIND_DUPLICATE');
  for(const [kind,status] of Object.entries(kinds)){
    ok(model.evidenceRequirements.allowedKinds.includes(kind),'PROMOTION_KIND_UNKNOWN',kind);
    ok(model.passLikeEvidenceStates.includes(status),'PROMOTION_STATUS_NOT_PASSLIKE',`${kind}:${status}`);
  }
  eq(model.checkpoints.length,13,'CHECKPOINT_COUNT'); uniq(model.checkpoints.map(c=>c.id),'CHECKPOINT_DUPLICATE_ID');
  model.checkpoints.forEach((cp,i)=>eq(cp.id,`CP${i}`,'CHECKPOINT_SEQUENCE',cp.id));
  ok(model.uncertaintyStates.includes('UNKNOWN'),'UNKNOWN_STATE_MISSING');
  ok(!model.passLikeEvidenceStates.includes('UNKNOWN'),'UNKNOWN_MARKED_PASS');
}
function evidenceRank(model,status){return model.passLikeEvidenceStates.indexOf(status)}
function validateEvidence(model,evidence,candidateSha){
  ok(SHA40.test(candidateSha),'CANDIDATE_SHA_INVALID',candidateSha);
  ok(evidence&&typeof evidence==='object'&&!Array.isArray(evidence),'EVIDENCE_OBJECT');
  ok(model.stateMachines.Evidence.states.includes(evidence.status),'EVIDENCE_STATUS_UNKNOWN',evidence.status??'');
  ok(model.evidenceRequirements.allowedKinds.includes(evidence.kind),'EVIDENCE_KIND_UNKNOWN',evidence.kind??'');
  if(model.passLikeEvidenceStates.includes(evidence.status)){
    ok(SHA40.test(evidence.candidateSha??''),'EVIDENCE_SHA_MISSING');
    eq(evidence.candidateSha,candidateSha,'EVIDENCE_SHA_STALE');
    ok(typeof evidence.command==='string'&&evidence.command.trim(),'EVIDENCE_COMMAND_MISSING');
    ok(Number.isInteger(evidence.exitCode),'EVIDENCE_EXIT_CODE_MISSING');
    eq(evidence.exitCode,0,'EVIDENCE_EXIT_CODE_NONZERO');
  }
  if(evidence.kind==='DEFECT_INVENTORY'){
    ok(evidence.details&&typeof evidence.details==='object'&&!Array.isArray(evidence.details),'DEFECT_INVENTORY_DETAILS');
    for(const k of ['openP0','openP1']) ok(Number.isSafeInteger(evidence.details[k])&&evidence.details[k]>=0,'DEFECT_COUNT_INVALID',k);
  }
  ok(!model.evidenceRequirements.terminalNonQualifyingStates.includes(evidence.status),'EVIDENCE_NON_QUALIFYING_STATE',evidence.status);
  ok(!model.evidenceRequirements.writtenOnlyStates.includes(evidence.status),'EVIDENCE_UNEXECUTED',evidence.status);
}
function validateCandidate(model,candidate){
  ok(candidate&&typeof candidate==='object'&&!Array.isArray(candidate),'PROMOTION_INPUT');
  ok(SHA40.test(candidate.candidateSha??''),'PROMOTION_CANDIDATE_SHA');
  const allowed=new Set(model.candidateRequirements.allowedFields);
  for(const field of Object.keys(candidate)) ok(allowed.has(field),'CANDIDATE_SELF_ATTESTATION_FORBIDDEN',field);
}
function evaluatePromotion(model,candidate,evidence=[]){
  validateCandidate(model,candidate); ok(evidence.length>0,'PROMOTION_EVIDENCE_EMPTY');
  for(const packet of evidence) validateEvidence(model,packet,candidate.candidateSha);
  for(const [kind,requiredStatus] of Object.entries(model.promotionRequirements.requiredEvidenceKinds)){
    const packets=evidence.filter(p=>p.kind===kind); ok(packets.length>0,'PROMOTION_REQUIRED_EVIDENCE_MISSING',kind);
    const requiredRank=evidenceRank(model,requiredStatus); const strongest=Math.max(...packets.map(p=>evidenceRank(model,p.status)));
    ok(strongest>=requiredRank,'PROMOTION_EVIDENCE_TOO_WEAK',`${kind}: requires ${requiredStatus}`);
  }
  const defects=evidence.filter(p=>p.kind==='DEFECT_INVENTORY');
  eq(defects.length,1,'PROMOTION_DEFECT_INVENTORY_CARDINALITY');
  eq(defects[0].details.openP0,0,'PROMOTION_BLOCKED_P0'); eq(defects[0].details.openP1,0,'PROMOTION_BLOCKED_P1');
  return {eligible:true,state:'PROMOTION_ELIGIBLE',candidateSha:candidate.candidateSha};
}
function validateProjectionAuthority(p){if(p.authority==='CANONICAL_AUTHORITY') fail('PROJECTION_AUTHORITY_ESCALATION',p.id??'unknown')}

function selfTests(model){
  const scenarios=[];
  const reject=(name,code,fn)=>{try{fn(); scenarios.push({name,expected:code,observed:null,passed:false})}catch(e){const observed=e instanceof GateError?e.code:'UNEXPECTED';scenarios.push({name,expected:code,observed,passed:observed===code})}};
  const pass=(name,fn)=>{try{fn(); scenarios.push({name,expected:'PASS',observed:'PASS',passed:true})}catch(e){scenarios.push({name,expected:'PASS',observed:e instanceof GateError?e.code:'UNEXPECTED',passed:false})}};
  const A='a'.repeat(40),B='b'.repeat(40);
  const packet=(kind,status,sha=A,exitCode=0,details)=>({kind,status,candidateSha:sha,command:`verify:${kind}`,exitCode,...(details===undefined?{}:{details})});
  const defects=(p0=0,p1=0)=>packet('DEFECT_INVENTORY','SYSTEM_PASS',A,0,{openP0:p0,openP1:p1});
  const evidence=[defects(),packet('REQUIRED_CHECKS','SYSTEM_PASS'),packet('SECURITY','ADVERSARIAL_PASS'),packet('CLEANROOM','CLEANROOM_PASS'),packet('AUTHORITY_CONSISTENCY','SYSTEM_PASS')];
  const candidate={candidateSha:A};
  pass('baseline-model',()=>validateModel(model)); pass('promotion-happy-path',()=>evaluatePromotion(model,candidate,evidence));
  reject('candidate-self-attestation','CANDIDATE_SELF_ATTESTATION_FORBIDDEN',()=>evaluatePromotion(model,{...candidate,security:'PASS'},evidence));
  reject('stale-evidence','EVIDENCE_SHA_STALE',()=>validateEvidence(model,packet('CLEANROOM','CLEANROOM_PASS',B),A));
  reject('open-p0','PROMOTION_BLOCKED_P0',()=>evaluatePromotion(model,candidate,[defects(1,0),...evidence.slice(1)]));
  reject('open-p1','PROMOTION_BLOCKED_P1',()=>evaluatePromotion(model,candidate,[defects(0,1),...evidence.slice(1)]));
  reject('weak-security','PROMOTION_EVIDENCE_TOO_WEAK',()=>evaluatePromotion(model,candidate,evidence.map(p=>p.kind==='SECURITY'?packet('SECURITY','TARGETED_PASS'):p)));
  reject('projection-authority','PROJECTION_AUTHORITY_ESCALATION',()=>validateProjectionAuthority({id:'p',authority:'CANONICAL_AUTHORITY'}));
  const terminalEscape=structuredClone(model); terminalEscape.stateMachines.Candidate.transitions.push(['REJECTED','CANONICAL_AUTHORITY']);
  reject('terminal-outgoing-escape','TERMINAL_HAS_OUTGOING',()=>validateModel(terminalEscape));
  const staleEscape=structuredClone(model); staleEscape.stateMachines.Candidate.transitions.push(['STALE_ASSURANCE','CANONICAL_AUTHORITY']);
  reject('stale-to-authority-escape','CRITICAL_PREDECESSOR_MISMATCH',()=>validateModel(staleEscape));
  const defectEscape=structuredClone(model); defectEscape.stateMachines.Defect.transitions.push(['DISCOVERED','CLOSED']);
  reject('defect-shortcut-escape','CRITICAL_PREDECESSOR_MISMATCH',()=>validateModel(defectEscape));
  const evidenceEscape=structuredClone(model); evidenceEscape.stateMachines.Evidence.transitions.push(['PROPOSED','CLEANROOM_PASS']);
  reject('evidence-shortcut-escape','CRITICAL_PREDECESSOR_MISMATCH',()=>validateModel(evidenceEscape));
  const deadEnd=structuredClone(model); deadEnd.stateMachines.Defect.transitions=deadEnd.stateMachines.Defect.transitions.filter(([f,t])=>!(f==='DEFERRED'&&t==='REPRODUCED'));
  reject('nonterminal-dead-end','NONTERMINAL_DEAD_END',()=>validateModel(deadEnd));
  const unreachable=structuredClone(model); unreachable.stateMachines.ClaimLease.states.push('ORPHAN'); unreachable.stateMachines.ClaimLease.transitions.push(['ORPHAN','RELEASED']);
  reject('unreachable-state','MACHINE_STATE_UNREACHABLE',()=>validateModel(unreachable));
  const noTerminal=structuredClone(model); noTerminal.stateMachines.ClaimLease.states.push('LOOP_A','LOOP_B'); noTerminal.stateMachines.ClaimLease.transitions.push(['ACTIVE','LOOP_A'],['LOOP_A','LOOP_B'],['LOOP_B','LOOP_A']);
  reject('no-terminal-path','MACHINE_NO_TERMINAL_PATH',()=>validateModel(noTerminal));
  const lattice=structuredClone(model); [lattice.authorityLattice[1],lattice.authorityLattice[5]]=[lattice.authorityLattice[5],lattice.authorityLattice[1]];
  reject('authority-lattice-reorder','AUTHORITY_LATTICE_ORDER',()=>validateModel(lattice));
  const terminalLabel=structuredClone(model); terminalLabel.stateMachines.Defect.terminal=terminalLabel.stateMachines.Defect.terminal.filter(s=>s!=='DUPLICATE');
  reject('duplicate-dead-end-misclassified','NONTERMINAL_DEAD_END',()=>validateModel(terminalLabel));
  const missingPred=structuredClone(model); missingPred.stateMachines.Candidate.transitions=missingPred.stateMachines.Candidate.transitions.filter(([f,t])=>!(f==='CLEANROOM_PASS'&&t==='PROMOTION_ELIGIBLE'));
  reject('promotion-predecessor-missing','MACHINE_STATE_UNREACHABLE',()=>validateModel(missingPred));
  const invalidEvidence={kind:'OTHER',status:'INVALIDATED'}; reject('invalidated-evidence','EVIDENCE_NON_QUALIFYING_STATE',()=>validateEvidence(model,invalidEvidence,A));
  reject('unexecuted-evidence','EVIDENCE_UNEXECUTED',()=>validateEvidence(model,{kind:'OTHER',status:'WRITTEN_UNEXECUTED'},A));
  reject('unknown-kind','EVIDENCE_KIND_UNKNOWN',()=>validateEvidence(model,packet('MAGIC','CLEANROOM_PASS'),A));
  reject('duplicate-defect-inventory','PROMOTION_DEFECT_INVENTORY_CARDINALITY',()=>evaluatePromotion(model,candidate,[defects(),...evidence]));
  const passOrder=structuredClone(model); passOrder.passLikeEvidenceStates.reverse(); reject('pass-order-reorder','PASS_STATUS_ORDER',()=>validateModel(passOrder));
  const cp=structuredClone(model); cp.checkpoints[7].id='CP8'; reject('checkpoint-dup','CHECKPOINT_DUPLICATE_ID',()=>validateModel(cp));
  const failed=scenarios.filter(s=>!s.passed); return {passed:failed.length===0,total:scenarios.length,failed:failed.length,scenarios};
}

async function main(){
  const model=JSON.parse(await readFile(CONTRACTS_PATH,'utf8'));
  let validation; try{validateModel(model); validation={passed:true,errors:[]}}catch(e){validation={passed:false,errors:[errorRecord(e)]}};
  const report={validation}; if(process.argv.includes('--self-test')) report.selfTest=selfTests(model);
  report.passed=validation.passed&&(!report.selfTest||report.selfTest.passed); process.stdout.write(`${JSON.stringify(report,null,2)}\n`); process.exitCode=report.passed?0:1;
}
main().catch(e=>{process.stderr.write(`${JSON.stringify({passed:false,fatal:errorRecord(e)},null,2)}\n`);process.exitCode=1});
