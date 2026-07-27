/**
 * Compatibilidad Cypher/SPARQL — T-19.2
 *
 * Consultas estilo Cypher sobre L8-L11 (KnowledgeGraph, SemanticGraph, EmbeddingGraph, GraphRAG)
 * Sintaxis: MATCH (p:Person)-[:developed]->(t:Theory) RETURN p, t
 * Uso: cos graph query "MATCH (p:Person)-[:created]->(t) RETURN p, t"
 *
 * Zero dependencias externas.
 */

import { KnowledgeGraphEngine, KGEntity, KGRelation } from './level8-knowledge';
import { SemanticGraph, SemanticNode } from './level9-semantic';
import { EmbeddingGraph } from './level10-embedding';
import { GraphRAGEngine } from './level11-graphrag';

// ============================================================
// Cypher Query — Tokenizer
// ============================================================

export type CypherTokenType =
  | 'MATCH' | 'RETURN' | 'WHERE' | 'LIMIT' | 'ORDER_BY' | 'SKIP'
  | 'IDENTIFIER' | 'LABEL' | 'RELATION' | 'VARIABLE'
  | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET'
  | 'COLON' | 'MINUS' | 'GREATER' | 'PIPE'
  | 'COMMA' | 'DOT' | 'EQUALS' | 'STRING'
  | 'NUMBER' | 'EOF';

export interface CypherToken {
  type: CypherTokenType;
  value: string;
  pos: number;
}

export class CypherTokenizer {
  private pos = 0;

  tokenize(input: string): CypherToken[] {
    this.pos = 0;
    const tokens: CypherToken[] = [];

    while (this.pos < input.length) {
      const ch = input[this.pos];

      // Skip whitespace
      if (/\s/.test(ch)) { this.pos++; continue; }

      // Skip comments
      if (ch === '/' && input[this.pos + 1] === '/') {
        while (this.pos < input.length && input[this.pos] !== '\n') this.pos++;
        continue;
      }

      // String literal
      if (ch === '"' || ch === "'") {
        const quote = ch;
        this.pos++;
        let value = '';
        while (this.pos < input.length && input[this.pos] !== quote) {
          if (input[this.pos] === '\\') { this.pos++; value += input[this.pos]; }
          else value += input[this.pos];
          this.pos++;
        }
        this.pos++; // skip closing quote
        tokens.push({ type: 'STRING', value, pos: this.pos });
        continue;
      }

      // Number
      if (/\d/.test(ch)) {
        let value = '';
        while (this.pos < input.length && /[\d.]/.test(input[this.pos])) {
          value += input[this.pos];
          this.pos++;
        }
        tokens.push({ type: 'NUMBER', value, pos: this.pos });
        continue;
      }

      // Keywords and identifiers
      if (/[a-zA-Z_]/.test(ch)) {
        let value = '';
        while (this.pos < input.length && /[a-zA-Z0-9_]/.test(input[this.pos])) {
          value += input[this.pos];
          this.pos++;
        }
        const upper = value.toUpperCase();
        if (upper === 'MATCH') tokens.push({ type: 'MATCH', value, pos: this.pos });
        else if (upper === 'RETURN') tokens.push({ type: 'RETURN', value, pos: this.pos });
        else if (upper === 'WHERE') tokens.push({ type: 'WHERE', value, pos: this.pos });
        else if (upper === 'LIMIT') tokens.push({ type: 'LIMIT', value, pos: this.pos });
        else if (upper === 'ORDER' && input.substr(this.pos, 3).toUpperCase() === ' BY') {
          this.pos += 3;
          tokens.push({ type: 'ORDER_BY', value: 'ORDER BY', pos: this.pos });
        }
        else if (upper === 'SKIP') tokens.push({ type: 'SKIP', value, pos: this.pos });
        else tokens.push({ type: 'IDENTIFIER', value, pos: this.pos });
        continue;
      }

      // Multi-char operators
      if (ch === '-' && input[this.pos + 1] === '[') {
        tokens.push({ type: 'LBRACKET', value: '-[', pos: this.pos });
        this.pos += 2;
        continue;
      }
      if (ch === ']' && input[this.pos + 1] === '-' && input[this.pos + 2] === '>') {
        tokens.push({ type: 'RBRACKET', value: ']->', pos: this.pos });
        this.pos += 3;
        continue;
      }
      if (ch === '-' && input[this.pos + 1] === '>') {
        tokens.push({ type: 'GREATER', value: '->', pos: this.pos });
        this.pos += 2;
        continue;
      }
      if (ch === '-' && input[this.pos + 1] === '-') {
        tokens.push({ type: 'MINUS', value: '--', pos: this.pos });
        this.pos += 2;
        continue;
      }

      // Single char
      const singleMap: Record<string, CypherTokenType> = {
        '(': 'LPAREN', ')': 'RPAREN', '[': 'LBRACKET', ']': 'RBRACKET',
        ':': 'COLON', '-': 'MINUS', '>': 'GREATER', '|': 'PIPE',
        ',': 'COMMA', '.': 'DOT', '=': 'EQUALS',
      };
      if (singleMap[ch]) {
        tokens.push({ type: singleMap[ch], value: ch, pos: this.pos });
        this.pos++;
        continue;
      }

      this.pos++; // skip unknown
    }

    tokens.push({ type: 'EOF', value: '', pos: this.pos });
    return tokens;
  }
}

