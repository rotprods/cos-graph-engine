export type GraphFrameworkErrorCode =
  | 'MODULE_CONFORMANCE_FAILED'
  | 'MODULE_ALREADY_INSTALLED'
  | 'MODULE_DEPENDENCY_MISSING'
  | 'MODULE_IN_USE'
  | 'CAPABILITY_ALREADY_REGISTERED'
  | 'CAPABILITY_NOT_FOUND'
  | 'CAPABILITY_IDENTITY_MISMATCH'
  | 'EXECUTION_MODE_UNSUPPORTED'
  | 'EXECUTION_CANCELLED'
  | 'EXECUTION_POLICY_REQUIRED'
  | 'EXECUTION_POLICY_FAILED'
  | 'EXECUTION_DENIED'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'CAPABILITY_EXECUTION_FAILED';

export class GraphFrameworkError extends Error {
  readonly code: GraphFrameworkErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  override readonly cause?: unknown;

  constructor(
    code: GraphFrameworkErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    cause?: unknown,
  ) {
    super(message);
    this.name = 'GraphFrameworkError';
    this.code = code;
    this.details = details;
    this.cause = cause;
  }
}
