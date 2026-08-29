import assert from 'node:assert/strict';
import { mkdtemp, open, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AuthorityNodeFileHandleExecutorV2,
  type AuthorityFileHandleExecutionRequest,
  type AuthorityPinnedFileTarget,
} from '../packages/execution/src/authority-phase05-clean';

const T0 = '2026-08-29T15:00:00.000Z';
const T1 = '2026-08-29T15:01:00.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const directory = await mkdtemp(join(tmpdir(), 'cos-authority-handle-v2-'));
  const originalPath = join(directory, 'source.txt');
  const renamedPath = join(directory, 'renamed.txt');
  const handle = await open(originalPath, 'w+');
  try {
    await handle.writeFile('original', 'utf8');
    await handle.sync();

    const executor = new AuthorityNodeFileHandleExecutorV2(1024);
    const registrationHash = executor.register({
      handleToken: 'handle-token-1',
      handleHash: 'handle-hash-1',
      canonicalTargetUri: 'file://authority-root/source.txt',
      allowedOperations: ['read', 'write', 'append', 'stat'],
      fileHandle: handle,
      registeredAt: T0,
      expiresAt: T1,
      metadata: { broker: 'test-preopened-handle' },
    });
    check(registrationHash.length > 10, 'registration is content hashed');

    const firstRead = await executor.execute(request('read')) as { bodyBase64: string; size: number };
    check(Buffer.from(firstRead.bodyBase64, 'base64').toString('utf8') === 'original', 'read starts at offset zero');
    check(firstRead.size === 8, 'read returns exact bounded size');

    await rename(originalPath, renamedPath);
    const write = await executor.execute(request('write', {
      bodyBase64: Buffer.from('updated', 'utf8').toString('base64'),
      position: 0,
      truncateBeforeWrite: true,
    })) as { bytesWritten: number; position: number };
    check(write.bytesWritten === 7 && write.position === 0, 'write uses explicit position and syncs');
    check(await readFile(renamedPath, 'utf8') === 'updated', 'renamed inode is mutated without path reopen');

    const append = await executor.execute(request('append', {
      bodyBase64: Buffer.from('-tail', 'utf8').toString('base64'),
    })) as { position: number; bytesWritten: number };
    check(append.position === 7 && append.bytesWritten === 5, 'append resolves size inside the handle queue');
    check(await readFile(renamedPath, 'utf8') === 'updated-tail', 'append is deterministic');

    const secondRead = await executor.execute(request('read')) as { bodyBase64: string };
    check(Buffer.from(secondRead.bodyBase64, 'base64').toString('utf8') === 'updated-tail', 'subsequent read still begins at zero');
    const stat = await executor.execute(request('stat')) as { isFile: boolean; size: number };
    check(stat.isFile && stat.size === 12, 'stat consumes the registered handle');

    await assert.rejects(() => executor.execute({
      ...request('read'), target: { ...request('read').target, handleHash: 'tampered' },
    }), /HANDLE_HASH_MISMATCH/);
    assertions += 1;
    await assert.rejects(() => executor.execute({
      ...request('read'),
      context: { traceId: 'expired', metadata: { authorityEvaluatedAt: '2026-08-29T15:02:00.000Z' } },
    }), /HANDLE_EXPIRED/);
    assertions += 1;

    const registrations = executor.listRegistrations();
    registrations[0]!.allowedOperations.push('delete');
    check(!executor.listRegistrations()[0]?.allowedOperations.includes('delete'), 'registration listings are detached');

    await executor.close('handle-token-1');
    await assert.rejects(() => executor.execute(request('read')), /HANDLE_NOT_REGISTERED/);
    assertions += 1;
  } finally {
    try { await handle.close(); } catch { /* already closed */ }
    await rm(directory, { recursive: true, force: true });
  }

  console.log(`Authority Node FileHandle V2 clean contract: ${assertions} assertions passed`);
}

function request(operation: string, payload?: unknown): AuthorityFileHandleExecutionRequest {
  const target = {
    schemaVersion: 1,
    rootId: 'authority-root',
    operation,
    canonicalRootUri: 'file://authority-root',
    canonicalTargetUri: 'file://authority-root/source.txt',
    handleToken: 'handle-token-1',
    handleHash: 'handle-hash-1',
    symlinkPolicy: 'deny',
    decisionHash: 'file-decision-hash',
  } as unknown as AuthorityPinnedFileTarget;
  return {
    target,
    ...(payload === undefined ? {} : { payload }),
    ...(operation === 'read' || operation === 'stat' ? {} : { providerIdempotencyKey: 'provider-file-v1' }),
    context: {
      traceId: `trace-file-${operation}`,
      metadata: { authorityEvaluatedAt: '2026-08-29T15:00:30.000Z' },
    },
  };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
