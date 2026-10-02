import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'mermaid-parser-bundle';
import { MermaidRenderer, VisualGraph } from '../packages/graph/src/level0-visual';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function check(name: string, graph: VisualGraph, nodes: number, edges: number): Promise<void> {
  const result = await parse(new MermaidRenderer().render(graph));
  assert(result.type === 'flowchart', `${name}: wrong diagram type ${result.type}`);
  assert(result.db.getVertices().size === nodes, `${name}: wrong node count`);
  assert(result.db.getEdges().length === edges, `${name}: wrong edge count`);
}

async function main(): Promise<void> {
  const workflow = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../examples/graph-workflow.json'), 'utf8'));
  const fixture: VisualGraph = {
    id: 'fixture', title: 'Graph', nodes: workflow.nodes,
    edges: workflow.edges.map((edge: any, index: number) => ({
      id: String(index), source: edge.source, target: edge.target, label: edge.type || edge.label,
    })),
  };
  await check('fixture', fixture, 3, 2);

  const escaping: VisualGraph = {
    id: 'escaping', title: 'Escaping',
    nodes: [
      { id: 'end', label: 'Finish "now" <safe>', type: 'end' },
      { id: 'a-b', label: 'A & B | first' },
      { id: 'a_b', label: 'A & B | second' },
    ],
    edges: [
      { id: 'one', source: 'a-b', target: 'end', label: 'go | <fast> "now"' },
      { id: 'two', source: 'a_b', target: 'end', label: 'return' },
    ],
  };
  await check('escaping', escaping, 3, 2);
  console.log('Mermaid parser: fixture and escaped-ID flowcharts passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
