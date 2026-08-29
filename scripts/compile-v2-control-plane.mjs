#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MODEL_DIR = path.join(ROOT, 'control-plane/v2/model');
const OUT_DIR = path.join(ROOT, 'control-plane/v2/generated');

async function readJson(name) {
  return JSON.parse(await readFile(path.join(MODEL_DIR, name), 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function projectView(graph, definition) {
  const nodeTypeFilter = definition.includeTypes ? new Set(definition.includeTypes) : null;
  const edgeTypeFilter = definition.includeEdgeTypes ? new Set(definition.includeEdgeTypes) : null;
  let nodes;
  let edges;

  if (nodeTypeFilter) {
    nodes = graph.nodes.filter(node => nodeTypeFilter.has(node.type));
    const nodeIds = new Set(nodes.map(node => node.id));
    edges = graph.edges.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  } else if (edgeTypeFilter) {
    edges = graph.edges.filter(edge => edgeTypeFilter.has(edge.type));
    const nodeIds = new Set(edges.flatMap(edge => [edge.from, edge.to]));
    nodes = graph.nodes.filter(node => nodeIds.has(node.id));
  } else {
    nodes = graph.nodes;
    edges = graph.edges;
  }

  nodes = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  edges = [...edges].sort((left, right) => left.id.localeCompare(right.id));
  const nodeIds = new Set(nodes.map(node => node.id));
  const hyperedges = graph.hyperedges
    .filter(edge => edge.members.every(member => nodeIds.has(member)))
    .sort((left, right) => left.id.localeCompare(right.id));
  const payload = {
    schemaVersion: 1,
    viewId: definition.id,
    sourceGraphId: graph.graphId,
    sourceGraphRevision: graph.revision,
    sourceRevision: graph.sourceRevision,
    eventWatermark: graph.eventWatermark,
    nodes,
    edges,
    hyperedges,
  };
  return { ...payload, projectionHash: hash(payload) };
}

function taskState(task) {
  if (['COMPLETE_STATIC_UNVERIFIED','IMPLEMENTED_UNVERIFIED'].includes(task.status)) return 'SATISFIED_STATIC';
  if (task.status === 'BLOCKED') return 'BLOCKED';
  if (task.status === 'SUPERSEDED') return 'SUPERSEDED';
  return 'OPEN';
}

function compileFrontier(program) {
  const byId = new Map(program.tasks.map(task => [task.id, task]));
  const satisfied = new Set(program.tasks
    .filter(task => ['COMPLETE_STATIC_UNVERIFIED','IMPLEMENTED_UNVERIFIED'].includes(task.status))
    .map(task => task.id));
  const tasks = program.tasks.map(task => {
    const unsatisfiedDependencies = task.dependencies.filter(dependency => !satisfied.has(dependency));
    const state = taskState(task);
    const executable = state === 'OPEN' && unsatisfiedDependencies.length === 0;
    return {
      taskId: task.id,
      objective: task.objective,
      phase: findPhase(program, task.id),
      state,
      executable,
      unsatisfiedDependencies,
      ownerType: task.ownerType,
      risk: task.risk,
      affectedFiles: task.affectedFiles,
    };
  }).sort((left, right) => left.taskId.localeCompare(right.taskId));

  const declared = new Set(program.currentExecutableFrontier ?? []);
  const compiled = new Set(tasks.filter(task => task.executable).map(task => task.taskId));
  const declaredButBlocked = [...declared].filter(id => !compiled.has(id));
  const compiledButUndeclared = [...compiled].filter(id => !declared.has(id));
  const payload = {
    schemaVersion: 1,
    programId: program.programId,
    sourceRevision: program.sourceRevision,
    tasks,
    executableTaskIds: [...compiled].sort(),
    declaredTaskIds: [...declared].sort(),
    declaredButBlocked,
    compiledButUndeclared,
  };
  return { ...payload, projectionHash: hash(payload) };
}

function findPhase(program, taskId) {
  for (const phase of program.phases) {
    if (phase.waves.some(wave => wave.tasks.includes(taskId))) return phase.id;
  }
  return null;
}

function compileArchitectureSummary(graph, program, gaps, decisions, checkpoints) {
  const p0 = gaps.gaps.filter(gap => gap.severity === 'P0' && !['SUPERSEDED','VERIFIED','EMPIRICALLY_QUALIFIED'].includes(gap.status));
  const currentPhase = program.phases.find(phase => phase.status === 'ACTIVE')
    ?? program.phases.find(phase => String(phase.status).startsWith('ACTIVE'));
  const activeCheckpoint = checkpoints.checkpoints.find(item => item.status === 'ACTIVE');
  const text = [
    '# COS V2 — Compiled Control-Plane Summary',
    '',
    `Source revision: \`${graph.sourceRevision}\``,
    `Event watermark: \`${graph.eventWatermark}\``,
    `Graph: ${graph.nodes.length} nodes · ${graph.edges.length} edges · ${graph.hyperedges.length} hyperedges`,
    `Program: ${program.phases.length} phases · ${program.tasks.length} tasks`,
    `Decisions: ${decisions.decisions.length}`,
    `Open P0 gaps: ${p0.length}`,
    `Current phase: ${currentPhase?.id ?? 'UNKNOWN'} — ${currentPhase?.name ?? 'UNKNOWN'}`,
    `Active checkpoint: ${activeCheckpoint?.id ?? 'UNKNOWN'} — ${activeCheckpoint?.name ?? 'UNKNOWN'}`,
    '',
    '## Authority boundary',
    '',
    'This output is a deterministic projection of machine-readable control-plane state.',
    'It is not runtime qualification and cannot promote Build, Assurance or Authority scores.',
    '',
    '## Open P0 gaps',
    '',
    ...p0.sort((a, b) => b.priority - a.priority).map(gap => `- ${gap.id} · ${gap.title} · owner: ${gap.owner} · phase: ${gap.phase}`),
    '',
    '## Next compiled executable frontier',
    '',
    ...(program.currentExecutableFrontier ?? []).map(id => {
      const task = program.tasks.find(item => item.id === id);
      return `- ${id} · ${task?.objective ?? 'UNKNOWN'}`;
    }),
    '',
  ].join('\n');
  return { text, hash: createHash('sha256').update(text).digest('hex') };
}

async function main() {
  const [graph, program, gaps, decisions, checkpoints] = await Promise.all([
    readJson('hypergraph.json'),
    readJson('program.json'),
    readJson('gaps.json'),
    readJson('decisions.json'),
    readJson('checkpoints.json'),
  ]);
  await mkdir(OUT_DIR, { recursive: true });

  const outputs = {};
  for (const definition of graph.viewDefinitions) {
    const view = projectView(graph, definition);
    const filename = `${definition.id}.graph.json`;
    await writeFile(path.join(OUT_DIR, filename), `${JSON.stringify(view, null, 2)}\n`, 'utf8');
    outputs[filename] = view.projectionHash;
  }

  const frontier = compileFrontier(program);
  await writeFile(path.join(OUT_DIR, 'execution-frontier.json'), `${JSON.stringify(frontier, null, 2)}\n`, 'utf8');
  outputs['execution-frontier.json'] = frontier.projectionHash;

  const summary = compileArchitectureSummary(graph, program, gaps, decisions, checkpoints);
  await writeFile(path.join(OUT_DIR, 'SUMMARY.md'), `${summary.text}\n`, 'utf8');
  outputs['SUMMARY.md'] = summary.hash;

  const manifestPayload = {
    schemaVersion: 1,
    compiler: 'scripts/compile-v2-control-plane.mjs',
    sourceRevision: graph.sourceRevision,
    eventWatermark: graph.eventWatermark,
    graphRevision: graph.revision,
    outputs: Object.fromEntries(Object.entries(outputs).sort(([a], [b]) => a.localeCompare(b))),
  };
  const manifest = { ...manifestPayload, manifestHash: hash(manifestPayload) };
  await writeFile(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
