/**
 * COS Graph Engine - Seguridad y Validacion (Fase 10)
 *
 * Proporciona:
 * 1. InputSanitizer - sanitizacion de IDs, nombres, labels
 * 2. GraphValidator - validacion de esquemas por nivel
 * 3. SecurityGuard - rate limiting, timeout, proteccion DoS
 *
 * Zero dependencias externas.
 */

import { VisualGraph, VisualNode, VisualEdge } from './level0-visual';

// ============================================================
// 1. INPUT SANITIZER
// ============================================================

export interface SanitizeOptions {
  maxIdLength?: number;
  maxLabelLength?: number;
  allowedPattern?: RegExp;
  stripHtml?: boolean;
  trim?: boolean;
}

export const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions = {
  maxIdLength: 64,
  maxLabelLength: 256,
  allowedPattern: /^[a-zA-Z0-9_\-:./@#$%()]+$/,
  stripHtml: true,
  trim: true,
};

export class InputSanitizer {
  private options: SanitizeOptions;

  constructor(options?: Partial<SanitizeOptions>) {
    this.options = { ...DEFAULT_SANITIZE_OPTIONS, ...options };
  }

  /** Sanitiza un ID: recorta, quita HTML, valida patron */
  sanitizeId(raw: string): string {
    let id = raw;
    if (this.options.trim) id = id.trim();
    if (this.options.stripHtml) id = this.stripHtml(id);
    if (this.options.maxIdLength) id = id.slice(0, this.options.maxIdLength);
    // Replace invalid chars with underscore
    if (this.options.allowedPattern) {
      id = id.replace(/[^a-zA-Z0-9_\-:./@#$%()]/g, '_');
    }
    if (id.length === 0) id = 'sanitized_' + Date.now();
    return id;
  }

  /** Sanitiza un label: recorta, quita HTML, limita longitud */
  sanitizeLabel(raw: string): string {
    let label = raw;
    if (this.options.trim) label = label.trim();
    if (this.options.stripHtml) label = this.stripHtml(label);
    if (this.options.maxLabelLength) label = label.slice(0, this.options.maxLabelLength);
    if (label.length === 0) label = 'unnamed';
    return label;
  }

  /** Sanitiza un nombre de archivo o ruta */
  sanitizePath(raw: string): string {
    let path = raw;
    if (this.options.trim) path = path.trim();
    if (this.options.stripHtml) path = this.stripHtml(path);
    // Remove path traversal
    path = path.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
    path = path.replace(/[<>:"|?*]/g, '_');
    if (this.options.maxIdLength) path = path.slice(0, this.options.maxIdLength);
    if (path.length === 0) path = 'unnamed';
    return path;
  }

  /** Valida si un ID cumple el patron */
  isValidId(id: string): boolean {
    if (!id || id.length === 0) return false;
    if (this.options.maxIdLength && id.length > this.options.maxIdLength) return false;
    if (this.options.allowedPattern) return this.options.allowedPattern.test(id);
    return true;
  }

  /** Valida si un label es seguro */
  isValidLabel(label: string): boolean {
    const max = this.options.maxLabelLength || 256;
    return label.length > 0 && label.length <= max;
  }

  private stripHtml(input: string): string {
    return input.replace(/<[a-zA-Z\/][^>]*>/g, '');
  }
}

// ============================================================
// 2. GRAPH VALIDATOR
// ============================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export class GraphValidator {
  /** Valida un grafo visual (L0) contra esquema */
  validateVisualGraph(graph: VisualGraph): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!graph.id && !graph.title) {
      errors.push({ field: 'id/title', message: 'Graph must have an id or title', severity: 'error' });
    }

    if (!Array.isArray(graph.nodes)) {
      errors.push({ field: 'nodes', message: 'Graph.nodes must be an array', severity: 'error' });
    } else {
      const nodeIds = new Set<string>();
      for (let i = 0; i < graph.nodes.length; i++) {
        const n = graph.nodes[i];
        if (!n.id) {
          errors.push({ field: `nodes[${i}].id`, message: 'Node id is required', severity: 'error' });
        } else if (nodeIds.has(n.id)) {
          errors.push({ field: `nodes[${i}].id`, message: `Duplicate node id: ${n.id}`, severity: 'error' });
        }
        nodeIds.add(n.id);
        if (!n.label) {
          warnings.push({ field: `nodes[${i}].label`, message: 'Node label is empty', severity: 'warning' });
        }
      }

      // Validate edges
      if (Array.isArray(graph.edges)) {
        for (let i = 0; i < graph.edges.length; i++) {
          const e = graph.edges[i];
          if (!nodeIds.has(e.source)) {
            errors.push({ field: `edges[${i}].source`, message: `Dangling source: ${e.source}`, severity: 'error' });
          }
          if (!nodeIds.has(e.target)) {
            errors.push({ field: `edges[${i}].target`, message: `Dangling target: ${e.target}`, severity: 'error' });
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /** Valida datos de entrada para mutation API */
  validateMutationInput(action: string, data: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    const sanitizer = new InputSanitizer();

    switch (action) {
      case 'addNode': {
        if (!data.id && !data.label) {
          errors.push({ field: 'id/label', message: 'Node needs id or label', severity: 'error' });
        }
        if (data.id && !sanitizer.isValidId(String(data.id))) {
          errors.push({ field: 'id', message: 'Invalid node id format', severity: 'error' });
        }
        if (data.label && !sanitizer.isValidLabel(String(data.label))) {
          errors.push({ field: 'label', message: 'Label too long or empty', severity: 'error' });
        }
        break;
      }
      case 'addEdge': {
        if (!data.source) {
          errors.push({ field: 'source', message: 'Edge source is required', severity: 'error' });
        }
        if (!data.target) {
          errors.push({ field: 'target', message: 'Edge target is required', severity: 'error' });
        }
        break;
      }
      case 'removeNode': {
        if (!data.id) {
          errors.push({ field: 'id', message: 'Node id to remove is required', severity: 'error' });
        }
        break;
      }
      default: {
        errors.push({ field: 'action', message: `Unknown mutation action: ${action}`, severity: 'error' });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

// ============================================================
// 3. SECURITY GUARD
// ============================================================

export interface SecurityGuardConfig {
  /** Max operations per window (rate limit) */
  maxOpsPerWindow?: number;
  /** Rate limit window in ms */
  rateLimitWindowMs?: number;
  /** Max nodes in a single graph */
  maxNodes?: number;
  /** Max edges in a single graph */
  maxEdges?: number;
  /** Default timeout for operations in ms */
  defaultTimeoutMs?: number;
  /** Max recursion depth */
  maxRecursionDepth?: number;
}

export const DEFAULT_SECURITY_CONFIG: SecurityGuardConfig = {
  maxOpsPerWindow: 1000,
  rateLimitWindowMs: 60_000,
  maxNodes: 100_000,
  maxEdges: 500_000,
  defaultTimeoutMs: 30_000,
  maxRecursionDepth: 1000,
};

export class SecurityGuard {
  private config: SecurityGuardConfig;
  private opCounters: Map<string, { count: number; windowStart: number }> = new Map();

  constructor(config?: Partial<SecurityGuardConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /** Check rate limit for a client/operation key */
  checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = this.opCounters.get(key);

    if (!entry || now - entry.windowStart > (this.config.rateLimitWindowMs || 60_000)) {
      this.opCounters.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= (this.config.maxOpsPerWindow || 1000)) {
      return false;
    }

    entry.count++;
    return true;
  }

  /** Check graph size limits */
  checkGraphSize(nodes: number, edges: number): ValidationResult {
    const errors: ValidationError[] = [];
    const maxNodes = this.config.maxNodes || 100_000;
    const maxEdges = this.config.maxEdges || 500_000;

    if (nodes > maxNodes) {
      errors.push({ field: 'nodes', message: `Graph exceeds max nodes: ${nodes} > ${maxNodes}`, severity: 'error' });
    }
    if (edges > maxEdges) {
      errors.push({ field: 'edges', message: `Graph exceeds max edges: ${edges} > ${maxEdges}`, severity: 'error' });
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  /** Create a timeout promise */
  withTimeout<T>(op: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const timeout = timeoutMs || this.config.defaultTimeoutMs || 30_000;
    return Promise.race([
      op(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /** Check recursion depth */
  checkDepth(depth: number): boolean {
    const max = this.config.maxRecursionDepth || 1000;
    return depth <= max;
  }

  /** Reset rate limit counters */
  resetCounters(): void {
    this.opCounters.clear();
  }

  /** Get current rate limit state */
  getRateLimitStats(): { activeKeys: number; totalOps: number } {
    let totalOps = 0;
    for (const entry of this.opCounters.values()) {
      totalOps += entry.count;
    }
    return { activeKeys: this.opCounters.size, totalOps };
  }
}

// ============================================================
// 4. INTEGRATED LEVEL SECURITY
// ============================================================

export class LevelSecurity {
  public sanitizer: InputSanitizer;
  public validator: GraphValidator;
  public guard: SecurityGuard;

  constructor(config?: Partial<SecurityGuardConfig>) {
    this.sanitizer = new InputSanitizer();
    this.validator = new GraphValidator();
    this.guard = new SecurityGuard(config);
  }

  /** Pre-process mutation input: sanitize and validate */
  preprocessMutation(action: string, data: Record<string, any>): { sanitized: Record<string, any>; errors: ValidationError[] } {
    const result: Record<string, any> = {};

    // Sanitize each field
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        switch (key) {
          case 'id':
          case 'source':
          case 'target':
            result[key] = this.sanitizer.sanitizeId(value);
            break;
          case 'label':
          case 'name':
          case 'title':
            result[key] = this.sanitizer.sanitizeLabel(value);
            break;
          default:
            result[key] = this.sanitizer.sanitizeLabel(value);
        }
      } else {
        result[key] = value;
      }
    }

    const validation = this.validator.validateMutationInput(action, result);
    return { sanitized: result, errors: validation.errors };
  }
}