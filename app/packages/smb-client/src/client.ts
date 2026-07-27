import type {
  MemoryNote,
  MemoryVersion,
  MemoryLock,
  AgentRegistration,
  QueueItem,
  SetNoteOptions,
  SMBClientConfig,
} from './types';
import { SMBError, SMBRateLimitError, SMBUnauthorizedError, SMBNotFoundError } from './errors';

/**
 * Shared Memory Bus Client
 *
 * Connect any project to the centralized shared memory bus.
 * All projects use this client to read/write shared state.
 */
export class SMBClient {
  private baseUrl: string;
  private token: string;
  private project: string;
  private timeout: number;

  constructor(config: SMBClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.project = config.project || 'default';
    this.timeout = config.timeout || 10000;
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Shared-Token': this.token,
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}/api/memory/${path}`, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        throw new SMBRateLimitError(data.resetAt);
      }
      if (res.status === 401 || res.status === 403) {
        throw new SMBUnauthorizedError();
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new SMBError(data.error || `HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      if (err instanceof SMBError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new SMBError('Request timed out', 408);
      }
      throw new SMBError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      clearTimeout(timer);
    }
  }

  // === CRUD ===

  async getNote(key: string): Promise<MemoryNote | null> {
    try {
      return await this.request<MemoryNote>('GET', `note/${encodeURIComponent(key)}`);
    } catch (err) {
      if (err instanceof SMBError && err.status === 404) return null;
      throw err;
    }
  }

  async setNote(key: string, value: string, opts?: SetNoteOptions): Promise<MemoryNote> {
    return this.request<MemoryNote>('POST', `note/${encodeURIComponent(key)}`, {
      value,
      ...(opts?.category ? { category: opts.category } : {}),
      ...(opts?.ttlSeconds ? { ttlSeconds: opts.ttlSeconds } : {}),
    });
  }

  async deleteNote(key: string): Promise<boolean> {
    try {
      await this.request<{ ok: boolean }>('DELETE', `note/${encodeURIComponent(key)}`);
      return true;
    } catch {
      return false;
    }
  }

  async listNotes(category?: string): Promise<MemoryNote[]> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request<MemoryNote[]>('GET', `notes${params}`);
  }

  async searchNotes(query: string, category?: string): Promise<MemoryNote[]> {
    const params = new URLSearchParams({ q: query });
    if (category) params.set('category', category);
    return this.request<MemoryNote[]>('GET', `notes/search?${params}`);
  }

  // === VERSIONING ===

  async listVersions(key: string): Promise<MemoryVersion[]> {
    return this.request<MemoryVersion[]>('GET', `note/${encodeURIComponent(key)}/versions`);
  }

  async rollbackVersion(key: string, version: number): Promise<MemoryNote> {
    return this.request<MemoryNote>('POST', `note/${encodeURIComponent(key)}/rollback`, { version });
  }

  // === LOCKS ===

  async acquireLock(key: string, ownerId: string, ttlSeconds = 30): Promise<boolean> {
    try {
      await this.request<{ ok: boolean }>('POST', `lock/${encodeURIComponent(key)}`, {
        ownerId, ttl: ttlSeconds,
      });
      return true;
    } catch {
      return false;
    }
  }

  async releaseLock(key: string, ownerId: string): Promise<boolean> {
    try {
      await this.request<{ ok: boolean }>('DELETE', `lock/${encodeURIComponent(key)}`, { ownerId });
      return true;
    } catch {
      return false;
    }
  }

  // === QUEUES ===

  async queuePush(queue: string, payload: string): Promise<QueueItem> {
    return this.request<QueueItem>('POST', `queue/${encodeURIComponent(queue)}`, { payload });
  }

  async queuePop(queue: string): Promise<QueueItem | null> {
    try {
      return await this.request<QueueItem>('POST', `queue/${encodeURIComponent(queue)}/pop`);
    } catch (err) {
      if (err instanceof SMBError && err.status === 404) return null;
      throw err;
    }
  }

  // === AGENTS ===

  async registerAgent(name: string, type: string): Promise<AgentRegistration> {
    return this.request<AgentRegistration>('POST', 'agents/register', { name, type, project: this.project });
  }

  async agentHeartbeat(id: string): Promise<void> {
    await this.request('POST', `agents/${id}/heartbeat`);
  }

  async listAgents(): Promise<AgentRegistration[]> {
    return this.request<AgentRegistration[]>('GET', 'agents');
  }

  // === HEALTH ===

  async health(): Promise<{ ok: boolean; healthy: boolean }> {
    return this.request('GET', 'health');
  }

  async fullHealthCheck(): Promise<{ ok: boolean; healthy: boolean; results: Record<string, unknown> }> {
    return this.request('GET', 'health-check');
  }
}