// ============================================================
// Cypher AST
// ============================================================

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
  edges: Array<{ from: number; to: number; relType?: string; direction: string }>;
}

export interface CypherQuery {
  match: CypherMatch;
  returnVars: string[];
  where?: Array<{ left: string; op: string; right: string }>;
  limit?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}

// ============================================================
// Cypher Parser
// ============================================================

export class CypherParser {
  private tokens: CypherToken[] = [];
  private pos = 0;

  parse(input: string): CypherQuery {
    const tokenizer = new CypherTokenizer();
    this.tokens = tokenizer.tokenize(input);
    this.pos = 0;

    this.expect('MATCH');
    const match = this.parseMatchPattern();
    let returnVars: string[] = [];
    let where: Array<{ left: string; op: string; right: string }> | undefined;
    let limit: number | undefined;
    let orderBy: string | undefined;
    let orderDir: 'ASC' | 'DESC' = 'ASC';

    while (this.current().type !== 'EOF') {
      const t = this.current();
      if (t.type === 'RETURN') {
        this.advance();
        returnVars = this.parseReturnList();
      } else if (t.type === 'WHERE') {
        this.advance();
        where = this.parseWhere();
      } else if (t.type === 'LIMIT') {
        this.advance();
        const numTok = this.expect('NUMBER');
        limit = parseInt(numTok.value);
      } else if (t.type === 'ORDER_BY') {
        this.advance();
        orderBy = this.expect('IDENTIFIER').value;
        if (this.current().type === 'IDENTIFIER' && this.current().value.toUpperCase() === 'DESC') {
          orderDir = 'DESC';
          this.advance();
        }
      } else {
        break;
      }
    }

    return { match, returnVars, where, limit, orderBy, orderDir };
  }

  private parseMatchPattern(): CypherMatch {
    const patterns: CypherPattern[] = [];
    const edges: Array<{ from: number; to: number; relType?: string; direction: string }> = [];

    // Parse first node
    const first = this.parseNodePattern();
    patterns.push(first);

    while (this.current().type === 'MINUS' || this.current().type === 'GREATER' || this.current().type === 'LBRACKET') {
      // Parse relation
      const rel = this.parseRelPattern();
      // Parse next node
      const next = this.parseNodePattern();
      const fromIdx = patterns.length - 1;
      patterns.push(next);
      edges.push({ from: fromIdx, to: patterns.length - 1, relType: rel.relType, direction: rel.direction });
    }

    // Handle comma-separated patterns
    while (this.current().type === 'COMMA') {
      this.advance();
      const next = this.parseNodePattern();
      patterns.push(next);
      while (this.current().type === 'MINUS' || this.current().type === 'GREATER' || this.current().type === 'LBRACKET') {
        const rel = this.parseRelPattern();
        const next2 = this.parseNodePattern();
        const fromIdx = patterns.length - 1;
        patterns.push(next2);
        edges.push({ from: fromIdx, to: patterns.length - 1, relType: rel.relType, direction: rel.direction });
      }
    }

    return { patterns, edges };
  }

  private parseNodePattern(): CypherPattern {
    this.expect('LPAREN');
    let variable = '';
    const labels: string[] = [];

    if (this.current().type === 'IDENTIFIER') {
      variable = this.current().value;
      this.advance();
    }

    // Parse labels: :Person :Theory
    while (this.current().type === 'COLON') {
      this.advance();
      const label = this.current().value;
      labels.push(label);
      this.advance();
    }

    this.expect('RPAREN');

    return { variable, labels, direction: '--' };
  }

