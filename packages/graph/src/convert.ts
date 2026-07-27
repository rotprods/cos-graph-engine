/**
 * Import/Export Universal — T-19.1
 *
 * GraphML, GEXF, GDF, JSON, CSV, DOT
 * Migracion entre formatos: convert(input, 'graphml', 'dot')
 *
 * Zero dependencias externas.
 */

import { VisualNode, VisualEdge, VisualGraph } from './level0-visual';

// ============================================================
// GraphBuilder — construccion incremental de grafos
// ============================================================

export interface GraphBuilderNode {
  id: string;
  label: string;
  type?: string;
  color?: string;
  shape?: string;
  attrs?: Record<string, string>;
}

export interface GraphBuilderEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: string;
  color?: string;
  attrs?: Record<string, string>;
}

export interface GraphBuilderMeta {
  title?: string;
  direction?: string;
  attrs?: Record<string, string>;
}

export class GraphBuilder {
  nodes: GraphBuilderNode[] = [];
  edges: GraphBuilderEdge[] = [];
  title: string = '';

  addNode(node: GraphBuilderNode): void { this.nodes.push(node); }
  addEdge(edge: GraphBuilderEdge): void { this.edges.push(edge); }
  setTitle(title: string): void { this.title = title; }

  toVisualGraph(): VisualGraph {
    return {
      id: `graph-${Date.now()}`,
      title: this.title,
      nodes: this.nodes.map(n => ({
        id: n.id, label: n.label,
        type: n.type as any,
        color: n.color, shape: n.shape,
      })),
      edges: this.edges.map(e => ({
        id: e.id, source: e.source, target: e.target,
        label: e.label, style: e.style as any, color: e.color,
      })),
    };
  }
}

// ============================================================
// Formatos: definicion
// ============================================================

export type GraphFormat = 'graphml' | 'gexf' | 'gdf' | 'json' | 'csv' | 'dot';

export const FORMAT_NAMES: Record<GraphFormat, string> = {
  graphml: 'GraphML (XML-based graph format)',
  gexf: 'GEXF (Graph Exchange XML Format)',
  gdf: 'GDF (GUESS Graph Data Format)',
  json: 'JSON (COS native format)',
  csv: 'CSV (nodes.csv + edges.csv)',
  dot: 'DOT (Graphviz)',
};

export const FORMAT_EXTENSIONS: Record<GraphFormat, string[]> = {
  graphml: ['.graphml', '.xml'],
  gexf: ['.gexf'],
  gdf: ['.gdf'],
  json: ['.json'],
  csv: ['.csv'],
  dot: ['.dot', '.gv'],
};

// ============================================================
// Parser base
// ============================================================

export abstract class GraphParser {
  abstract format: GraphFormat;
  abstract parse(content: string): GraphBuilder;
  abstract serialize(graph: VisualGraph): string;

  protected escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  protected unescapeXml(s: string): string {
    return s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  }

  protected escapeCsv(s: string): string {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
}

// ============================================================
// GraphML Parser
// ============================================================

export class GraphMLParser extends GraphParser {
  format: GraphFormat = 'graphml';

  parse(content: string): GraphBuilder {
    const builder = new GraphBuilder();
    builder.setTitle('GraphML Import');

    // Extract node elements
    const nodeRegex = /<node\s+id="([^"]*)"(?:[^>]*)>([\s\S]*?)<\/node>/gi;
    let m: RegExpExecArray | null;
    while ((m = nodeRegex.exec(content)) !== null) {
      const id = this.unescapeXml(m[1]);
      const body = m[2];
      let label = id;
      const labelMatch = body.match(/<data\s+key="[^"]*">([\s\S]*?)<\/data>/i);
      if (labelMatch) label = this.unescapeXml(labelMatch[1].trim());
      builder.addNode({ id, label });
    }

