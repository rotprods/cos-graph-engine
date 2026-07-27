// COS Constants — single source of truth for defaults
// Never hardcode these values elsewhere; import from here

export const DEFAULTS = {
  SERVER_HOST: '0.0.0.0',
  SERVER_PORT: 8080,
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'text',
  JWT_SECRET: 'change-me-in-production',
  MEMORY_MAX_ENTRIES: 10000,
  VECTOR_DIMENSION: 128,
  DATA_DIR: '.cos-data',
  REASONING_ENGINE: 'chain_of_thought',
  SELF_IMPROVEMENT_ENABLED: true,
  EVAL_FREQUENCY: 3,
  META_COG_INTERVAL: 300,
} as const;