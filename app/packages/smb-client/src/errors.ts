export class SMBError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'SMBError';
  }
}

export class SMBRateLimitError extends SMBError {
  constructor(resetAt?: string) {
    super(`Rate limit exceeded. Reset at: ${resetAt}`, 429, 'rate_limit');
    this.name = 'SMBRateLimitError';
  }
}

export class SMBUnauthorizedError extends SMBError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'unauthorized');
    this.name = 'SMBUnauthorizedError';
  }
}

export class SMBNotFoundError extends SMBError {
  constructor(key: string) {
    super(`Note not found: ${key}`, 404, 'not_found');
    this.name = 'SMBNotFoundError';
  }
}