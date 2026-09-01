#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { errorCode } from '../control-plane/v4.1/kernel/receipt-canonical.mjs';
import { validateModel } from '../control-plane/v4.1/kernel/receipt-verify.mjs';
import { selfTests } from '../control-plane/v4.1/kernel/receipt-selftest.mjs';

const MODEL_PATH = 'control-plane/v4.1/model/receipt-contract.v1.json';

async function main() {
  const model = JSON.parse(await readFile(MODEL_PATH, 'utf8'));
  validateModel(model);
  const report = process.argv.includes('--self-test')
    ? selfTests(model)
    : { passed: true, total: 0, failed: 0, scenarios: [] };
  process.stdout.write(`${JSON.stringify({ model: 'PASS', selfTest: report, passed: report.passed }, null, 2)}\n`);
  process.exitCode = report.passed ? 0 : 1;
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify({ passed: false, fatal: { code: errorCode(error), detail: String(error.message ?? error) } }, null, 2)}\n`);
  process.exitCode = 1;
});
