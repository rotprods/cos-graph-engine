import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = '.github/workflows';
const files = readdirSync(dir).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'));
assert.ok(files.length >= 9, 'expected inherited workflow inventory');

const forbiddenCommands = [
  /docker\/login-action/i,
  /push:\s*true/i,
  /packages:\s*write/i,
  /\bkubectl\b/i,
  /\bnpm\s+publish\b/i,
  /\bgit\s+push\b/i,
  /action-gh-release/i,
];

for (const name of files) {
  const text = readFileSync(join(dir, name), 'utf8');
  for (const pattern of forbiddenCommands) {
    assert.ok(!pattern.test(text), `${name} contains forbidden convergence side effect: ${pattern}`);
  }
  if (name === 'deploy.yml' || name === 'release.yml') {
    assert.match(text, /workflow_dispatch/);
    assert.match(text, /exit 1/);
  }
}

const canonical = readFileSync(join(dir, 'ci.yml'), 'utf8');
assert.match(canonical, /integration\/main-baseline-20260907/);
assert.match(canonical, /npm run coverage/);
assert.match(canonical, /docker build/);
assert.match(canonical, /test-auth-boundary\.cjs/);
assert.match(canonical, /test-memory-regressions\.cjs/);
assert.match(canonical, /test-wasm-extended\.ts/);
assert.match(canonical, /verify-ci-results\.mjs/);
console.log(`workflow safety PASS (${files.length} workflows)`);