    // Extract edge elements
    const edgeRegex = /<edge\s+(?:id="([^"]*)")?\s*source="([^"]*)"\s*target="([^"]*)"(?:[^>]*)>([\s\S]*?)<\/edge>/gi;
    while ((m = edgeRegex.exec(content)) !== null) {
      const id = m[1] || `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      builder.addEdge({ id, source: m[2], target: m[3] });
    }

    return builder;
  }

  serialize(graph: VisualGraph): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    xml += '  <key id="label" for="node" attr.name="label" attr.type="string"/>\n';
    xml += `  <graph id="G" edgedefault="${graph.direction === 'TB' || graph.direction === 'BT' ? 'directed' : 'undirected'}">\n`;
    for (const n of graph.nodes) {
      xml += `    <node id="${this.escapeXml(n.id)}">\n`;
      xml += `      <data key="label">${this.escapeXml(n.label)}</data>\n`;
      xml += '    </node>\n';
    }
    for (const e of graph.edges) {
      xml += `    <edge id="${this.escapeXml(e.id)}" source="${this.escapeXml(e.source)}" target="${this.escapeXml(e.target)}">\n`;
      if (e.label) xml += `      <data key="label">${this.escapeXml(e.label)}</data>\n`;
      xml += '    </edge>\n';
    }
    xml += '  </graph>\n';
    xml += '</graphml>\n';
    return xml;
  }
}

// ============================================================
// GEXF Parser
// ============================================================

export class GEXFParser extends GraphParser {
  format: GraphFormat = 'gexf';

  parse(content: string): GraphBuilder {
    const builder = new GraphBuilder();
    builder.setTitle('GEXF Import');

    // Extract nodes
    const nodeRegex = /<node\s+id="([^"]*)"(?:[^>]*)>([\s\S]*?)<\/node>/gi;
    let m: RegExpExecArray | null;
    while ((m = nodeRegex.exec(content)) !== null) {
      const id = this.unescapeXml(m[1]);
      const body = m[2];
      let label = id;
      const labelMatch = body.match(/<attvalue\s+[^>]*?value="([^"]*)"[^>]*\/?>/i)
        || body.match(/<label>([\s\S]*?)<\/label>/i);
      if (labelMatch) label = this.unescapeXml(labelMatch[1].trim());
      builder.addNode({ id, label });
    }

    // Extract edges (self-closing or with content)
    const edgeRegex = /<edge\s+(?:id="([^"]*)")?\s*source="([^"]*)"\s*target="([^"]*)"(?:[^>]*)\/?>(?:([\s\S]*?)<\/edge>)?/gi;
    while ((m = edgeRegex.exec(content)) !== null) {
      const id = m[1] || `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      builder.addEdge({ id, source: m[2], target: m[3] });
    }

    return builder;
  }

  serialize(graph: VisualGraph): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<gexf xmlns="http://gexf.net/1.3" version="1.3">\n';
    xml += '  <meta><creator>COS Graph Engine</creator><description>GEXF Export</description></meta>\n';
    xml += '  <graph mode="static" defaultedgetype="directed">\n';
    xml += '    <attributes class="node"><attribute id="label" title="Label" type="string"/></attributes>\n';
    xml += '    <nodes>\n';
    for (const n of graph.nodes) {
      xml += `      <node id="${this.escapeXml(n.id)}">\n`;
      xml += `        <attvalues><attvalue for="label" value="${this.escapeXml(n.label)}"/></attvalues>\n`;
      xml += '      </node>\n';
    }
    xml += '    </nodes>\n';
    xml += '    <edges>\n';
    for (const e of graph.edges) {
      xml += `      <edge id="${this.escapeXml(e.id)}" source="${this.escapeXml(e.source)}" target="${this.escapeXml(e.target)}" />\n`;
    }
    xml += '    </edges>\n';
    xml += '  </graph>\n';
    xml += '</gexf>\n';
    return xml;
  }
}

// ============================================================
// GDF Parser (GUESS format)
// ============================================================

export class GDFParser extends GraphParser {
  format: GraphFormat = 'gdf';

