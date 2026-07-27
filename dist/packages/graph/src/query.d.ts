/**
 * Compatibilidad Cypher/SPARQL — T-19.2
 *
 * Consultas estilo Cypher sobre L8-L11 (KnowledgeGraph, SemanticGraph, EmbeddingGraph, GraphRAG)
 * Sintaxis: MATCH (p:Person)-[:developed]->(t:Theory) RETURN p, t
 * Uso: cos graph query "MATCH (p:Person)-[:created]->(t) RETURN p, t"
 *
 * Zero dependencias externas.
 */
import { KnowledgeGraphEngine } from './level8-knowledge';
import { SemanticGraph } from './level9-semantic';
import { EmbeddingGraph } from './level10-embedding';
import { GraphRAGEngine } from './level11-graphrag';
export type CypherTokenType = 'MATCH' | 'RETURN' | 'WHERE' | 'LIMIT' | 'ORDER_BY' | 'SKIP' | 'IDENTIFIER' | 'LABEL' | 'RELATION' | 'VARIABLE' | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'COLON' | 'MINUS' | 'GREATER' | 'PIPE' | 'COMMA' | 'DOT' | 'EQUALS' | 'STRING' | 'NUMBER' | 'EOF';
export interface CypherToken {
    type: CypherTokenType;
    value: string;
    pos: number;
}
export declare class CypherTokenizer {
    private pos;
    tokenize(input: string): CypherToken[];
}
export interface CypherPattern {
    variable: string;
    labels: string[];
    /** For relations: type filter */
    relType?: string;
    /** Direction: '->' (outgoing), '<-' (incoming), '--' (undirected) */
    direction?: string;
}
export interface CypherMatch {
    patterns: CypherPattern[];
    /** Adjacency list of pattern indices: patterns[i] -> patterns[j] via relation */
    edges: Array<{
        from: number;
        to: number;
        relType?: string;
        direction: string;
    }>;
}
export interface CypherQuery {
    match: CypherMatch;
    returnVars: string[];
    where?: Array<{
        left: string;
        op: string;
        right: string;
    }>;
    limit?: number;
    orderBy?: string;
    orderDir?: 'ASC' | 'DESC';
}
export declare class CypherParser {
    private tokens;
    private pos;
    parse(input: string): CypherQuery;
    private parseMatchPattern;
    private parseNodePattern;
    private parseRelPattern;
    private parseReturnList;
    private parseWhere;
    private current;
    private previous;
    private advance;
    private expect;
}
export interface CypherResultRow {
    [variable: string]: Record<string, unknown>;
}
export interface CypherResult {
    columns: string[];
    rows: CypherResultRow[];
    total: number;
    elapsed: number;
}
export type CypherTarget = 'knowledge' | 'semantic' | 'embedding' | 'graphrag';
export declare class CypherEngine {
    private parser;
    /**
     * Execute a Cypher query on a KnowledgeGraphEngine.
     */
    executeOnKnowledge(query: string, kg: KnowledgeGraphEngine): CypherResult;
    /**
     * Execute a Cypher query on a SemanticGraph.
     */
    executeOnSemantic(query: string, sg: SemanticGraph): CypherResult;
    /**
     * Execute a Cypher query on an EmbeddingGraph.
     */
    executeOnEmbedding(query: string, eg: EmbeddingGraph): CypherResult;
    /**
     * Execute a Cypher query on a GraphRAGEngine.
     */
    executeOnGraphRAG(query: string, rag: GraphRAGEngine): CypherResult;
    /**
     * Parse a query without executing (for validation).
     */
    parse(query: string): CypherQuery;
}
//# sourceMappingURL=query.d.ts.map