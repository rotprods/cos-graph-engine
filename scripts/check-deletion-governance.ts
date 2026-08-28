import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface DeletionEntry {
  path: string;
  ledgerId: string;
  status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';
  reason: string;
  replacement: string;
  rollback: string;
  evidence: string[];
  adr?: string;
  generatedExemption?: boolean;
}

interface DeletionGovernance {
  schemaVersion: number;
  baselineCommit: string;
  deletionThresholdLines: number;
  entries: DeletionEntry[];
}

const root = process.cwd();
const governance = readJson<DeletionGovernance>('docs/hardening/DELETION_GOVERNANCE.json');
const base = process.env.COS_DELETION_BASE?.trim() || governance.baselineCommit;
const head = process.env.COS_DELETION_HEAD?.trim() || 'HEAD';
const requireAccepted = process.env.COS_DELETION_REQUIRE_ACCEPTED === 'true';

assertCommit(base);
assertCommit(head);
if (!Number.isSafeInteger(governance.deletionThresholdLines) || governance.deletionThresholdLines < 1) {
  throw new Error('deletionThresholdLines must be a positive safe integer');
}

const changes = git(['diff', '--numstat', base, head])
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)
  .map(line => {
    const [addedRaw, deletedRaw, ...pathParts] = line.split('\t');
    return {
      added: addedRaw === '-' ? null : Number(addedRaw),
      deleted: deletedRaw === '-' ? null : Number(deletedRaw),
      path: pathParts.join('\t'),
    };
  });

const violations: string[] = [];
for (const change of changes) {
  if (change.deleted === null || change.deleted < governance.deletionThresholdLines) continue;
  const entry = governance.entries.find(candidate => candidate.path === change.path);
  if (!entry) {
    violations.push(`${change.path}: ${change.deleted} deletions require a governance entry`);
    continue;
  }
  validateEntry(entry, change.deleted, violations);
  if (requireAccepted && entry.status !== 'ACCEPTED') {
    violations.push(`${change.path}: ledger ${entry.ledgerId} must be ACCEPTED for qualification; status=${entry.status}`);
  }
}

for (const entry of governance.entries) {
  if (entry.adr && !existsSync(resolve(root, entry.adr))) {
    violations.push(`${entry.path}: ADR path does not exist: ${entry.adr}`);
  }
}

if (violations.length > 0) {
  console.error('Deletion governance gate FAILED');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

const material = changes.filter(change => change.deleted !== null && change.deleted >= governance.deletionThresholdLines);
console.log('Deletion governance gate PASS');
console.log(`  base=${base}`);
console.log(`  head=${head}`);
console.log(`  threshold=${governance.deletionThresholdLines}`);
console.log(`  materialDeletionFiles=${material.length}`);

function validateEntry(entry: DeletionEntry, deleted: number, violations: string[]): void {
  if (!entry.ledgerId?.trim()) violations.push(`${entry.path}: missing ledgerId`);
  if (entry.status === 'REJECTED') violations.push(`${entry.path}: ledger ${entry.ledgerId} is REJECTED`);
  if (!entry.reason?.trim()) violations.push(`${entry.path}: missing reason`);
  if (!entry.replacement?.trim() && !entry.generatedExemption) violations.push(`${entry.path}: missing replacement/retirement decision`);
  if (!entry.rollback?.trim()) violations.push(`${entry.path}: missing rollback`);
  if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) violations.push(`${entry.path}: missing evidence plan`);
  if (deleted < governance.deletionThresholdLines) violations.push(`${entry.path}: invalid governance evaluation`);
}

function assertCommit(ref: string): void {
  try {
    git(['cat-file', '-e', `${ref}^{commit}`]);
  } catch {
    throw new Error(`Required git commit is unavailable: ${ref}`);
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;
}