  parse(content: string): GraphBuilder {
    const builder = new GraphBuilder();
    builder.setTitle('GDF Import');

    const lines = content.split('\n').filter(l => l.trim());
    let section: 'none' | 'nodedef' | 'edgedef' = 'none';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('nodedef')) {
        section = 'nodedef';
        continue;
      }
      if (trimmed.toLowerCase().startsWith('edgedef')) {
        section = 'edgedef';
        continue;
      }
      if (section === 'nodedef') {
        const parts = trimmed.split(',');
        if (parts.length >= 1) {
          builder.addNode({ id: parts[0].trim(), label: parts[0].trim() });
        }
      }
      if (section === 'edgedef') {
        const parts = trimmed.split(',');
        if (parts.length >= 2) {
          const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          builder.addEdge({ id, source: parts[0].trim(), target: parts[1].trim() });
        }
      }
    }

    return builder;
  }

  serialize(graph: VisualGraph): string {
    let gdf = 'nodedef>name VARCHAR,label VARCHAR\n';
    for (const n of graph.nodes) {
      gdf += `${n.id},${this.escapeCsv(n.label)}\n`;
    }
    gdf += 'edgedef>node1 VARCHAR,node2 VARCHAR,label VARCHAR\n';
    for (const e of graph.edges) {
      gdf += `${e.source},${e.target},${this.escapeCsv(e.label || '')}\n`;
    }
    return gdf;
  }
}

// ============================================================
// JSON Parser (COS native)
// ============================================================

export class JSONParser extends GraphParser {
  format: GraphFormat = 'json';

