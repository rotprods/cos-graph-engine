#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const MODEL='control-plane/v4.1/integration/integration-contract.v1.json';
const SHA40=/^[0-9a-f]{40}$/;
const EXPECTED_PARENT='6aa2948e7e5ed6d2ea6bbbed64ef0c29115b7dc4';
const EXPECTED={
  state:{pr:82,implementationSha:'797c12eabf64e341796f183bf39c684fab58873e',evidenceCommit:'5949ba6405f00a566a6ba7622682143fef2c9a66',modelBlobSha:'64896da82186c81445945f2c86ab68c13b4ed390',validatorBlobSha:'ecd98f614378326d6aa2fc781d9c763991be1a6f',evidenceBlobSha:'d9215a6032161627905eab845f6d8fd5b7cefe80',assertions:24},
  receipt:{pr:84,implementationSha:'b3e933901d6ca5cbc1a6733e366457b6ca59b30a',evidenceCommit:'a02f446c3ce2786a64d0972c40cb48259748bed0',modelBlobSha:'e557618477c66fe943a2e2dcd2cc134fe5a04fb6',canonicalBlobSha:'b683b912889e96d30a9a99569cf51b332b8c0d31',verifierBlobSha:'8b9b177dadc338a2be2f504d6ef694be14b6817b',selftestBlobSha:'913ad96ce22a85535557938b180e752005886b6d',runnerBlobSha:'3fe1a43de9f252829db2f45487c3724058454907',evidenceBlobSha:'1a25599b43316703fd85d2551a020f5980ed46f9',assertions:60},
};
class GateError extends Error{constructor(code,detail=''){super(`${code}: ${detail}`);this.code=code;this.detail=detail}}
const fail=(c,d='')=>{throw new GateError(c,d)};const ok=(v,c,d='')=>{if(!v)fail(c,d)};const eq=(a,b,c,d='')=>{if(a!==b)fail(c,`${d} expected=${JSON.stringify(b)} actual=${JSON.stringify(a)}`)};
const err=e=>e instanceof GateError?e.code:'UNEXPECTED';
function exactObject(actual,expected,code){for(const [k,v] of Object.entries(expected))eq(actual[k],v,code,k)}
function validateModel(m){
  eq(m.schemaVersion,1,'SCHEMA');eq(m.contractId,'cos_repo_assurance_v4_1_shadow_integration','ID');eq(m.version,'4.1.0-alpha.7','VERSION');eq(m.sourceParentSha,EXPECTED_PARENT,'PARENT');
  eq(m.authorityCeiling,'SHADOW_ONLY','CEILING');eq(m.promotionMode,'BLOCKED_UNTIL_V6_INDEPENDENT_AUTHENTICITY','PROMOTION_MODE');
  eq(JSON.stringify(m.acceptedPromotionTrustClasses),'[]','PROMOTION_TRUST_CLASSES');eq(m.currentReceiptTrustClass,'INTEGRITY_ONLY','RECEIPT_TRUST');eq(m.currentReceiptAuthorityCeiling,'SHADOW_ONLY','RECEIPT_CEILING');
  eq(m.futureRequiredTrustBoundary,'V6_INDEPENDENT_VERIFIER_OR_EQUIVALENT','FUTURE_TRUST_BOUNDARY');
  for(const child of [m.children.stateContract,m.children.receiptKernel]){eq(child.status,'TARGETED_PASS','CHILD_STATUS');eq(child.authorityCeiling,'TARGETED_PASS_SHADOW_ONLY','CHILD_CEILING');for(const key of ['implementationSha','evidenceCommit'])ok(SHA40.test(child[key]),'CHILD_SHA',key)}
  eq(m.children.receiptKernel.trustClass,'INTEGRITY_ONLY','CHILD_RECEIPT_TRUST');
  exactObject(m.children.stateContract,EXPECTED.state,'STATE_CHILD_REF');exactObject(m.children.receiptKernel,EXPECTED.receipt,'RECEIPT_CHILD_REF');
  for(const invariant of ['CHILD_EVIDENCE_PRESERVED_NOT_UPGRADED','INTEGRITY_ONLY_NEVER_SATISFIES_PROMOTION_AUTHORITY','COMBINED_AUTHORITY_CEILING_SHADOW_ONLY','NO_SYNTHETIC_TRUST_UPGRADE','CHILD_IMPLEMENTATION_AND_EVIDENCE_REFS_EXACT','PROMOTION_REMAINS_BLOCKED_UNTIL_V6','TARGETED_PASS_IS_ASSURANCE_NOT_AUTHORITY'])ok(m.hardInvariants.includes(invariant),'INVARIANT',invariant);
}
function classifyReceiptTrustForPromotion(m,trustClass){
  if(trustClass==='INTEGRITY_ONLY')return {usable:false,authorityCeiling:'SHADOW_ONLY',reason:'INTEGRITY_ONLY_NOT_AUTHORITY'};
  if(!m.acceptedPromotionTrustClasses.includes(trustClass))return {usable:false,authorityCeiling:'UNKNOWN',reason:'TRUST_CLASS_NOT_ACCEPTED'};
  return {usable:true,authorityCeiling:'PROMOTION_ELIGIBLE',reason:'ACCEPTED'};
}
function integratedStatus(m){validateModel(m);const receipt=classifyReceiptTrustForPromotion(m,m.children.receiptKernel.trustClass);ok(!receipt.usable,'INTEGRITY_ONLY_AUTHORITY_ESCALATION');return {assurance:'TARGETED_PASS',authority:'SHADOW_ONLY',promotion:'BLOCKED_UNTIL_V6_INDEPENDENT_AUTHENTICITY',receiptTrust:receipt};}
function selfTests(m){const s=[];const reject=(n,c,fn)=>{try{fn();s.push({name:n,expected:c,observed:null,passed:false})}catch(e){const o=err(e);s.push({name:n,expected:c,observed:o,passed:o===c})}};const pass=(n,fn)=>{try{fn();s.push({name:n,expected:'PASS',observed:'PASS',passed:true})}catch(e){s.push({name:n,expected:'PASS',observed:err(e),passed:false})}};
  pass('baseline-model',()=>validateModel(m));pass('integrated-shadow-status',()=>{const x=integratedStatus(m);eq(x.authority,'SHADOW_ONLY','SHADOW')});pass('integrity-classification-blocked',()=>{const x=classifyReceiptTrustForPromotion(m,'INTEGRITY_ONLY');ok(!x.usable,'EXPECTED_BLOCK')});
  reject('integrity-added-to-promotion-list','PROMOTION_TRUST_CLASSES',()=>{const x=structuredClone(m);x.acceptedPromotionTrustClasses=['INTEGRITY_ONLY'];validateModel(x)});
  reject('receipt-trust-upgrade','CHILD_RECEIPT_TRUST',()=>{const x=structuredClone(m);x.children.receiptKernel.trustClass='AUTHENTICATED';validateModel(x)});
  reject('receipt-ceiling-upgrade','RECEIPT_CEILING',()=>{const x=structuredClone(m);x.currentReceiptAuthorityCeiling='PROMOTION_ELIGIBLE';validateModel(x)});
  reject('integration-ceiling-upgrade','CEILING',()=>{const x=structuredClone(m);x.authorityCeiling='CANONICAL_AUTHORITY';validateModel(x)});
  reject('promotion-mode-bypass','PROMOTION_MODE',()=>{const x=structuredClone(m);x.promotionMode='ENABLED';validateModel(x)});
  reject('state-status-upgrade','CHILD_STATUS',()=>{const x=structuredClone(m);x.children.stateContract.status='CLEANROOM_PASS';validateModel(x)});
  reject('receipt-status-upgrade','CHILD_STATUS',()=>{const x=structuredClone(m);x.children.receiptKernel.status='CLEANROOM_PASS';validateModel(x)});
  reject('state-implementation-drift','STATE_CHILD_REF',()=>{const x=structuredClone(m);x.children.stateContract.implementationSha='f'.repeat(40);validateModel(x)});
  reject('receipt-implementation-drift','RECEIPT_CHILD_REF',()=>{const x=structuredClone(m);x.children.receiptKernel.implementationSha='f'.repeat(40);validateModel(x)});
  reject('state-evidence-drift','STATE_CHILD_REF',()=>{const x=structuredClone(m);x.children.stateContract.evidenceBlobSha='f'.repeat(40);validateModel(x)});
  reject('receipt-evidence-drift','RECEIPT_CHILD_REF',()=>{const x=structuredClone(m);x.children.receiptKernel.evidenceBlobSha='f'.repeat(40);validateModel(x)});
  reject('source-parent-drift','PARENT',()=>{const x=structuredClone(m);x.sourceParentSha='f'.repeat(40);validateModel(x)});
  pass('future-unknown-trust-remains-blocked',()=>{const x=classifyReceiptTrustForPromotion(m,'FUTURE_SIGNED');ok(!x.usable,'FUTURE_BLOCK')});
  const failed=s.filter(x=>!x.passed);return {passed:failed.length===0,total:s.length,failed:failed.length,scenarios:s};
}
async function main(){const m=JSON.parse(await readFile(MODEL,'utf8'));let validation;try{validateModel(m);validation={passed:true,errors:[]}}catch(e){validation={passed:false,errors:[{code:err(e),detail:e.detail??String(e)}]}};const report={validation,status:validation.passed?integratedStatus(m):null};if(process.argv.includes('--self-test'))report.selfTest=selfTests(m);report.passed=validation.passed&&(!report.selfTest||report.selfTest.passed);process.stdout.write(`${JSON.stringify(report,null,2)}\n`);process.exitCode=report.passed?0:1}
main().catch(e=>{process.stderr.write(`${JSON.stringify({passed:false,fatal:{code:err(e),detail:e.detail??String(e)}},null,2)}\n`);process.exitCode=1});
