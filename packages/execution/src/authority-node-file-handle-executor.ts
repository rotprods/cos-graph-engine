import type { FileHandle } from 'node:fs/promises';
import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type {
  AuthorityFileHandleExecutionRequest,
  AuthorityFileHandleExecutor,
} from './authority-provider-tools';

export interface AuthorityNodeFileHandleRegistration {
  handleToken: string;
  handleHash: string;
  canonicalTargetUri: string;
  allowedOperations: string[];
  fileHandle: FileHandle;
  registeredAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuthorityNodeFileReadResult {
  operation: 'read';
  bodyBase64: string;
  size: number;
  handleHash: string;
  canonicalTargetUri: string;
}

export interface AuthorityNodeFileWriteResult {
  operation: 'write' | 'create' | 'append';
  bytesWritten: number;
  position: number | null;
  synced: boolean;
  providerIdempotencyKey: string;
  handleHash: string;
  canonicalTargetUri: string;
}

export interface AuthorityNodeFileStatResult {
  operation: 'stat';
  size: number;
  mode: number;
  modifiedAt: string;
  isFile: boolean;
  isDirectory: boolean;
  handleHash: string;
  canonicalTargetUri: string;
}

interface RegisteredHandle {
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
 * Consumes broker-opened Node FileHandle objects without reopening any path.
 *
 * The trusted broker remains responsible for atomically opening and verifying
 * the handle (for example with openat/dirfd or an equivalent native primitive).
 * This executor only validates the opaque token/hash/URI binding and performs
 * bounded operations on the already-open handle.
 */
export class AuthorityNodeFileHandleExecutor implements AuthorityFileHandleExecutor {
  private readonly handles = new Map<string, RegisteredHandle>();

  constructor(private readonly maxReadBytes = 10_000_000) {
    if (!Number.isSafeInteger(maxReadBytes) || maxReadBytes < 1 || maxReadBytes > 100_000_000) {
      throw new Error('maxReadBytes must be a safe integer in [1,100000000]');
    }
  }

  register(input: AuthorityNodeFileHandleRegistration): string {
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

  async execute(request: AuthorityFileHandleExecutionRequest): Promise<unknown> {
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
    if (!registered.allowedOperations.has(target.operation)) {
      throw new Error(`AUTHORITY_FILE_HANDLE_OPERATION_DENIED operation=${target.operation}`);
    }
    if (registered.expiresAt !== null) {
      const evaluatedAt = contextTime(request.context);
      if (Date.parse(evaluatedAt) > Date.parse(registered.expiresAt)) {
        throw new Error(`AUTHORITY_FILE_HANDLE_EXPIRED token=${target.handleToken}`);
      }
    }

    return this.enqueue(registered, async () => {
      switch (target.operation) {
        case 'read':
          return this.read(registered);
        case 'stat':
          return this.stat(registered);
        case 'write':
        case 'create':
        case 'append':
          return this.write(registered, target.operation, request);
        default:
          throw new Error(
            `AUTHORITY_FILE_HANDLE_PLATFORM_OPERATION_UNSUPPORTED operation=${target.operation}`,
          );
      }
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

  private async read(registered: RegisteredHandle): Promise<AuthorityNodeFileReadResult> {
    const stats = await registered.fileHandle.stat();
    if (!stats.isFile()) throw new Error('AUTHORITY_FILE_HANDLE_READ_REQUIRES_FILE');
    if (stats.size > this.maxReadBytes) {
      throw new Error(`AUTHORITY_FILE_HANDLE_READ_TOO_LARGE size=${stats.size}`);
    }
    const body = await registered.fileHandle.readFile();
    if (body.byteLength > this.maxReadBytes) {
      throw new Error(`AUTHORITY_FILE_HANDLE_READ_TOO_LARGE size=${body.byteLength}`);
    }
    return {
      operation: 'read',
      bodyBase64: body.toString('base64'),
      size: body.byteLength,
      handleHash: registered.handleHash,
      canonicalTargetUri: registered.canonicalTargetUri,
    };
  }

  private async stat(registered: RegisteredHandle): Promise<AuthorityNodeFileStatResult> {
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
    registered: RegisteredHandle,
    operation: 'write' | 'create' | 'append',
    request: AuthorityFileHandleExecutionRequest,
  ): Promise<AuthorityNodeFileWriteResult> {
    const providerIdempotencyKey = nonEmpty(
      request.providerIdempotencyKey ?? '',
      'providerIdempotencyKey',
    );
    const payload = parseWritePayload(request.payload);
    if (operation === 'append' && payload.position !== null) {
      throw new Error('AUTHORITY_FILE_APPEND_POSITION_MUST_BE_NULL');
    }
    if (payload.truncateBeforeWrite) {
      // The handle was already opened and verified by the broker; no path lookup
      // occurs here. This mutation still relies on the outer durable side-effect
      // ledger for crash-window reconciliation.
      await registered.fileHandle.truncate(0);
    }
    const position = operation === 'append' ? null : payload.position;
    const result = await registered.fileHandle.write(payload.bytes, 0, payload.bytes.byteLength, position);
    await registered.fileHandle.sync();
    return {
      operation,
      bytesWritten: result.bytesWritten,
      position,
      synced: true,
      providerIdempotencyKey,
      handleHash: registered.handleHash,
      canonicalTargetUri: registered.canonicalTargetUri,
    };
  }

  private enqueue<T>(registered: RegisteredHandle, operation: () => Promise<T>): Promise<T> {
    const result = registered.inFlight.then(operation);
    registered.inFlight = result.then(() => undefined, () => undefined);
    return result;
  }
}

function parseWritePayload(value: unknown): {
  bytes: Buffer;
  position: number | null;
  truncateBeforeWrite: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('authority file write payload must be an object');
  }
  const input = value as Record<string, unknown>;
  const bodyBase64 = nonEmpty(String(input.bodyBase64 ?? ''), 'bodyBase64');
  const bytes = Buffer.from(bodyBase64, 'base64');
  if (bytes.byteLength > 10_000_000) {
    throw new Error('AUTHORITY_FILE_WRITE_TOO_LARGE');
  }
  const position = input.position === undefined || input.position === null
    ? null
    : Number(input.position);
  if (position !== null && (!Number.isSafeInteger(position) || position < 0)) {
    throw new Error('authority file write position must be null or a non-negative safe integer');
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
