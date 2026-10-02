import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '..');
const fixture = path.join(repoRoot, 'examples', 'graph-workflow.json');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cos-graph-cli-'));

function runCli(args: string[]): { status: number | null; output: string } {
  const result = spawnSync('npm', ['run', 'cos:graph', '--', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, ''),
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function check(label: string, args: string[], expectedStatus: number, expectedText: string | string[]): void {
  const result = runCli(args);
  assert(result.status === expectedStatus, `${label}: expected exit ${expectedStatus}, got ${result.status}\n${result.output}`);
  const expectedTexts = Array.isArray(expectedText) ? expectedText : [expectedText];
  for (const text of expectedTexts) {
    assert(result.output.includes(text), `${label}: expected output to include ${JSON.stringify(text)}\n${result.output}`);
  }
}

const malformed = path.join(tempDir, 'malformed.json');
const unknown = path.join(tempDir, 'unknown.json');
const invalidShape = path.join(tempDir, 'invalid-shape.json');
const invalidRefs = path.join(tempDir, 'invalid-refs.json');
const renderOutput = path.join(tempDir, 'graph-workflow.mmd');
const labelOnly = path.join(tempDir, 'label-only.json');
const labelOnlyRenderOutput = path.join(tempDir, 'label-only.mmd');
const invalidRenderOutput = path.join(tempDir, 'invalid-render.mmd');
fs.writeFileSync(malformed, '{"level":"L0",', 'utf8');
fs.writeFileSync(unknown, '{"level":"L99"}', 'utf8');
fs.writeFileSync(invalidShape, '{"level":"L0","nodes":{},"edges":[]}', 'utf8');
fs.writeFileSync(invalidRefs, '{"level":"L0","nodes":[{"id":"a","label":"A"}],"edges":[{"source":"a","target":"missing"}]}', 'utf8');
fs.writeFileSync(labelOnly, '{"level":"L0","nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"source":"a","target":"b","label":"label-only"}]}', 'utf8');

try {
  check('success', ['exec', '--file', fixture], 0, ['Workflow executed.', '"nodeCount":3', '"edgeCount":2']);
  check('query node', ['query', '--file', fixture, '--node', 'process'], 0, ['Node process: Process', 'Incoming: 1', 'start -> process', 'Outgoing: 1', 'process -> end']);
  check('demo default mermaid', ['render'], 0, ['Mermaid Diagram:', 'graph TB']);
  check('demo graphviz format', ['render', '--format', 'graphviz'], 0, ['Graphviz DOT:', 'digraph "Demo Graph"']);
  check('demo ascii format', ['render', '--format', 'ascii'], 0, ['ASCII Diagram:', 'Start', 'Process']);
  check('missing --file', ['exec'], 1, '--file is required');
  check('missing file', ['exec', '--file', path.join(tempDir, 'missing.json')], 1, 'File not found');
  check('malformed JSON', ['exec', '--file', malformed], 1, 'Invalid JSON');
  check('unknown level', ['exec', '--file', unknown], 1, 'Unknown level: L99');
  check('query missing node', ['query', '--file', fixture, '--node', 'missing'], 1, 'Node not found: missing');
  check('invalid shape', ['exec', '--file', invalidShape], 1, 'nodes must be an array');
  check('invalid edge reference', ['exec', '--file', invalidRefs], 1, 'target must reference an existing node');
  check('render input', ['render', '--file', fixture, '--format', 'mermaid', '--output', renderOutput], 0, 'Written to');
  assert(fs.existsSync(renderOutput), 'render input: output file was not created');
  const rendered = fs.readFileSync(renderOutput, 'utf8');
  assert(rendered.includes('start') && rendered.includes('process') && rendered.includes('end'), 'render input: output is missing fixture nodes');
  assert(rendered.includes('n_start-->|enter|n_process') && rendered.includes('n_process-->|complete|n_end'), 'render input: output is missing fixture edges');
  check('label-only exec', ['exec', '--file', labelOnly], 0, ['Workflow executed.', '"edgeCount":1']);
  check('label-only query', ['query', '--file', labelOnly, '--node', 'b'], 0, 'a -> b (label-only)');
  check('label-only render', ['render', '--file', labelOnly, '--format', 'mermaid', '--output', labelOnlyRenderOutput], 0, 'Written to');
  const labelOnlyRendered = fs.readFileSync(labelOnlyRenderOutput, 'utf8');
  assert(labelOnlyRendered.includes('n_a-->|label-only|n_b'), 'label-only render: output lost the edge label');
  check('invalid render validation', ['render', '--file', invalidRefs, '--format', 'mermaid', '--output', invalidRenderOutput], 1, 'target must reference an existing node');
  assert(!fs.existsSync(invalidRenderOutput), 'invalid render validation: output file was created');
  check('invalid render output', ['render', '--file', fixture, '--format', 'mermaid', '--output', path.join(tempDir, 'missing-dir', 'graph.mmd')], 1, 'Could not write render output');
  console.log('CLI exec/query/render behavior: 18 scenarios passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