  private parseRelPattern(): { relType?: string; direction: string } {
    let direction = '->';
    let relType: string | undefined;

    // -[ or -> or --
    if (this.current().type === 'LBRACKET') {
      // -[ :RELATION ]->
      this.advance();
      if (this.current().type === 'COLON') {
        this.advance();
        relType = this.current().value;
        this.advance();
      }
      // Skip to ]->
      while (this.current().type !== 'RBRACKET' && this.current().type !== 'EOF') this.advance();
      this.expect('RBRACKET');
      direction = '->';
    } else if (this.current().type === 'MINUS') {
      this.advance();
      if (this.current().type === 'GREATER') {
        this.advance();
        direction = '->';
      } else {
        direction = '--';
      }
    } else if (this.current().type === 'GREATER') {
      this.advance();
      direction = '->';
    }

    return { relType, direction };
  }

  private parseReturnList(): string[] {
    const vars: string[] = [];
    vars.push(this.expect('IDENTIFIER').value);
    while (this.current().type === 'COMMA') {
      this.advance();
      vars.push(this.expect('IDENTIFIER').value);
    }
    return vars;
  }

  private parseWhere(): Array<{ left: string; op: string; right: string }> {
    const conditions: Array<{ left: string; op: string; right: string }> = [];

    while (this.current().type !== 'EOF' && this.current().type !== 'RETURN' && this.current().type !== 'LIMIT' && this.current().type !== 'ORDER_BY') {
      // Parse left side (could be dotted: p.name)
      let left = this.current().value;
      this.advance();

      // Handle dotted property access: p.name
      if (this.current().type === 'DOT') {
        this.advance(); // skip .
        left += '.' + this.current().value;
        this.advance();
      }

      // Parse operator
      const op = this.current().value;
      this.advance();

      // Parse right side (could be a string, number, or identifier)
      let right = '';
      if (this.current().type === 'STRING') {
        right = this.current().value;
        this.advance();
      } else if (this.current().type === 'NUMBER') {
        right = this.current().value;
        this.advance();
      } else {
        right = this.current().value;
        this.advance();
      }

      conditions.push({ left, op, right });

      // Skip AND/OR
      if (this.current().type === 'IDENTIFIER' && (this.current().value.toUpperCase() === 'AND' || this.current().value.toUpperCase() === 'OR')) {
        this.advance();
      }
    }

    return conditions;
  }

  private current(): CypherToken { return this.tokens[this.pos] || { type: 'EOF', value: '', pos: -1 }; }
  private previous(): CypherToken | undefined { return this.tokens[this.pos - 1]; }
  private advance(): void { this.pos++; }

  private expect(type: CypherTokenType): CypherToken {
    const t = this.current();
    if (t.type !== type) throw new Error(`Expected ${type} but got ${t.type} ("${t.value}") at position ${t.pos}`);
    this.advance();
    return t;
  }
}

// ============================================================
// CypherResult
// ============================================================

export interface CypherResultRow {
  [variable: string]: Record<string, unknown>;
}

export interface CypherResult {
  columns: string[];
  rows: CypherResultRow[];
  total: number;
  elapsed: number;
}

// ============================================================
// CypherEngine — Ejecuta consultas sobre L8-L11
// ============================================================

export type CypherTarget = 'knowledge' | 'semantic' | 'embedding' | 'graphrag';

export class CypherEngine {
  private parser = new CypherParser();

