// Core type primitives — the foundation of the COS type system

/** Unique identifier for any cognitive entity */
export type EntityId = string & { __brand: 'EntityId' };

/** ISO-8601 timestamp string */
export type Timestamp = string;

/** A semantic version identifier */
export interface Version {
  major: number;
  minor: number;
  patch: number;
  label?: string;
}

/** Generic metadata key-value map */
export type Metadata = Record<string, string | number | boolean | null>;

/** Confidence score in the range 0..1 */
export type Confidence = number;

/** Resource cost tracking */
export interface Cost {
  units: string;
  amount: number;
  tokens?: { input: number; output: number; total: number };
  compute?: number;
}

/** Performance latency metrics */
export interface Latency {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
}

/** System health status */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface Health {
  status: HealthStatus;
  lastCheck: Timestamp;
  message?: string;
  metrics?: Record<string, number>;
}

/** Event/log severity levels */
export type Severity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Permission levels for RBAC */
export type Permission = 'read' | 'write' | 'execute' | 'admin' | 'deny';