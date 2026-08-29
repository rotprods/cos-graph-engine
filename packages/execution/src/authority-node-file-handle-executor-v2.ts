import type { FileHandle } from 'node:fs/promises';
import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type {
  AuthorityFileHandleExecutionRequest,
  AuthorityFileHandleExecutor,
} from './authority-provider-tools';

export interface AuthorityNodeFileHandleRegistrationV2 {
  handleToken: string;
  handleHash: string;
  canonicalTargetUri: string;
  allowedOperations: string[];
  fileHandle: FileHandle;
  registeredAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export type AuthorityNodeFileHandleResultV2 =
  | {
      operation: 'read';
      bodyBase64: string;
      size: number;
      handleHash: string;
      canonicalTargetUri: string;
    }
  | {
      operation: 'write' | 'create' | 'append';
      bytesWritten: number;
      position: number;
      synced: true;
      providerIdempotencyKey: string;
      handleHash: string;
      canonicalTargetUri: string;
    }
  | {
      operation: 'stat';
      size: number;
      mode: number;
      modifiedAt: string;
      isFile: boolean;
      isDirectory: boolean;
      handleHash: string;
      canonicalTargetUri: string;
    };

interface RegisteredHandleV2 {
  handleToken: string;
  handleHash: string;
  canonicalTargetUri: string;
  allowedOperations: Set<string>;
  fileHandle: FileHandle;
  registeredAt: string;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  registrationHash: string;
  inFlight: Promise<void>;
  closed: boolean;
}

/**
 * Position-deterministic opaque FileHandle executor.
 *
 * It never opens/reopens a path. A trusted native broker must atomically open
 * and verify the handle before registration. Reads use explicit offset 0;
 * append resolves the current size under the per-handle operation queue; writes
 * loop until every requested byte is accepted before fsync.
 */
export class AuthorityNodeFileHandleExecutorV2 implements AuthorityFileHandleExecutor {
  private readonly handles = new Map<string, RegisteredHandleV2>();

  constructor(private readonly maxReadBytes = 10_000_000) {
    if (!Number.isSafeInteger(maxReadBytes) || maxReadBytes < 1 || maxReadBytes > 100_000_000) {
      throw new Error('maxReadBytes must be a safe integer in [1,100000000]');
    }
  }

  register(input: AuthorityNodeFileHandleRegistrationV2): string {
    const handleToken = nonEmpty(input.handleToken, 'handleToken');
    const handleHash = nonEmpty(input.handleHash, 'handleHash');
    const canonicalTargetUri = nonEmpty(input.canonicalTargetUri, 'canonicalTargetUri');
    const allowedOperations = new Set(
      input.allowedOperations.map(operation => nonEmpty(operation, 'allowed operation')),
    );
    if (allowedOperations.size === 0) throw new Error('allowedOperations must not be empty');
    const registeredAt = canonicalTime(input.registeredAt, 'registeredAt');
    const expiresAt = input.expiresAt === undefined || input.expiresAt === null
      ? null
      : canonicalTime(input.expiresAt, 'expiresAt');
    if (expiresAt !== null && Date.parse(expiresAt) <= Date.parse(registeredAt)) {
      throw new Error('expiresAt must be after registeredAt');
    }
    const metadata = canonicalClone(input.metadata ?? {}, 'file handle metadata');
    const registrationHash = canonicalHash128({
      handleToken,
      handleHash,
      canonicalTargetUri,
      allowedOperations: Array.from(allowedOperations).sort(),
      registeredAt,
      expiresAt,
      metadata,
    });
    const existing = this.handles.get(handleToken);
    if (existing) {
      if (existing.registrationHash !== registrationHash || existing.fileHandle !== input.fileHandle) {
        throw new Error(`AUTHORITY_FILE_HANDLE_TOKEN_COLLISION token=${handleToken}`);
      }
      return registrationHash;
    }
    this.handles.set(handleToken, {
      handleToken,
      handleHash,
      canonicalTargetUri,
      allowedOperations,
      fileHandle: input.fileHandle,
      registeredAt,
      expiresAt,
      metadata,
      registrationHash,
      inFlight: Promise.resolve(),
      closed: false,
    });
    return registrationHash;
  }

  async execute(request: AuthorityFileHandleExecutionRequest): Promise<AuthorityNodeFileHandleResultV2> {
    const target = request.target;
    const registered = this.handles.get(target.handleToken);
    if (!registered || registered.closed) {
      throw new Error(`AUTHORITY_FILE_HANDLE_NOT_REGISTERED token=${target.handleToken}`);
    }
    if (registered.handleHash !== target.handleHash) {
      throw new Error('AUTHORITY_FILE_HANDLE_HASH_MISMATCH');
    }
    if (registered.canonicalTargetUri !== target.canonicalTargetUri) {
      throw new Error('AUTHORITY_FILE_HANDLE_URI_MISMATCH');
    }
    const operation = String(target.operation);
    if (!registered.allowedOperations.has(operation)) {
      throw new Error(`AUTHORITY_FILE_HANDLE_OPERATION_DENIED operation=${operation}`);
    }
    if (registered.expiresAt !== null) {
      const evaluatedAt = contextTime(request.context);
      if (Date.parse(evaluatedAt) > Date.parse(registered.expiresAt)) {
        throw new Error(`AUTHORITY_FILE_HANDLE_EXPIRED token=${target.handleToken}`);
      }
    }

    return this.enqueue(registered, async () => {
      if (operation === 'read') return this.read(registered);
      if (operation === 'stat') return this.stat(registered);
      if (operation === 'write' || operation === 'create' || operation === 'append') {
        return this.write(registered, operation, request);
      }
      throw new Error(`AUTHORITY_FILE_HANDLE_PLATFORM_OPERATION_UNSUPPORTED operation=${operation}`);
    });
  }

