// @cos/hub — entrada pública.
export { CosHub, RepoState, RepoEvent, LoadStats } from './hub';
export { HubQueries, RepoRow } from './query';
export { HubRAG, RAGHit, TfidfVectorizer, tokenize, normalizeToken } from './rag';
export { handleGitHubEvent, eventToRepoEvent, GitHubEvent } from './webhook';
export { loadEcosystemFile, loadEcosystemData, EcosystemGraph } from './ecosystem';
export { Store, JSONStore, MemoryStore, HubSnapshot } from './store';

// Conveniencia: construir un hub cargado desde un archivo de ecosistema.
import { CosHub } from './hub';
import { loadEcosystemFile } from './ecosystem';
import { Store } from './store';

export function createHub(ecosystemPath: string, store?: Store): CosHub {
  const hub = new CosHub(store);
  hub.loadEcosystem(loadEcosystemFile(ecosystemPath));
  hub.seedAgents();
  hub.seedWorkflow('ecosystem-watch', [
    { name: 'Webhook ingest', type: 'webhook', service: 'github' },
    { name: 'State update', type: 'action', service: 'cos-hub' },
    { name: 'Notify', type: 'notification', service: 'slack' },
  ]);
  return hub;
}