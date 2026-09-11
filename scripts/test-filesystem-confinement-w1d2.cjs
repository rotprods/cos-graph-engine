const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const { FileSystemTool } = await import('../packages/execution/src/tool-runtime.ts');
  const context = { traceId: 'w1d2-filesystem-confinement' };
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'cos-w1d2-'));
  const root = path.join(fixture, 'workspace');
  const outside = path.join(fixture, 'outside');
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(outside, { recursive: true });
  await fs.writeFile(path.join(outside, 'secret.txt'), 'outside-secret', 'utf8');

  function expectFailure(result, code) {
    assert.equal(result.success, false, `expected ${code} to fail closed`);
    assert.equal(result.error?.code, code, `expected ${code}, got ${result.error?.code}`);
  }

  try {
    // 1. Default construction carries zero ambient host filesystem authority.
    const unbound = new FileSystemTool();
    const unboundResult = await unbound.execute({ operation: 'read', path: path.join(outside, 'secret.txt') }, context);
    expectFailure(unboundResult, 'FS_AUTHORITY_UNBOUND');

    // 2. Explicit root permits ordinary relative operations within the workspace.
    const tool = new FileSystemTool({ root });
    const write = await tool.execute({ operation: 'write', path: 'nested/allowed.txt', content: 'allowed' }, context);
    assert.equal(write.success, true);
    assert.equal(await fs.readFile(path.join(root, 'nested', 'allowed.txt'), 'utf8'), 'allowed');

    const read = await tool.execute({ operation: 'read', path: 'nested/allowed.txt' }, context);
    assert.equal(read.success, true);
    assert.equal(read.output.content, 'allowed');

    const list = await tool.execute({ operation: 'list', path: 'nested' }, context);
    assert.equal(list.success, true);
    assert.equal(list.output.files.some(entry => entry.name === 'allowed.txt'), true);

    const exists = await tool.execute({ operation: 'exists', path: 'nested/allowed.txt' }, context);
    assert.equal(exists.success, true);
    assert.equal(exists.output.exists, true);

    // 3. Absolute paths and parent traversal are denied before any effect.
    const outsideWrite = path.join(outside, 'absolute-pwned.txt');
    const absolute = await tool.execute({ operation: 'write', path: outsideWrite, content: 'pwned' }, context);
    expectFailure(absolute, 'FS_SCOPE_VIOLATION');
    await assert.rejects(fs.stat(outsideWrite), error => error.code === 'ENOENT');

    const parentTraversal = await tool.execute({ operation: 'write', path: '../outside/traversal-pwned.txt', content: 'pwned' }, context);
    expectFailure(parentTraversal, 'FS_SCOPE_VIOLATION');
    await assert.rejects(fs.stat(path.join(outside, 'traversal-pwned.txt')), error => error.code === 'ENOENT');

    // 4. Directory symlink escape is denied for read/write/list/delete and causes zero outside mutation.
    await fs.symlink(outside, path.join(root, 'link-out'), 'dir');
    for (const operation of ['read', 'list', 'delete']) {
      const candidate = operation === 'list' ? 'link-out' : 'link-out/secret.txt';
      const result = await tool.execute({ operation, path: candidate }, context);
      expectFailure(result, 'FS_SCOPE_VIOLATION');
    }
    const symlinkWrite = await tool.execute({ operation: 'write', path: 'link-out/symlink-pwned.txt', content: 'pwned' }, context);
    expectFailure(symlinkWrite, 'FS_SCOPE_VIOLATION');
    await assert.rejects(fs.stat(path.join(outside, 'symlink-pwned.txt')), error => error.code === 'ENOENT');
    assert.equal(await fs.readFile(path.join(outside, 'secret.txt'), 'utf8'), 'outside-secret');

    // 5. Final-component symlinks are denied, including destructive operations.
    await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'secret-link'));
    for (const operation of ['read', 'write', 'delete']) {
      const payload = operation === 'write'
        ? { operation, path: 'secret-link', content: 'overwrite' }
        : { operation, path: 'secret-link' };
      const result = await tool.execute(payload, context);
      expectFailure(result, 'FS_SCOPE_VIOLATION');
    }
    assert.equal(await fs.readFile(path.join(outside, 'secret.txt'), 'utf8'), 'outside-secret');

    // 6. mkdtemp remains confined beneath an authorized relative directory.
    await fs.mkdir(path.join(root, 'tmp'), { recursive: true });
    const tempResult = await tool.execute({ operation: 'mkdtemp', path: 'tmp' }, context);
    assert.equal(tempResult.success, true);
    const relativeTemp = tempResult.output.path;
    assert.equal(path.isAbsolute(relativeTemp), false, 'tool must not expose an absolute host path');
    const createdReal = await fs.realpath(path.join(root, relativeTemp));
    const rootReal = await fs.realpath(root);
    assert.equal(createdReal.startsWith(`${rootReal}${path.sep}`), true);

    // 7. delete is allowed for ordinary in-root files and must not broaden authority.
    const deletion = await tool.execute({ operation: 'delete', path: 'nested/allowed.txt' }, context);
    assert.equal(deletion.success, true);
    await assert.rejects(fs.stat(path.join(root, 'nested', 'allowed.txt')), error => error.code === 'ENOENT');

    console.log('W1D.2 FileSystemTool confinement contract PASS — unbound, traversal, absolute, symlink, mutation and mkdtemp invariants');
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
