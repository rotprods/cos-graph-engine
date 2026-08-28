import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface TestEvidenceManifest {
  schemaVersion: number;
  baselineCommit: string;
  authoritySuites: string[];
  authorityRunner: string;
  waiversFile: string;
}

interface TestWaiver {
  path: string;
  adr: string;
  reason: string;
  replacementEvidence: string[];
  rollback: string;
}

interface WaiverRegistry {
  schemaVersion: number;
  waivers: TestWaiver[];
}

const repoRoot = process.cwd();
const manifest = readJson<TestEvidenceManifest>('docs/hardening/TEST_EVIDENCE_MANIFEST.json');
const waivers = readJson<WaiverRegistry>(manifest.waiversFile);
const baseline = process.env.COS_LEGACY_TEST_BASE?.trim() || manifest.baselineCommit;
const head = process.env.COS_TEST_EVIDENCE_HEAD?.trim() || 'HEAD';

assertGitObject(baseline);
assertGitObject(head);

const baselinePaths = git(['ls-tree', '-r', '--name-only', baseline])
  .split('\n')
  .map(value => value.trim())
  .filter(Boolean);
const protectedLegacy = new Set(baselinePaths.filter(isLegacyEvidence));
if (protectedLegacy.size === 0) throw new Error(`No legacy tests discovered at baseline ${baseline}`);

const changes = parseNameStatus(git(['diff', '--name-status', baseline, head]));
const violations: string[] = [];
for (const change of changes) {
  const touchedLegacy = change.paths.filter(path => protectedLegacy.has(path));
  for (const path of touchedLegacy) {
    const waiver = waivers.waivers.find(candidate => candidate.path === path);
    if (!waiver) {
      violations.push(`${change.status}\t${path}\tmissing waiver`);
      continue;
    }
    validateWaiver(waiver, violations);
  }
}

for (const authorityPath of manifest.authoritySuites) {
  if (!existsSync(resolve(repoRoot, authorityPath))) {
    violations.push(`MISSING_AUTHORITY_SUITE\t${authorityPath}`);
  }
}

const packageJson = readJson<{ scripts?: Record<string, string> }>('package.json');
if (!packageJson.scripts?.['test:authority:reconciliation']) {
  violations.push('MISSING_AUTHORITY_RUNNER\tpackage.json#test:authority:reconciliation');
}
if (manifest.authorityRunner !== 'npm run test:authority:reconciliation') {
  violations.push(`MANIFEST_RUNNER_DRIFT\t${manifest.authorityRunner}`);
}

if (violations.length > 0) {
  console.error('Legacy test evidence gate FAILED');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log('Legacy test evidence gate PASS');
console.log(`  baseline=${baseline}`);
console.log(`  protectedLegacyFiles=${protectedLegacy.size}`);
console.log(`  authoritySuites=${manifest.authoritySuites.length}`);
console.log(`  waiversUsed=${changes.flatMap(change => change.paths).filter(path => waivers.waivers.some(waiver => waiver.path === path)).length}`);

function isLegacyEvidence(path: string): boolean {
  if (path.startsWith('scripts/test-authority-') || path.startsWith('scripts/w13-')) return false;
  if (path.startsWith('tests/') && path.endsWith('.ts')) return true;
  if (/^packages\/[^/]+\/tests\/.+\.ts$/.test(path)) return true;
  if (/^scripts\/test-.+\.ts$/.test(path)) return true;
  return false;
}

function parseNameStatus(output: string): Array<{ status: string; paths: string[] }> {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('\t');
      const status = parts.shift() || 'UNKNOWN';
      return { status, paths: parts.filter(Boolean) };
    });
}

function validateWaiver(waiver: TestWaiver, violations: string[]): void {
  if (!waiver.adr?.trim() || !existsSync(resolve(repoRoot, waiver.adr))) {
    violations.push(`INVALID_WAIVER_ADR\t${waiver.path}\t${waiver.adr || 'missing'}`);
  }
  if (!waiver.reason?.trim()) violations.push(`INVALID_WAIVER_REASON\t${waiver.path}`);
  if (!Array.isArray(waiver.replacementEvidence) || waiver.replacementEvidence.length === 0) {
    violations.push(`INVALID_WAIVER_EVIDENCE\t${waiver.path}`);
  }
  if (!waiver.rollback?.trim()) violations.push(`INVALID_WAIVER_ROLLBACK\t${waiver.path}`);
}

function assertGitObject(ref: string): void {
  try {
    git(['cat-file', '-e', `${ref}^{commit}`]);
  } catch {
    throw new Error(`Required git commit is unavailable: ${ref}`);
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')) as T;
}
