import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { CSRGraph } from '../packages/graph/src/csr';
import { readWorkflow } from '../packages/graph/src/cli';
import { SVGGraphRenderer } from '../packages/visualization/src/svg-renderer';

function main(): void {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    throw new Error('Usage: tsx scripts/render-l0-svg.ts <workflow.json> <output.svg>');
  }

  const { data, level } = readWorkflow(input, true);
  if (level.toUpperCase() !== 'L0') {
    throw new Error(`Expected an L0 workflow, received ${level}`);
  }

  const graph = new CSRGraph();
  for (const node of data.nodes) graph.addNode({ id: node.id, label: node.label });
  for (const edge of data.edges) {
    graph.addEdge(edge.source, edge.target, { label: edge.type || edge.label || 'default' });
  }

  const svg = new SVGGraphRenderer().render(graph, { layout: 'tree', showEdgeLabels: true });
  const destination = path.resolve(output);
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temporary, svg, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, destination);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* No temporary file was created. */ }
    throw new Error(`Could not write SVG ${destination}: ${(error as Error).message}`);
  }
  console.log(`SVG written to ${output}`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
  process.exitCode = 1;
}
