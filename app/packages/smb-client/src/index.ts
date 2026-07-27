export { SMBClient } from './client';
export type { SMBClientConfig } from './types';
export type {
  MemoryNote,
  MemoryVersion,
  MemoryLock,
  AgentRegistration,
  QueueItem,
  SetNoteOptions,
} from './types';
export {
  SMBError,
  SMBRateLimitError,
  SMBUnauthorizedError,
  SMBNotFoundError,
} from './errors';