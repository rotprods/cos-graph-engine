import { stableHash128 } from '@cos/core';
import { CosHub, type RepoEvent, type RepoEventResult } from './hub';

export interface GitHubWebhookEnvelope {
  /** X-GitHub-Event */
  event: string;
  /** X-GitHub-Delivery — stable retry/idempotency identity */
  deliveryId: string;
  repository: {
    full_name: string;
    html_url?: string;
  };
  action?: string;
  pull_request?: {
    merged?: boolean;
    merge_commit_sha?: string | null;
  };
  deployment_status?: {
    state?: string;
  };
  workflow_run?: {
    conclusion?: string | null;
    status?: string;
  };
  sender?: { login?: string };
}

export interface GitHubWebhookDecision {
  mappedEvent: RepoEvent | null;
  reason: string;
}

/**
 * Semantic mapping deliberately distinguishes code lifecycle from deployment.
 * In particular: PR closed != merged, and merged != deployed.
 */
export function mapGitHubWebhook(envelope: GitHubWebhookEnvelope): GitHubWebhookDecision {
  switch (envelope.event) {
    case 'push':
      return { mappedEvent: 'change', reason: 'repository content changed' };

    case 'pull_request':
      if (envelope.action === 'opened' || envelope.action === 'synchronize' || envelope.action === 'reopened') {
        return { mappedEvent: 'change', reason: `pull request ${envelope.action}` };
      }
      if (envelope.action === 'closed' && envelope.pull_request?.merged) {
        return { mappedEvent: 'change', reason: 'merged code changed repository; deployment is a separate event' };
      }
      return { mappedEvent: null, reason: 'pull request event does not imply repository/deployment state transition' };

    case 'workflow_run': {
      const conclusion = envelope.workflow_run?.conclusion;
      if (conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'timed_out') {
        return { mappedEvent: 'build_failed', reason: `workflow conclusion=${conclusion}` };
      }
      if (conclusion === 'success') {
        return { mappedEvent: 'build_recovered', reason: 'workflow succeeded' };
      }
      return { mappedEvent: null, reason: 'workflow has no terminal conclusion' };
    }

    case 'deployment':
      return { mappedEvent: 'deployment_started', reason: 'deployment object created' };

    case 'deployment_status': {
      const state = envelope.deployment_status?.state;
      if (state === 'success') return { mappedEvent: 'deployment_succeeded', reason: 'deployment status success' };
      if (state === 'failure' || state === 'error') return { mappedEvent: 'deployment_failed', reason: `deployment status ${state}` };
      if (state === 'in_progress' || state === 'queued' || state === 'pending') {
        return { mappedEvent: 'deployment_started', reason: `deployment status ${state}` };
      }
      return { mappedEvent: null, reason: `unhandled deployment state ${String(state)}` };
    }

    default:
      return { mappedEvent: null, reason: `unsupported GitHub event '${envelope.event}'` };
  }
}

export async function handleGitHubWebhook(
  hub: CosHub,
  envelope: GitHubWebhookEnvelope,
): Promise<{ applied: boolean; decision: GitHubWebhookDecision; result?: RepoEventResult }> {
  const deliveryId = envelope.deliveryId.trim();
  const fullName = envelope.repository.full_name.trim().toLowerCase();
  if (!deliveryId) throw new Error('GitHub webhook requires deliveryId');
  if (!/^[^/]+\/[^/]+$/.test(fullName)) throw new Error(`Invalid repository full_name '${fullName}'`);

  const [owner, name] = fullName.split('/');
  let repo = hub.getRepository(fullName);
  if (!repo) {
    repo = hub.registerRepository(owner, name, { url: envelope.repository.html_url || null });
    // First observation materializes a PENDING repo into DEV before applying the
    // provider event. The init event itself is idempotent and separately auditable.
    await hub.applyRepoEvent(repo.id, 'init', {
      idempotencyKey: `github:${deliveryId}:init`,
      correlationId: `github:${deliveryId}`,
      sourceRef: `github-delivery:${deliveryId}`,
      actor: envelope.sender?.login,
      metadata: { providerEvent: envelope.event },
    });
  }

  const decision = mapGitHubWebhook(envelope);
  if (!decision.mappedEvent) return { applied: false, decision };

  const result = await hub.applyRepoEvent(repo.id, decision.mappedEvent, {
    idempotencyKey: `github:${deliveryId}:${decision.mappedEvent}`,
    correlationId: `github:${deliveryId}`,
    sourceRef: `github-delivery:${deliveryId}`,
    actor: envelope.sender?.login,
    metadata: {
      providerEvent: envelope.event,
      action: envelope.action || null,
      semanticMappingHash: stableHash128(decision),
    },
  });

  return { applied: result.applied, decision, result };
}
