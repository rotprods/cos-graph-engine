/**
 * Import/Export Universal — T-19.1
 *
 * GraphML, GEXF, GDF, JSON, CSV, DOT
 * Migracion entre formatos: convert(input, 'graphml', 'dot')
 *
 * Zero dependencias externas.
 */
import { VisualGraph } from './level0-visual';
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
export declare class GraphBuilder {
    nodes: GraphBuilderNode[];
    edges: GraphBuilderEdge[];
    title: string;
    addNode(node: GraphBuilderNode): void;
    addEdge(edge: GraphBuilderEdge): void;
    setTitle(title: string): void;
    toVisualGraph(): VisualGraph;
}
export type GraphFormat = 'graphml' | 'gexf' | 'gdf' | 'json' | 'csv' | 'dot';
export declare const FORMAT_NAMES: Record<GraphFormat, string>;
export declare const FORMAT_EXTENSIONS: Record<GraphFormat, string[]>;
export declare abstract class GraphParser {
    abstract format: GraphFormat;
    abstract parse(content: string): GraphBuilder;
    abstract serialize(graph: VisualGraph): string;
    protected escapeXml(s: string): string;
    protected unescapeXml(s: string): string;
    protected escapeCsv(s: string): string;
}
export declare class GraphMLParser extends GraphParser {
    format: GraphFormat;
    parse(content: string): GraphBuilder;
    serialize(graph: VisualGraph): string;
}
export declare class GEXFParser extends GraphParser {
    format: GraphFormat;
    parse(content: string): GraphBuilder;
    serialize(graph: VisualGraph): string;
}
export declare class GDFParser extends GraphParser {
    format: GraphFormat;
    parse(content: string): GraphBuilder;
    serialize(graph: VisualGraph): string;
}
export declare class JSONParser extends GraphParser {
    format: GraphFormat;
    parse(content: string): GraphBuilder;
    serialize(graph: VisualGraph): string;
}
export declare class CSVParser extends GraphParser {
    format: GraphFormat;
    parse(content: string): GraphBuilder;
    serialize(graph: VisualGraph): string;
    private parseCsvLine;
}
export declare class DOTParser extends GraphParser {
    format: GraphFormat;
    parse(content: string): GraphBuilder;
    serialize(graph: VisualGraph): string;
}
export declare class GraphConverter {
    private parsers;
    constructor();
    private register;
    /**
     * Detect format from file extension.
     */
    detectFormat(filename: string): GraphFormat | null;
    /**
     * Parse content from a format into a GraphBuilder.
     */
    parse(content: string, format: GraphFormat): GraphBuilder;
    /**
     * Serialize a VisualGraph into a format string.
     */
    serialize(graph: VisualGraph, format: GraphFormat): string;
    /**
     * Convert between formats: parse input, serialize output.
     */
    convert(content: string, from: GraphFormat, to: GraphFormat): string;
    /**
     * List available formats.
     */
    listFormats(): Array<{
        format: GraphFormat;
        name: string;
        extensions: string[];
    }>;
}
//# sourceMappingURL=convert.d.ts.map