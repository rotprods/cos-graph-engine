#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const MODEL = path.join(ROOT, 'control-plane/v2/model');
const OUT = path.join(ROOT, 'control-plane/v2/generated');

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const digest = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const readJson = async file => JSON.parse(await readFile(path.join(ROOT, file), 'utf8'));

function project(graph, definition) {
  let nodes;
  let edges;
  if (definition.includeTypes) {
    const types = new Set(definition.includeTypes);
    nodes = graph.nodes.filter(node => types.has(node.type));
    const ids = new Set(nodes.map(node => node.id));
    edges = graph.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to));
  } else if (definition.includeEdgeTypes) {
    const types = new Set(definition.includeEdgeTypes);
    edges = graph.edges.filter(edge => types.has(edge.type));
    const ids = new Set(edges.flatMap(edge => [edge.from, edge.to]));
    nodes = graph.nodes.filter(node => ids.has(node.id));
  } else {
    nodes = graph.nodes;
    edges = graph.edges;
  }
  nodes = [...nodes].sort((a,b)=>a.id.localeCompare(b.id));
  edges = [...edges].sort((a,b)=>a.id.localeCompare(b.id));
  const ids = new Set(nodes.map(node=>node.id));
  const hyperedges = graph.hyperedges
    .filter(edge=>edge.members.every(member=>ids.has(member)))
    .sort((a,b)=>a.id.localeCompare(b.id));
  const payload = {schemaVersion:1,viewId:definition.id,sourceGraphId:graph.graphId,sourceGraphRevision:graph.revision,sourceRevision:graph.sourceRevision,eventWatermark:graph.eventWatermark,nodes,edges,hyperedges};
  return {...payload,projectionHash:digest(payload)};
}

function compileFrontier(program) {
  const satisfied = new Set(program.tasks.filter(task=>['COMPLETE_STATIC_UNVERIFIED','IMPLEMENTED_UNVERIFIED'].includes(task.status)).map(task=>task.id));
  const tasks = program.tasks.map(task=>{
    const unsatisfiedDependencies = task.dependencies.filter(dep=>!satisfied.has(dep));
    const state = satisfied.has(task.id) ? 'SATISFIED_STATIC' : task.status === 'BLOCKED' ? 'BLOCKED' : task.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'OPEN';
    return {taskId:task.id,objective:task.objective,phase:phaseOf(program,task.id),state,executable:state==='OPEN'&&unsatisfiedDependencies.length===0,unsatisfiedDependencies,ownerType:task.ownerType,risk:task.risk,affectedFiles:task.affectedFiles};
  }).sort((a,b)=>a.taskId.localeCompare(b.taskId));
  const payload={schemaVersion:1,programId:program.programId,sourceRevision:program.sourceRevision,tasks,executableTaskIds:tasks.filter(task=>task.executable).map(task=>task.taskId),declaredTaskIds:[...program.currentExecutableFrontier].sort()};
  payload.declaredButBlocked=payload.declaredTaskIds.filter(id=>!payload.executableTaskIds.includes(id));
  payload.compiledButUndeclared=payload.executableTaskIds.filter(id=>!payload.declaredTaskIds.includes(id));
  return {...payload,projectionHash:digest(payload)};
}

function phaseOf(program,taskId){for(const phase of program.phases)if(phase.waves.some(w=>w.tasks.includes(taskId)))return phase.id;return null;}

function summary(graph,program,gaps,decisions,checkpoints,frontier){
  const p0=gaps.gaps.filter(g=>g.severity==='P0'&&!['SUPERSEDED','VERIFIED','EMPIRICALLY_QUALIFIED'].includes(g.status)).sort((a,b)=>b.priority-a.priority);
  const activePhase=program.phases.find(p=>String(p.status).startsWith('ACTIVE'));
  const activeCheckpoint=checkpoints.checkpoints.find(c=>c.status==='ACTIVE');
  return [
    '# COS V2 — Compiled Control-Plane Summary','',
    `Source revision: \`${graph.sourceRevision}\``,
    `Event watermark: \`${graph.eventWatermark}\``,
    `Graph: ${graph.nodes.length} nodes · ${graph.edges.length} edges · ${graph.hyperedges.length} hyperedges`,
    `Program: ${program.phases.length} phases · ${program.tasks.length} tasks`,
    `Decisions: ${decisions.decisions.length}`,
    `Open P0 gaps: ${p0.length}`,
    `Current phase: ${activePhase?.id??'UNKNOWN'} — ${activePhase?.name??'UNKNOWN'}`,
    `Active checkpoint: ${activeCheckpoint?.id??'UNKNOWN'} — ${activeCheckpoint?.name??'UNKNOWN'}`,'',
    '## Authority boundary','',
    'This file is a deterministic projection. It cannot qualify runtime behavior or promote Build, Assurance or Authority.','',
    '## Open P0 gaps','',...p0.map(g=>`- ${g.id} · ${g.title} · owner: ${g.owner} · phase: ${g.phase}`),'',
    '## Compiled executable frontier','',...frontier.executableTaskIds.map(id=>{const task=program.tasks.find(t=>t.id===id);return `- ${id} · ${task?.objective??'UNKNOWN'}`;}),'',
  ].join('\n');
}

async function main(){
  const manifest=await readJson('control-plane/v2/model/MODEL_MANIFEST.json');
  const graph=await readJson(manifest.selected.hypergraph);
  const gaps=await readJson(manifest.selected.gaps);
  const decisions=await readJson(manifest.selected.decisions);
  const checkpoints=await readJson(manifest.selected.checkpoints);
  const module=await import(`${pathToFileURL(path.join(ROOT,manifest.selected.program)).href}?v=${Date.now()}`);
  const program=structuredClone(module.program??module.default);
  await mkdir(OUT,{recursive:true});
  const outputs={};
  for(const definition of graph.viewDefinitions){const value=project(graph,definition);const name=`${definition.id}.graph.json`;await writeFile(path.join(OUT,name),`${JSON.stringify(value,null,2)}\n`);outputs[name]=value.projectionHash;}
  const frontier=compileFrontier(program);await writeFile(path.join(OUT,'execution-frontier.json'),`${JSON.stringify(frontier,null,2)}\n`);outputs['execution-frontier.json']=frontier.projectionHash;
  const text=summary(graph,program,gaps,decisions,checkpoints,frontier);await writeFile(path.join(OUT,'SUMMARY.md'),`${text}\n`);outputs['SUMMARY.md']=createHash('sha256').update(text).digest('hex');
  const payload={schemaVersion:1,compiler:'scripts/compile-v2-control-plane-v2.mjs',sourceRevision:graph.sourceRevision,eventWatermark:graph.eventWatermark,graphRevision:graph.revision,outputs:Object.fromEntries(Object.entries(outputs).sort(([a],[b])=>a.localeCompare(b)))};
  const result={...payload,manifestHash:digest(payload)};
  await writeFile(path.join(OUT,'manifest.json'),`${JSON.stringify(result,null,2)}\n`);
  await writeFile(path.join(OUT,'program.json'),`${JSON.stringify(program,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}

main().catch(error=>{process.stderr.write(`${error instanceof Error?error.stack:String(error)}\n`);process.exitCode=1;});
