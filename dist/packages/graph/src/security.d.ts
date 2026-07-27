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
import { VisualGraph } from './level0-visual';
export interface SanitizeOptions {
    maxIdLength?: number;
    maxLabelLength?: number;
    allowedPattern?: RegExp;
    stripHtml?: boolean;
    trim?: boolean;
}
export declare const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions;
export declare class InputSanitizer {
    private options;
    constructor(options?: Partial<SanitizeOptions>);
    /** Sanitiza un ID: recorta, quita HTML, valida patron */
    sanitizeId(raw: string): string;
    /** Sanitiza un label: recorta, quita HTML, limita longitud */
    sanitizeLabel(raw: string): string;
    /** Sanitiza un nombre de archivo o ruta */
    sanitizePath(raw: string): string;
    /** Valida si un ID cumple el patron */
    isValidId(id: string): boolean;
    /** Valida si un label es seguro */
    isValidLabel(label: string): boolean;
    private stripHtml;
}
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
export declare class GraphValidator {
    /** Valida un grafo visual (L0) contra esquema */
    validateVisualGraph(graph: VisualGraph): ValidationResult;
    /** Valida datos de entrada para mutation API */
    validateMutationInput(action: string, data: Record<string, any>): ValidationResult;
}
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
export declare const DEFAULT_SECURITY_CONFIG: SecurityGuardConfig;
export declare class SecurityGuard {
    private config;
    private opCounters;
    constructor(config?: Partial<SecurityGuardConfig>);
    /** Check rate limit for a client/operation key */
    checkRateLimit(key: string): boolean;
    /** Check graph size limits */
    checkGraphSize(nodes: number, edges: number): ValidationResult;
    /** Create a timeout promise */
    withTimeout<T>(op: () => Promise<T>, timeoutMs?: number): Promise<T>;
    /** Check recursion depth */
    checkDepth(depth: number): boolean;
    /** Reset rate limit counters */
    resetCounters(): void;
    /** Get current rate limit state */
    getRateLimitStats(): {
        activeKeys: number;
        totalOps: number;
    };
}
export declare class LevelSecurity {
    sanitizer: InputSanitizer;
    validator: GraphValidator;
    guard: SecurityGuard;
    constructor(config?: Partial<SecurityGuardConfig>);
    /** Pre-process mutation input: sanitize and validate */
    preprocessMutation(action: string, data: Record<string, any>): {
        sanitized: Record<string, any>;
        errors: ValidationError[];
    };
}
//# sourceMappingURL=security.d.ts.map