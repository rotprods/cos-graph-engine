"use strict";
/**
 * Import/Export Universal — T-19.1
 *
 * GraphML, GEXF, GDF, JSON, CSV, DOT
 * Migracion entre formatos: convert(input, 'graphml', 'dot')
 *
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphConverter = exports.DOTParser = exports.CSVParser = exports.JSONParser = exports.GDFParser = exports.GEXFParser = exports.GraphMLParser = exports.GraphParser = exports.FORMAT_EXTENSIONS = exports.FORMAT_NAMES = exports.GraphBuilder = void 0;
class GraphBuilder {
    nodes = [];
    edges = [];
    title = '';
    addNode(node) { this.nodes.push(node); }
    addEdge(edge) { this.edges.push(edge); }
    setTitle(title) { this.title = title; }
    toVisualGraph() {
        return {
            id: `graph-${Date.now()}`,
            title: this.title,
            nodes: this.nodes.map(n => ({
                id: n.id, label: n.label,
                type: n.type,
                color: n.color, shape: n.shape,
            })),
            edges: this.edges.map(e => ({
                id: e.id, source: e.source, target: e.target,
                label: e.label, style: e.style, color: e.color,
            })),
        };
    }
}
exports.GraphBuilder = GraphBuilder;
exports.FORMAT_NAMES = {
    graphml: 'GraphML (XML-based graph format)',
    gexf: 'GEXF (Graph Exchange XML Format)',
    gdf: 'GDF (GUESS Graph Data Format)',
    json: 'JSON (COS native format)',
    csv: 'CSV (nodes.csv + edges.csv)',
    dot: 'DOT (Graphviz)',
};
exports.FORMAT_EXTENSIONS = {
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
class GraphParser {
    escapeXml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    unescapeXml(s) {
        return s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    }
    escapeCsv(s) {
        if (s.includes(',') || s.includes('"') || s.includes('\n'))
            return `"${s.replace(/"/g, '""')}"`;
        return s;
    }
}
exports.GraphParser = GraphParser;
// ============================================================
// GraphML Parser
// ============================================================
class GraphMLParser extends GraphParser {
    format = 'graphml';
    parse(content) {
        const builder = new GraphBuilder();
        builder.setTitle('GraphML Import');
        // Extract node elements
        const nodeRegex = /<node\s+id="([^"]*)"(?:[^>]*)>([\s\S]*?)<\/node>/gi;
        let m;
        while ((m = nodeRegex.exec(content)) !== null) {
            const id = this.unescapeXml(m[1]);
            const body = m[2];
            let label = id;
            const labelMatch = body.match(/<data\s+key="[^"]*">([\s\S]*?)<\/data>/i);
            if (labelMatch)
                label = this.unescapeXml(labelMatch[1].trim());
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
    serialize(graph) {
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
            if (e.label)
                xml += `      <data key="label">${this.escapeXml(e.label)}</data>\n`;
            xml += '    </edge>\n';
        }
        xml += '  </graph>\n';
        xml += '</graphml>\n';
        return xml;
    }
}
exports.GraphMLParser = GraphMLParser;
// ============================================================
// GEXF Parser
// ============================================================
class GEXFParser extends GraphParser {
    format = 'gexf';
    parse(content) {
        const builder = new GraphBuilder();
        builder.setTitle('GEXF Import');
        // Extract nodes
        const nodeRegex = /<node\s+id="([^"]*)"(?:[^>]*)>([\s\S]*?)<\/node>/gi;
        let m;
        while ((m = nodeRegex.exec(content)) !== null) {
            const id = this.unescapeXml(m[1]);
            const body = m[2];
            let label = id;
            const labelMatch = body.match(/<attvalue\s+[^>]*?value="([^"]*)"[^>]*\/?>/i)
                || body.match(/<label>([\s\S]*?)<\/label>/i);
            if (labelMatch)
                label = this.unescapeXml(labelMatch[1].trim());
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
    serialize(graph) {
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
exports.GEXFParser = GEXFParser;
// ============================================================
// GDF Parser (GUESS format)
// ============================================================
class GDFParser extends GraphParser {
    format = 'gdf';
    parse(content) {
        const builder = new GraphBuilder();
        builder.setTitle('GDF Import');
        const lines = content.split('\n').filter(l => l.trim());
        let section = 'none';
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
    serialize(graph) {
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
exports.GDFParser = GDFParser;
// ============================================================
// JSON Parser (COS native)
// ============================================================
class JSONParser extends GraphParser {
    format = 'json';
    parse(content) {
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
        if (data.title || data.name)
            builder.setTitle(data.title || data.name);
        return builder;
    }
    serialize(graph) {
        const obj = {
            title: graph.title,
            direction: graph.direction || 'TB',
            nodes: graph.nodes,
            edges: graph.edges,
        };
        return JSON.stringify(obj, null, 2);
    }
}
exports.JSONParser = JSONParser;
// ============================================================
// CSV Parser
// ============================================================
class CSVParser extends GraphParser {
    format = 'csv';
    parse(content) {
        const builder = new GraphBuilder();
        const lines = content.split('\n').filter(l => l.trim());
        let section = 'nodes';
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
            if (parts.length < 2)
                continue;
            if (section === 'nodes') {
                builder.addNode({ id: parts[0], label: parts[1] || parts[0] });
            }
            else {
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
    serialize(graph) {
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
    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                }
                else
                    inQuotes = !inQuotes;
            }
            else if (ch === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            }
            else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    }
}
exports.CSVParser = CSVParser;
// ============================================================
// DOT Parser (Graphviz)
// ============================================================
class DOTParser extends GraphParser {
    format = 'dot';
    parse(content) {
        const builder = new GraphBuilder();
        builder.setTitle('DOT Import');
        // Extract graph title
        const titleMatch = content.match(/(?:digraph|graph)\s+(\w+)/);
        if (titleMatch)
            builder.setTitle(titleMatch[1]);
        // Extract node definitions: "id [label=...]"
        const nodeRegex = /(\w+)\s*\[([^\]]*)\]/g;
        let m;
        while ((m = nodeRegex.exec(content)) !== null) {
            const id = m[1];
            const attrs = m[2];
            let label = id;
            const labelMatch = attrs.match(/label\s*=\s*"([^"]*)"/);
            if (labelMatch)
                label = labelMatch[1];
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
    serialize(graph) {
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
            }
            else {
                dot += `  ${e.source}${arrow}${e.target};\n`;
            }
        }
        dot += '}\n';
        return dot;
    }
}
exports.DOTParser = DOTParser;
// ============================================================
// GraphConverter — universal converter
// ============================================================
class GraphConverter {
    parsers = new Map();
    constructor() {
        this.register(new GraphMLParser());
        this.register(new GEXFParser());
        this.register(new GDFParser());
        this.register(new JSONParser());
        this.register(new CSVParser());
        this.register(new DOTParser());
    }
    register(parser) {
        this.parsers.set(parser.format, parser);
    }
    /**
     * Detect format from file extension.
     */
    detectFormat(filename) {
        const lower = filename.toLowerCase();
        for (const [fmt, exts] of Object.entries(exports.FORMAT_EXTENSIONS)) {
            if (exts.some(ext => lower.endsWith(ext)))
                return fmt;
        }
        return null;
    }
    /**
     * Parse content from a format into a GraphBuilder.
     */
    parse(content, format) {
        const parser = this.parsers.get(format);
        if (!parser)
            throw new Error(`Unsupported format: ${format}`);
        return parser.parse(content);
    }
    /**
     * Serialize a VisualGraph into a format string.
     */
    serialize(graph, format) {
        const parser = this.parsers.get(format);
        if (!parser)
            throw new Error(`Unsupported format: ${format}`);
        return parser.serialize(graph);
    }
    /**
     * Convert between formats: parse input, serialize output.
     */
    convert(content, from, to) {
        const builder = this.parse(content, from);
        const graph = builder.toVisualGraph();
        return this.serialize(graph, to);
    }
    /**
     * List available formats.
     */
    listFormats() {
        return Array.from(this.parsers.keys()).map(fmt => ({
            format: fmt,
            name: exports.FORMAT_NAMES[fmt],
            extensions: exports.FORMAT_EXTENSIONS[fmt],
        }));
    }
}
exports.GraphConverter = GraphConverter;
//# sourceMappingURL=convert.js.map