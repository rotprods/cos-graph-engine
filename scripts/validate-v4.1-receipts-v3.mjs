#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { errorCode } from '../control-plane/v4.1/kernel/receipt-canonical-v3.mjs';
import { validateModel } from '../control-plane/v4.1/kernel/receipt-verify-v3.mjs';
import { selfTests } from '../control-plane/v4.1/kernel/receipt-selftest-v3.mjs';

const MODEL='control-plane/v4.1/model/receipt-contract.v3.json';
async function main(){
  const model=JSON.parse(await readFile(MODEL,'utf8'));
  let validation;
  try{validateModel(model);validation={passed:true,errors:[]}}catch(error){validation={passed:false,errors:[{code:errorCode(error),detail:error.detail??String(error)}]}};
  const report={validation};
  if(process.argv.includes('--self-test')) report.selfTest=selfTests(model);
  report.passed=validation.passed&&(!report.selfTest||report.selfTest.passed);
  process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
  process.exitCode=report.passed?0:1;
}
main().catch(error=>{process.stderr.write(`${JSON.stringify({passed:false,fatal:{code:errorCode(error),detail:error.detail??String(error)}},null,2)}\n`);process.exitCode=1});
