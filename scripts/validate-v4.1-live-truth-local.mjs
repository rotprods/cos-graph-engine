#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { selfTests } from '../control-plane/v4.1/observe/live-truth-selftest.mjs';

const MODEL='control-plane/v4.1/observe/live-truth-contract.v1.json';
const EXPECTED_PARENT='7943a4ef67dfc0929f56e2652126d4b7a6d89eae';
const EXPECTED_REASONS=['HEAD_SHA_UNAVAILABLE','DETACHED_HEAD','TARGET_REF_UNAVAILABLE_LOCALLY','ORIGIN_HEAD_UNAVAILABLE','WORKTREE_STATUS_UNAVAILABLE','WORKTREE_STATUS_WITHHELD_UNSAFE_REPO_CONFIG','WORKTREE_STATUS_WITHHELD_CONFIG_SCAN_FAILED'];
function validateModel(m){
  if(m.schemaVersion!==1)throw Object.assign(new Error('MODEL_SCHEMA'),{code:'MODEL_SCHEMA'});
  if(m.contractId!=='cos_repo_assurance_v4_1_live_truth_local')throw Object.assign(new Error('MODEL_ID'),{code:'MODEL_ID'});
  if(m.sourceParentSha!==EXPECTED_PARENT)throw Object.assign(new Error('MODEL_PARENT'),{code:'MODEL_PARENT'});
  if(m.authorityCeiling!=='SHADOW_ONLY'||m.trustClass!=='INTEGRITY_ONLY'||m.observationMode!=='READ_ONLY_LOCAL_GIT')throw Object.assign(new Error('MODEL_TRUST'),{code:'MODEL_TRUST'});
  if(JSON.stringify(m.fieldStates)!==JSON.stringify(['OBSERVED','UNKNOWN']))throw Object.assign(new Error('MODEL_STATES'),{code:'MODEL_STATES'});
  if(JSON.stringify(m.unknownReasons)!==JSON.stringify(EXPECTED_REASONS))throw Object.assign(new Error('MODEL_UNKNOWN_REASONS'),{code:'MODEL_UNKNOWN_REASONS'});
  if(m.security.shell!==false||m.security.network!==false||m.security.inheritFullEnvironment!==false||m.security.optionalLocks!==false||m.security.fsmonitor!==false||m.security.gitBinary!=='/usr/bin/git')throw Object.assign(new Error('MODEL_SECURITY'),{code:'MODEL_SECURITY'});
  return true;
}
async function main(){const model=JSON.parse(await readFile(MODEL,'utf8'));let validation;try{validateModel(model);validation={passed:true,errors:[]}}catch(e){validation={passed:false,errors:[{code:e.code??'UNEXPECTED'}]}};const report={validation};if(process.argv.includes('--self-test'))report.selfTest=await selfTests();report.passed=validation.passed&&(!report.selfTest||report.selfTest.passed);process.stdout.write(`${JSON.stringify(report,null,2)}\n`);process.exitCode=report.passed?0:1}
main().catch(e=>{process.stderr.write(`${JSON.stringify({passed:false,fatal:{code:e.code??'UNEXPECTED',detail:String(e)}},null,2)}\n`);process.exitCode=1});
