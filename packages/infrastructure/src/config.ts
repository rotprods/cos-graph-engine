import { DEFAULTS } from './constants';

// ================================================================
// Phase 5: Configuration System
// Layered: defaults → env → config file → runtime overrides
// ================================================================

export type ConfigSource = 'default' | 'env' | 'file' | 'runtime';

export interface ConfigEntry {
  value: unknown;
  source: ConfigSource;
  schema?: ConfigSchema;
  /** Internal merge priority retained on the canonical entry shape. */
  sourcePriority?: number;
}

export interface ConfigSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: unknown;
  description?: string;
  env?: string;
  validate?: (value: unknown) => boolean;
}

export interface ConfigLayer {
  source: ConfigSource;
  values: Record<string, unknown>;
  priority: number;
}

export class Configuration {
  private schemas: Map<string, ConfigSchema> = new Map();
  private layers: ConfigLayer[] = [];
  private merged: Map<string, ConfigEntry> = new Map();
  private listeners: Array<(key: string, value: unknown) => void> = [];

  constructor() {
    void DEFAULTS;
    this.layers.push({ source: 'default', values: {}, priority: 0 });
    this.layers.push({ source: 'env', values: {}, priority: 10 });
  }

  defineSchema(key: string, schema: ConfigSchema): void {
    this.schemas.set(key, schema);
    if (schema.default !== undefined) this.setDefault(key, schema.default);
  }

  setDefault(key: string, value: unknown): void {
    const layer = this.layers.find(l => l.source === 'default');
    if (layer) layer.values[key] = value;
    this.rebuild();
  }

  setEnv(key: string, value: unknown): void {
    const layer = this.layers.find(l => l.source === 'env');
    if (layer) layer.values[key] = value;
    this.rebuild();
  }

  loadFromEnv(prefix: string = 'COS_'): void {
    const layer = this.layers.find(l => l.source === 'env');
    if (!layer) return;
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.replace(prefix, '').toLowerCase().replace(/_/g, '.');
        layer.values[configKey] = value;
      }
    }
    this.rebuild();
  }

  loadFromFile(filePath: string): void {
    try {
      const fs = require('fs') as typeof import('node:fs');
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as Record<string, unknown>;
      this.layers = this.layers.filter(l => l.source !== 'file');
      this.layers.push({ source: 'file', values: data, priority: 20 });
      this.rebuild();
    } catch (error) {
      console.warn(`[Config] Could not load file ${filePath}:`, (error as Error).message);
    }
  }

  setRuntime(key: string, value: unknown): void {
    let layer = this.layers.find(l => l.source === 'runtime');
    if (!layer) {
      layer = { source: 'runtime', values: {}, priority: 30 };
      this.layers.push(layer);
    }
    layer.values[key] = value;
    this.rebuild();
  }

  get<T>(key: string): T | undefined {
    const entry = this.merged.get(key);
    if (!entry) {
      const schema = this.schemas.get(key);
      if (schema?.env) {
        const envVal = process.env[schema.env];
        if (envVal !== undefined) return this.coerce(envVal, schema.type) as T;
      }
      return undefined;
    }
    return entry.value as T;
  }

  getOrThrow<T>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) throw new Error(`Configuration key '${key}' is required but not set`);
    return value;
  }

  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of this.merged) result[key] = entry.value;
    return result;
  }

  onChange(listener: (key: string, value: unknown) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  snapshot(): Record<string, { value: unknown; source: ConfigSource }> {
    const result: Record<string, { value: unknown; source: ConfigSource }> = {};
    for (const [key, entry] of this.merged) result[key] = { value: entry.value, source: entry.source };
    return result;
  }

  loadPresets(): void {
    this.defineSchema('server.host', { type: 'string', default: '0.0.0.0', env: 'COS_HOST', description: 'HTTP server host' });
    this.defineSchema('server.port', { type: 'number', default: 8080, env: 'COS_PORT', description: 'HTTP server port' });
    this.defineSchema('log.level', { type: 'string', default: 'info', env: 'COS_LOG_LEVEL', description: 'Log level' });
    this.defineSchema('log.format', { type: 'string', default: 'text', env: 'COS_LOG_FORMAT', description: 'Log format (text/json)' });
    this.defineSchema('storage.memory.maxEntries', { type: 'number', default: 10000, env: 'COS_MEMORY_MAX', description: 'Max memory entries' });
    this.defineSchema('storage.vector.dimension', { type: 'number', default: 128, env: 'COS_VECTOR_DIM', description: 'Embedding dimension' });
    this.defineSchema('auth.jwtSecret', { type: 'string', default: 'change-me-in-production', env: 'COS_JWT_SECRET', description: 'JWT signing secret' });
    this.defineSchema('auth.apiKeys', { type: 'array', default: [], env: 'COS_API_KEYS', description: 'Comma-separated API keys' });
    this.defineSchema('reasoning.defaultEngine', { type: 'string', default: 'chain_of_thought', env: 'COS_REASONING_ENGINE', description: 'Default reasoning engine' });
    this.defineSchema('selfImprovement.enabled', { type: 'boolean', default: true, env: 'COS_SELF_IMPROVEMENT', description: 'Enable self-improvement' });
    this.defineSchema('selfImprovement.evalFrequency', { type: 'number', default: 3, env: 'COS_EVAL_FREQ', description: 'Auto-eval every N outputs' });
    this.defineSchema('selfImprovement.metaCogInterval', { type: 'number', default: 300, env: 'COS_META_COG_INTERVAL', description: 'Meta-cognition interval (s)' });
    this.loadFromEnv('COS_');
  }

  private rebuild(): void {
    const sorted = [...this.layers].sort((a, b) => a.priority - b.priority);
    this.merged.clear();

    for (const layer of sorted) {
      for (const [key, value] of Object.entries(layer.values)) {
        const existing = this.merged.get(key);
        if (!existing || layer.priority >= (existing.sourcePriority ?? Number.NEGATIVE_INFINITY)) {
          this.merged.set(key, { value, source: layer.source, sourcePriority: layer.priority });
        }
      }
    }

    for (const [key, schema] of this.schemas) {
      if (!this.merged.has(key) && schema.required) {
        const envVal = schema.env ? process.env[schema.env] : undefined;
        if (envVal !== undefined) {
          this.merged.set(key, { value: this.coerce(envVal, schema.type), source: 'env', sourcePriority: 10 });
        }
      }
    }
  }

  private coerce(value: string, type: ConfigSchema['type']): unknown {
    switch (type) {
      case 'number': return Number(value);
      case 'boolean': return value === 'true' || value === '1';
      case 'array': return value.split(',').map(s => s.trim());
      case 'object': {
        try { return JSON.parse(value) as unknown; }
        catch { return value; }
      }
      default: return value;
    }
  }
}