  parse(content: string): GraphBuilder {
    const builder = new GraphBuilder();
    const data = JSON.parse(content);

    // Support both COS native format and generic
    const nodes = data.nodes || data.elements || [];
    const edges = data.edges || data.links || [];

    for (const n of nodes) {
      builder.addNode({
        id: n.id || n.name || String(Math.random()),
        label: n.label || n.name || n.id || '',
        type: n.type,
        color: n.color,
        shape: n.shape,
      });
    }

    for (const e of edges) {
      builder.addEdge({
        id: e.id || `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: e.source || e.from || e.u || '',
        target: e.target || e.to || e.v || '',
        label: e.label,
        style: e.style,
        color: e.color,
      });
    }

    if (data.title || data.name) builder.setTitle(data.title || data.name);
    return builder;
  }

  serialize(graph: VisualGraph): string {
    const obj: Record<string, unknown> = {
      title: graph.title,
      direction: graph.direction || 'TB',
      nodes: graph.nodes,
      edges: graph.edges,
    };
    return JSON.stringify(obj, null, 2);
  }
}

// ============================================================
// CSV Parser
// ============================================================

export class CSVParser extends GraphParser {
  format: GraphFormat = 'csv';

  parse(content: string): GraphBuilder {
    const builder = new GraphBuilder();
    const lines = content.split('\n').filter(l => l.trim());
    let section: 'nodes' | 'edges' = 'nodes';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect section headers
      if (line.toLowerCase().startsWith('source') || line.toLowerCase().startsWith('from')) {
        section = 'edges';
        continue;
      }
      if (line.toLowerCase().startsWith('id')) {
        section = 'nodes';
        continue;
      }

      const parts = this.parseCsvLine(line);
      if (parts.length < 2) continue;

      if (section === 'nodes') {
        builder.addNode({ id: parts[0], label: parts[1] || parts[0] });
      } else {
        builder.addEdge({
          id: `e-${i}`,
          source: parts[0],
          target: parts[1],
          label: parts[2] || '',
        });
      }
    }

    return builder;
  }

  serialize(graph: VisualGraph): string {
    let csv = 'id,label\n';
    for (const n of graph.nodes) {
      csv += `${this.escapeCsv(n.id)},${this.escapeCsv(n.label)}\n`;
    }
    csv += 'source,target,label\n';
    for (const e of graph.edges) {
      csv += `${this.escapeCsv(e.source)},${this.escapeCsv(e.target)},${this.escapeCsv(e.label || '')}\n`;
    }
    return csv;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }
}

// ============================================================
// DOT Parser (Graphviz)
// ============================================================

export class DOTParser extends GraphParser {
  format: GraphFormat = 'dot';

  parse(content: string): GraphBuilder {
    const builder = new GraphBuilder();
    builder.setTitle('DOT Import');

    // Extract graph title
    const titleMatch = content.match(/(?:digraph|graph)\s+(\w+)/);
    if (titleMatch) builder.setTitle(titleMatch[1]);

    // Extract node definitions: "id [label=...]"
    const nodeRegex = /(\w+)\s*\[([^\]]*)\]/g;
    let m: RegExpExecArray | null;
    while ((m = nodeRegex.exec(content)) !== null) {
      const id = m[1];
      const attrs = m[2];
      let label = id;
      const labelMatch = attrs.match(/label\s*=\s*"([^"]*)"/);
      if (labelMatch) label = labelMatch[1];
      builder.addNode({ id, label });
    }

    // Extract edges: "a -> b" or "a -- b"
    const edgeRegex = /(\w+)\s*(->|--)\s*(\w+)\s*(?:\[([^\]]*)\])?/g;
    while ((m = edgeRegex.exec(content)) !== null) {
      const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      builder.addEdge({
        id,
        source: m[1],
        target: m[3],
        label: m[4] ? (m[4].match(/label\s*=\s*"([^"]*)"/) || [])[1] || '' : '',
      });
    }

    return builder;
  }

  serialize(graph: VisualGraph): string {
    const isDirected = graph.direction !== 'LR' && graph.direction !== 'RL';
    let dot = isDirected ? 'digraph' : 'graph';
    dot += ` ${graph.title.replace(/[^a-zA-Z0-9_]/g, '_')} {\n`;
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box, style=rounded];\n\n';

    for (const n of graph.nodes) {
      dot += `  ${n.id} [label="${this.escapeXml(n.label)}"];\n`;
    }

    dot += '\n';
    for (const e of graph.edges) {
      const arrow = isDirected ? ' -> ' : ' -- ';
      if (e.label) {
        dot += `  ${e.source}${arrow}${e.target} [label="${this.escapeXml(e.label)}"];\n`;
      } else {
        dot += `  ${e.source}${arrow}${e.target};\n`;
      }
    }

    dot += '}\n';
    return dot;
  }
}

// ============================================================
// GraphConverter — universal converter
// ============================================================

export class GraphConverter {
  private parsers: Map<GraphFormat, GraphParser> = new Map();

  constructor() {
    this.register(new GraphMLParser());
    this.register(new GEXFParser());
    this.register(new GDFParser());
    this.register(new JSONParser());
    this.register(new CSVParser());
    this.register(new DOTParser());
  }

  private register(parser: GraphParser): void {
    this.parsers.set(parser.format, parser);
  }

  /**
   * Detect format from file extension.
   */
  detectFormat(filename: string): GraphFormat | null {
    const lower = filename.toLowerCase();
    for (const [fmt, exts] of Object.entries(FORMAT_EXTENSIONS) as [GraphFormat, string[]][]) {
      if (exts.some(ext => lower.endsWith(ext))) return fmt;
    }
    return null;
  }

  /**
   * Parse content from a format into a GraphBuilder.
   */
  parse(content: string, format: GraphFormat): GraphBuilder {
    const parser = this.parsers.get(format);
    if (!parser) throw new Error(`Unsupported format: ${format}`);
    return parser.parse(content);
  }

  /**
   * Serialize a VisualGraph into a format string.
   */
  serialize(graph: VisualGraph, format: GraphFormat): string {
    const parser = this.parsers.get(format);
    if (!parser) throw new Error(`Unsupported format: ${format}`);
    return parser.serialize(graph);
  }

  /**
   * Convert between formats: parse input, serialize output.
   */
  convert(content: string, from: GraphFormat, to: GraphFormat): string {
    const builder = this.parse(content, from);
    const graph = builder.toVisualGraph();
    return this.serialize(graph, to);
  }

  /**
   * List available formats.
   */
  listFormats(): Array<{ format: GraphFormat; name: string; extensions: string[] }> {
    return Array.from(this.parsers.keys()).map(fmt => ({
      format: fmt,
      name: FORMAT_NAMES[fmt],
      extensions: FORMAT_EXTENSIONS[fmt],
    }));
  }
}