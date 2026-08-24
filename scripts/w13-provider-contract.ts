import { mkdirSync, writeFileSync } from 'node:fs';
import {
  CosHub,
  handleGitHubWebhook,
  mapGitHubWebhook,
  type GitHubWebhookEnvelope,
  type RepoEvent,
} from '../packages/hub/src';
import { InMemoryEventLog } from '../packages/runtime/src';

interface Fixture {
  name: string;
  expected: RepoEvent | null;
  envelope: GitHubWebhookEnvelope;
}

const repository = { full_name: 'rotprods/provider-fixture' };
const fixtures: Fixture[] = [
  {
    name: 'closed unmerged PR is not deployment',
    expected: null,
    envelope: {
      event: 'pull_request', deliveryId: 'provider-pr-unmerged', repository,
      action: 'closed', pull_request: { merged: false, merge_commit_sha: null },
    },
  },
  {
    name: 'merged PR is repository change only',
    expected: 'change',
    envelope: {
      event: 'pull_request', deliveryId: 'provider-pr-merged', repository,
      action: 'closed', pull_request: { merged: true, merge_commit_sha: 'fixture-sha' },
    },
  },
  {
    name: 'deployment success is explicit',
    expected: 'deployment_succeeded',
    envelope: {
      event: 'deployment_status', deliveryId: 'provider-deploy-success', repository,
      deployment_status: { state: 'success' },
    },
  },
  {
    name: 'workflow failure maps to build failure',
    expected: 'build_failed',
    envelope: {
      event: 'workflow_run', deliveryId: 'provider-workflow-failed', repository,
      workflow_run: { status: 'completed', conclusion: 'failure' },
    },
  },
];

async function main(): Promise<void> {
  const checks: Array<{ name: string; passed: boolean; detail?: string }> = [];
  for (const fixture of fixtures) {
    try {
      const actual = mapGitHubWebhook(fixture.envelope).mappedEvent;
      if (actual !== fixture.expected) {
        throw new Error(`expected=${String(fixture.expected)} actual=${String(actual)}`);
      }
      checks.push({ name: fixture.name, passed: true });
    } catch (error) {
      checks.push({
        name: fixture.name,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const eventLog = new InMemoryEventLog();
    const hub = new CosHub(eventLog);
    const envelope = fixtures[1].envelope;
    const first = await handleGitHubWebhook(hub, envelope);
    const duplicate = await handleGitHubWebhook(hub, envelope);
    if (!first.result?.applied) throw new Error('first delivery was not applied');
    if (!duplicate.result?.duplicate || duplicate.result.applied) {
      throw new Error('duplicate delivery was not suppressed');
    }
    // First provider observation produces two transitions (init + change). Each
    // transition has one command event and one explicit outcome event.
    if ((await eventLog.latestCursor()).sequence !== 4) {
      throw new Error('duplicate delivery changed event-log cursor');
    }
    const replay = await hub.replayRepoStates();
    if (replay.commands !== 2 || replay.outcomes !== 2 || replay.applied !== 2) {
      throw new Error('provider event command/outcome replay did not reproduce the projection');
    }
    checks.push({ name: 'GitHub delivery ID is idempotent and replayable', passed: true });
  } catch (error) {
    checks.push({
      name: 'GitHub delivery ID is idempotent and replayable',
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const failed = checks.filter(check => !check.passed);
  mkdirSync('artifacts/w13', { recursive: true });
  writeFileSync('artifacts/w13/provider-contract.json', JSON.stringify({ checks }, null, 2));
  for (const check of checks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
  if (failed.length) throw new Error(`Provider contract failed: ${failed.length}/${checks.length}`);
}

void main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
