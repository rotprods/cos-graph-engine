/** A note stored in the shared memory bus */
export interface MemoryNote {
  id: string;
  key: string;
  value: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  ttl_expires_at: string | null;
  deleted_at: string | null;
}

/** A versioned snapshot of a note */
export interface MemoryVersion {
  id: string;
  note_id: string;
  key: string;
  value: string;
  category: string | null;
  version: number;
  created_at: string;
}

/** A distributed lock */
export interface MemoryLock {
  key: string;
  owner_id: string;
  acquired_at: string;
}

/** Agent registration */
export interface AgentRegistration {
  id: string;
  name: string;
  type: string;
  status: string;
  last_heartbeat: string;
}

/** Queue item */
export interface QueueItem {
  id: string;
  queue: string;
  payload: string;
  status: string;
  created_at: string;
}

/** Options for setting a note */
export interface SetNoteOptions {
  category?: string;
  ttlSeconds?: number;
}

/** SMB client configuration */
export interface SMBClientConfig {
  baseUrl: string;
  token: string;
  project?: string;
  timeout?: number;
}