  async close(handleToken: string): Promise<void> {
    const token = nonEmpty(handleToken, 'handleToken');
    const registered = this.handles.get(token);
    if (!registered || registered.closed) return;
    await this.enqueue(registered, async () => {
      if (registered.closed) return;
      registered.closed = true;
      await registered.fileHandle.close();
    });
  }

  listRegistrations(): Array<{
    handleToken: string;
    handleHash: string;
    canonicalTargetUri: string;
    allowedOperations: string[];
    registeredAt: string;
    expiresAt: string | null;
    registrationHash: string;
    closed: boolean;
  }> {
    return Array.from(this.handles.values(), item => ({
      handleToken: item.handleToken,
      handleHash: item.handleHash,
      canonicalTargetUri: item.canonicalTargetUri,
      allowedOperations: Array.from(item.allowedOperations).sort(),
      registeredAt: item.registeredAt,
      expiresAt: item.expiresAt,
      registrationHash: item.registrationHash,
      closed: item.closed,
    })).sort((left, right) => left.handleToken.localeCompare(right.handleToken));
  }

  private async read(registered: RegisteredHandleV2): Promise<Extract<AuthorityNodeFileHandleResultV2, { operation: 'read' }>> {
    const stats = await registered.fileHandle.stat();
    if (!stats.isFile()) throw new Error('AUTHORITY_FILE_HANDLE_READ_REQUIRES_FILE');
    if (stats.size > this.maxReadBytes) {
      throw new Error(`AUTHORITY_FILE_HANDLE_READ_TOO_LARGE size=${stats.size}`);
    }
    const body = Buffer.alloc(stats.size);
    let offset = 0;
    while (offset < body.byteLength) {
      const read = await registered.fileHandle.read(
        body,
        offset,
        body.byteLength - offset,
        offset,
      );
      if (read.bytesRead === 0) break;
      offset += read.bytesRead;
    }
    const complete = body.subarray(0, offset);
    return {
      operation: 'read',
      bodyBase64: complete.toString('base64'),
      size: complete.byteLength,
      handleHash: registered.handleHash,
      canonicalTargetUri: registered.canonicalTargetUri,
    };
  }

  private async stat(registered: RegisteredHandleV2): Promise<Extract<AuthorityNodeFileHandleResultV2, { operation: 'stat' }>> {
    const stats = await registered.fileHandle.stat();
    return {
      operation: 'stat',
      size: stats.size,
      mode: stats.mode,
      modifiedAt: stats.mtime.toISOString(),
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      handleHash: registered.handleHash,
      canonicalTargetUri: registered.canonicalTargetUri,
    };
  }

  private async write(
    registered: RegisteredHandleV2,
    operation: 'write' | 'create' | 'append',
    request: AuthorityFileHandleExecutionRequest,
  ): Promise<Extract<AuthorityNodeFileHandleResultV2, { operation: 'write' | 'create' | 'append' }>> {
    const providerIdempotencyKey = nonEmpty(
      request.providerIdempotencyKey ?? '',
      'providerIdempotencyKey',
    );
    const payload = parseWritePayload(request.payload);
    if (payload.truncateBeforeWrite) await registered.fileHandle.truncate(0);
    const startingPosition = operation === 'append'
      ? (await registered.fileHandle.stat()).size
      : payload.position;
    let totalWritten = 0;
    while (totalWritten < payload.bytes.byteLength) {
      const write = await registered.fileHandle.write(
        payload.bytes,
        totalWritten,
        payload.bytes.byteLength - totalWritten,
        startingPosition + totalWritten,
      );
      if (write.bytesWritten <= 0) {
        throw new Error('AUTHORITY_FILE_HANDLE_ZERO_BYTE_WRITE');
      }
      totalWritten += write.bytesWritten;
    }
    await registered.fileHandle.sync();
    return {
      operation,
      bytesWritten: totalWritten,
      position: startingPosition,
      synced: true,
      providerIdempotencyKey,
      handleHash: registered.handleHash,
      canonicalTargetUri: registered.canonicalTargetUri,
    };
  }

  private enqueue<T>(registered: RegisteredHandleV2, operation: () => Promise<T>): Promise<T> {
    const result = registered.inFlight.then(operation);
    registered.inFlight = result.then(() => undefined, () => undefined);
    return result;
  }
}

function parseWritePayload(value: unknown): {
  bytes: Buffer;
  position: number;
  truncateBeforeWrite: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('authority file write payload must be an object');
  }
  const input = value as Record<string, unknown>;
  const bodyBase64 = nonEmpty(String(input.bodyBase64 ?? ''), 'bodyBase64');
  const bytes = Buffer.from(bodyBase64, 'base64');
  if (bytes.byteLength > 10_000_000) throw new Error('AUTHORITY_FILE_WRITE_TOO_LARGE');
  const position = input.position === undefined || input.position === null
    ? 0
    : Number(input.position);
  if (!Number.isSafeInteger(position) || position < 0) {
    throw new Error('authority file write position must be a non-negative safe integer');
  }
  return {
    bytes,
    position,
    truncateBeforeWrite: input.truncateBeforeWrite === true,
  };
}

function contextTime(context: AuthorityFileHandleExecutionRequest['context']): string {
  const value = context.metadata?.authorityEvaluatedAt;
  if (typeof value !== 'string') {
    throw new Error('AUTHORITY_FILE_HANDLE_TRUSTED_TIME_REQUIRED');
  }
  return canonicalTime(value, 'authorityEvaluatedAt');
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
