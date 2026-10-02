import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cos-svg-'));
const fixture = path.join(root, 'examples/graph-workflow.json');
const invalid = path.join(temp, 'invalid.json');
const output = path.join(temp, 'graph.svg');

function run(input: string, destination: string) {
  const result = spawnSync('npm', ['run', 'cos:svg', '--', input, destination], { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, text: `${result.stdout}${result.stderr}` };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

try {
  fs.writeFileSync(invalid, JSON.stringify({
    level: 'L0', nodes: [{ id: 'a', label: 'A' }], edges: [{ source: 'a', target: 'missing' }],
  }));
  fs.writeFileSync(output, 'previous SVG');

  const rejected = run(invalid, output);
  assert(rejected.status === 1 && rejected.text.includes('target must reference an existing node'), 'invalid edge must fail clearly');
  assert(fs.readFileSync(output, 'utf8') === 'previous SVG', 'invalid input must preserve previous output');

  const valid = run(fixture, output);
  assert(valid.status === 0, `valid workflow failed: ${valid.text}`);
  const svg = fs.readFileSync(output, 'utf8');
  assert(svg.startsWith('<svg') && svg.includes('enter') && svg.includes('complete'), 'valid SVG lost graph content');

  const unwritable = run(fixture, path.join(temp, 'missing-directory', 'graph.svg'));
  assert(unwritable.status === 1 && unwritable.text.includes('Could not write SVG'), 'output error must fail clearly');
  assert(fs.readdirSync(temp).every(name => !name.endsWith('.tmp')), 'failed write left a temporary file');
  console.log('SVG CLI: valid, invalid input, preserved output and write error passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
