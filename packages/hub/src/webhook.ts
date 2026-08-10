// GitHub webhook handler: ingiere eventos (push/PR) y aplica transiciones de estado
// (L2) + parches realtime (GraphStream). Los eventos se prueban localmente con
// payloads simulados; la entrega en producción requiere un endpoint público.
import { CosHub, RepoEvent } from './hub';

export interface GitHubEvent {
  event: string; // 'push' | 'pull_request' ...
  repo: string;  // nombre del repo (p.ej. 'cos-graph-engine')
  action?: string;
}

export function eventToRepoEvent(ev: GitHubEvent): RepoEvent | null {
  switch (ev.event) {
    case 'push':
      return 'change';
    case 'pull_request':
      return ev.action === 'opened' || ev.action === 'synchronize' ? 'change' : ev.action === 'closed' ? 'deploy' : null;
    case 'deployment_status':
      return ev.action === 'success' ? 'deploy' : ev.action === 'failure' ? 'fail' : null;
    default:
      return null;
  }
}

export async function handleGitHubEvent(hub: CosHub, ev: GitHubEvent): Promise<{ applied: boolean; state?: string; event?: RepoEvent }> {
  const repoId = `R-${ev.repo}`;
  const repoEvent = eventToRepoEvent(ev);
  if (!repoEvent) return { applied: false };
  const ok = await hub.setRepoState(repoId, repoEvent);
  return { applied: ok, event: repoEvent, state: hub.getRepoState(repoId) || undefined };
}