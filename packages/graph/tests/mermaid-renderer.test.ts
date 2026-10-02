import { GraphvizRenderer, MermaidRenderer, VisualGraph } from '../src/level0-visual';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const graph: VisualGraph = {
  id: 'mermaid-regression',
  title: 'Graph "<demo>"',
  direction: 'TB',
  nodes: [
    { id: 'end', label: 'Finish "now" <safe>', type: 'end' },
    { id: 'a-b', label: 'A & B | first' },
    { id: 'a_b', label: 'A & B | second' },
  ],
  edges: [
    { id: 'edge-1', source: 'a-b', target: 'end', label: 'go | <fast> "now"' },
    { id: 'edge-2', source: 'a_b', target: 'end', label: 'return' },
  ],
};

const mermaid = new MermaidRenderer().render(graph);
assert(mermaid.startsWith('graph TB\n'), 'Mermaid output starts with a flowchart declaration');
assert(!mermaid.includes('title:'), 'Mermaid output does not emit invalid inline title syntax');
assert(mermaid.includes('n_end(('), 'Reserved end id is mapped to a safe Mermaid id');
assert(mermaid.includes('n_a_b[') && mermaid.includes('n_a_b_2['), 'Sanitized Mermaid ids remain unique after collision');
assert(mermaid.includes('&quot;') && mermaid.includes('&lt;') && mermaid.includes('&gt;'), 'Node and edge text is escaped');
assert(mermaid.includes('&amp;') && mermaid.includes('&#124;'), 'Ampersands and edge pipe characters are escaped');
assert(mermaid.includes('n_a_b-->|go &#124; &lt;fast&gt; &quot;now&quot;|n_end'), 'Edge uses mapped ids and escaped label');

const graphviz = new GraphvizRenderer().render(graph);
assert(graphviz.includes('end [label='), 'Graphviz renderer keeps original ids');
assert(graphviz.includes('a-b -> end'), 'Graphviz edges remain unchanged');

console.log('Mermaid renderer regression: 9 assertions passed');