  /**
   * Execute a Cypher query on a KnowledgeGraphEngine.
   */
  executeOnKnowledge(query: string, kg: KnowledgeGraphEngine): CypherResult {
    const start = Date.now();
    const parsed = this.parser.parse(query);

    // Match entities by labels
    const matched: Array<{ variable: string; entity: KGEntity }> = [];
    for (const pattern of parsed.match.patterns) {
      // If no labels, match all
      const candidates = pattern.labels.length === 0
        ? kg.entities
        : kg.entities.filter(e => pattern.labels.some(l => l.toLowerCase() === (e.type || '').toLowerCase() || l.toLowerCase() === (e.name || '').toLowerCase()));

      // If WHERE clause, filter
      if (parsed.where && parsed.where.length > 0) {
        const filtered = candidates.filter(e => {
          return parsed.where!.every(w => {
            const prop = w.left.includes('.') ? w.left.split('.')[1] : w.left;
            const val = (e as any)[prop] || e.properties?.[prop] || '';
            return String(val).toLowerCase().includes(w.right.toLowerCase());
          });
        });
        for (const e of filtered) {
          matched.push({ variable: pattern.variable, entity: e });
        }
      } else {
        for (const e of candidates) {
          matched.push({ variable: pattern.variable, entity: e });
        }
      }
    }

    // Build result rows
    const rows: CypherResultRow[] = [];
    for (const m of matched) {
      const row: CypherResultRow = {};
      row[m.variable] = { id: m.entity.id, name: m.entity.name, type: m.entity.type, description: m.entity.description };
      rows.push(row);
    }

    // Apply limit
    if (parsed.limit && parsed.limit > 0) {
      rows.splice(parsed.limit);
    }

    const elapsed = Date.now() - start;
    return {
      columns: parsed.returnVars.length > 0 ? parsed.returnVars : parsed.match.patterns.map(p => p.variable),
      rows,
      total: rows.length,
      elapsed,
    };
  }

  /**
   * Execute a Cypher query on a SemanticGraph.
   */
  executeOnSemantic(query: string, sg: SemanticGraph): CypherResult {
    const start = Date.now();
    const parsed = this.parser.parse(query);

    // Access semantic nodes (using public API)
    const nodes = (sg as any).nodes || [];
    const edges = (sg as any).edges || [];

    const matched: Array<{ variable: string; node: any }> = [];
    for (const pattern of parsed.match.patterns) {
      const candidates = pattern.labels.length === 0
        ? nodes
        : nodes.filter((n: any) => pattern.labels.includes(n.type || n.label || ''));

      for (const c of candidates) {
        matched.push({ variable: pattern.variable, node: c });
      }
    }

    const rows: CypherResultRow[] = [];
    for (const m of matched) {
      const row: CypherResultRow = {};
      row[m.variable] = { id: m.node.id, label: m.node.label || m.node.name, type: m.node.type };
      rows.push(row);
    }

    if (parsed.limit) rows.splice(parsed.limit);

    return { columns: parsed.returnVars, rows, total: rows.length, elapsed: Date.now() - start };
  }

  /**
   * Execute a Cypher query on an EmbeddingGraph.
   */
  executeOnEmbedding(query: string, eg: EmbeddingGraph): CypherResult {
    const start = Date.now();
    const parsed = this.parser.parse(query);

    const nodes = (eg as any).nodes || [];
    const matched: Array<{ variable: string; node: any }> = [];
    for (const pattern of parsed.match.patterns) {
      const candidates = pattern.labels.length === 0
        ? nodes
        : nodes.filter((n: any) => pattern.labels.includes(n.label || n.type || ''));
      for (const c of candidates) {
        matched.push({ variable: pattern.variable, node: c });
      }
    }

    const rows: CypherResultRow[] = [];
    for (const m of matched) {
      const row: CypherResultRow = {};
      row[m.variable] = { id: m.node.id, label: m.node.label || m.node.name, vector: `[${((m.node.embedding || m.node.vector || []) as number[]).length} dims]` };
      rows.push(row);
    }

    if (parsed.limit) rows.splice(parsed.limit);

    return { columns: parsed.returnVars, rows, total: rows.length, elapsed: Date.now() - start };
  }

  /**
   * Execute a Cypher query on a GraphRAGEngine.
   */
  executeOnGraphRAG(query: string, rag: GraphRAGEngine): CypherResult {
    const start = Date.now();
    const parsed = this.parser.parse(query);

    const chunks = (rag as any).chunks || [];
    const matched: Array<{ variable: string; chunk: any }> = [];
    for (const pattern of parsed.match.patterns) {
      for (const c of chunks) {
        matched.push({ variable: pattern.variable, chunk: c });
      }
    }

    const rows: CypherResultRow[] = [];
    for (const m of matched) {
      const row: CypherResultRow = {};
      row[m.variable] = { id: m.chunk.id, text: (m.chunk.text || '').slice(0, 100), source: m.chunk.source || '' };
      rows.push(row);
    }

    if (parsed.limit) rows.splice(parsed.limit);

    return { columns: parsed.returnVars, rows, total: rows.length, elapsed: Date.now() - start };
  }

  /**
   * Parse a query without executing (for validation).
   */
  parse(query: string): CypherQuery {
    return this.parser.parse(query);
  }
}