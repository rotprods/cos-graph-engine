#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  loadCoordinationKernel,
  runMutationSelfTests,
  validateCoordinationKernel,
} from './validate-v2-coordination-kernel.mjs';

const ROOT = process.cwd();
const EVIDENCE = path.join(ROOT, 'control-plane/v2/evidence/coordination-kernel');

async function main() {
  const args = process.argv.slice(2);
  const atIndex = args.indexOf('--at');
  const at = atIndex >= 0 ? args[atIndex + 1] : new Date().toISOString();
  const model = await loadCoordinationKernel();
  const baseline = validateCoordinationKernel(model, { at });
  if (!baseline.passed) {
    throw new Error(`Baseline coordination model failed: ${JSON.stringify(baseline.errors)}`);
  }
  const mutations = runMutationSelfTests(model, at);
  const assertions = [
    ['baseline valid', baseline.passed],
    ['all mutation tests rejected', mutations.every(item => item.passed)],
    ['ten or more adversarial scenarios', mutations.length >= 10],
    ['authority remains unassigned', model.refs.refs.find(ref => ref.refType === 'AuthorityRef')?.commitSha === null],
    ['incident correction retained', model.events.some(event => event.eventType === 'ESCAPED_FAILURE_DETECTED')],
    ['runtime remains NOT_RUN', model.context.unknowns.some(item => item.unknownId === 'unknown:runtime-build' && item.statement.includes('NOT_RUN'))],
  ];
  const failed = assertions.filter(([, passed]) => !passed).map(([name]) => name);
  const report = {
    schemaVersion: 2,
    testId: 'TST-V2-COORDINATION-KERNEL',
    generatedAt: new Date().toISOString(),
    evaluatedAt: at,
    executionRevision: process.env.COS_GIT_SHA ?? 'UNBOUND_LOCAL_EXECUTION',
    passed: failed.length === 0,
    assertions: assertions.map(([name, passed]) => ({ name, passed })),
    mutationTests: mutations,
    failures: failed,
    authorityEffect: 'CONTROL_PLANE_TEST_ONLY_NO_RUNTIME_OR_SCORE_PROMOTION',
  };
  const raw = JSON.stringify(report, null, 2) + '\n';
  report.reportHash = createHash('sha256').update(raw).digest('hex');
  if (args.includes('--write')) {
    await mkdir(EVIDENCE, { recursive: true });
    await writeFile(path.join(EVIDENCE, 'preflight-tests.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
