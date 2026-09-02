from pathlib import Path

p = Path('packages/graph/src/visualizer.ts')
text = p.read_text()
old = """    case 'L7': {
      const engine = new ComputationalGraph();
      engine.buildMLP();
      return snapshotFromJSON(engine.toJSON(), engine.metrics());
    }"""
new = """    case 'L7': {
      const engine = new ComputationalGraph();
      engine.buildMLP();
      const json = engine.toJSON();
      return snapshotFromJSON(json, {
        nodeCount: json.nodes.length,
        edgeCount: json.edges.length,
        parameterCount: engine.paramCount(),
      });
    }"""
if old not in text:
    raise SystemExit('L7 visualizer anchor not found')
p.write_text(text.replace(old, new, 1))
