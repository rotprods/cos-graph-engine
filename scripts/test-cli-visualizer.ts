// T-9.1 + T-9.2: Tests for CLI and Visualizer
// Tests: CLI help, list, info, demo, smb, pipeline, visualizer generation

import { graphCli } from '../packages/graph/src/cli';
import { generateVisualizer, generateVisualizerFile } from '../packages/graph/src/visualizer';
import * as fs from 'fs';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ FAIL: ${msg}`); } }

// Capture console output
const logs: string[] = [];
function captureLog() { logs.length = 0; }
function restoreLog() {}

async function captureCli(args: string[]): Promise<string[]> {
  logs.length = 0;
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: any[]) => logs.push(args.join(' '));
  console.error = (...args: any[]) => logs.push('[ERR] ' + args.join(' '));
  try {
    await graphCli(args);
  } catch (e: any) {
    logs.push('[EXCEPTION] ' + e.message);
  }
  console.log = origLog;
  console.error = origErr;
  return logs;
}

async function main() {
  console.log('\n=== CLI: Help Command ===');
  let logs = await captureCli(['help']);
  assert(logs.some(l => l.includes('COS Graph CLI')), 'Help shows CLI header');
  assert(logs.some(l => l.includes('list') && l.includes('info')), 'Help shows commands');

  console.log('\n=== CLI: List Command ===');
  logs = await captureCli(['list']);
  assert(logs.some(l => l.includes('L0')), 'List shows L0');
  assert(logs.some(l => l.includes('L19')), 'List shows L19');
  assert(logs.some(l => l.includes('ready')), 'List shows ready status');

  console.log('\n=== CLI: Info Command ===');
  logs = await captureCli(['info', '--level', 'L4']);
  assert(logs.some(l => l.includes('Call Graph')), 'Info shows Call Graph name');
  assert(logs.some(l => l.includes('L4')), 'Info shows L4 level');

  console.log('\n=== CLI: Demo Command ===');
  logs = await captureCli(['demo', '--level', 'L1']);
  assert(logs.some(l => l.includes('L1') || l.includes('Execution')), 'Demo shows L1 info');
  assert(logs.some(l => l.includes('Note') || l.includes('Valid')), 'Demo shows additional info');

  console.log('\n=== CLI: Pipeline Command ===');
  logs = await captureCli(['pipeline', '--name', 'L4L5L6']);
  assert(logs.some(l => l.includes('completed') || l.includes('Pipeline')), 'Pipeline runs');

  console.log('\n=== CLI: SMB List ===');
  logs = await captureCli(['smb', '--list']);
  assert(logs.some(l => l.includes('SMB')), 'SMB list shows header');

  console.log('\n=== CLI: Unknown Level Error ===');
  logs = await captureCli(['info', '--level', 'XX']);
  assert(logs.some(l => l.includes('Unknown level')), 'Unknown level shows error');

  console.log('\n=== CLI: Render ===');
  logs = await captureCli(['render', '--mermaid', 'true']);
  assert(logs.some(l => l.includes('Mermaid') || l.includes('Diagram')), 'Render shows diagram output');

  // ========== Visualizer Tests ==========
  console.log('\n=== Visualizer: HTML Generation ===');
  const html = generateVisualizer(['L0', 'L1']);
  assert(html.includes('<!DOCTYPE html>'), 'HTML has doctype');
  assert(html.includes('L0'), 'HTML includes L0');
  assert(html.includes('L1'), 'HTML includes L1');
  assert(html.includes('canvas'), 'HTML has canvas element');
  assert(html.includes('LEVELS'), 'HTML has LEVELS data');

  console.log('\n=== Visualizer: File Output ===');
  const outPath = '/tmp/cos-visualizer-test.html';
  const result = generateVisualizerFile(outPath, ['L0', 'L1', 'L2']);
  assert(fs.existsSync(result), 'Visualizer file exists');
  const content = fs.readFileSync(result, 'utf-8');
  assert(content.includes('L0'), 'File contains L0');
  assert(content.includes('L1'), 'File contains L1');
  assert(content.includes('L2'), 'File contains L2');
  try { fs.unlinkSync(result); } catch {}

  console.log('\n=== Visualizer: All 20 Levels ===');
  const htmlAll = generateVisualizer();
  const levelCount = (htmlAll.match(/"id":"L\d+"/g) || []).length;
  assert(levelCount >= 20, `All 20 levels present (found ${levelCount})`);

  // ========== REPORT ==========
  console.log(`\n=== Fase 9 CLI + Visualizer Tests ===`);
  console.log(`Passed: ${p}, Failed: ${f}`);
  if (f > 0) process.exit(1);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});