import { createHmac, timingSafeEqual } from 'node:crypto';
import { CellContext } from '@cos/core';
import { Configuration } from '@cos/infrastructure';

export interface AuthIdentity {
  userId: string;
  role: 'admin' | 'user' | 'system';
  permissions: string[];
  tokenType: 'jwt' | 'api_key' | 'none';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function anonymous(): AuthIdentity {
  return { userId: 'anonymous', role: 'user', permissions: [], tokenType: 'none' };
}

/** Local HS256 issuer/verifier and configured API-key authentication. */
export class AuthMiddleware {
  private config: Configuration;
  private apiKeys: Set<string> = new Set();

  constructor(config: Configuration) {
    this.config = config;
    for (const key of this.config.get<string[]>('auth.apiKeys') || []) {
      if (typeof key === 'string' && key.length > 0) this.apiKeys.add(key);
    }
  }

  private signingKey(): string {
    const key = this.config.get<string>('auth.jwtSecret');
    if (typeof key !== 'string' || Buffer.byteLength(key, 'utf8') < 32 || /^change-me/i.test(key)) {
      throw new Error('Configure auth.jwtSecret with a strong signing key of at least 32 bytes');
    }
    return key;
  }

  /** Invalid credentials never acquire anonymous read access or cached privileges. */
  async authenticate(authorization?: string): Promise<AuthIdentity> {
    if (!authorization || !authorization.startsWith('Bearer ')) return anonymous();
    const token = authorization.substring(7);
    if (token.length === 0 || token.length > 8192) return anonymous();

    if (this.apiKeys.has(token)) {
      return { userId: 'api-user', role: 'user', permissions: ['read', 'write', 'execute'], tokenType: 'api_key' };
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return anonymous();
      const [encodedHeader, encodedPayload, signature] = parts;
      if (signature.length !== 43) return anonymous();
      const header: unknown = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
      if (!isRecord(header) || header.alg !== 'HS256' || header.typ !== 'JWT' || header.crit !== undefined) return anonymous();

      const expected = createHmac('sha256', this.signingKey())
        .update(`${encodedHeader}.${encodedPayload}`).digest();
      const supplied = Buffer.from(signature, 'base64url');
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return anonymous();

      const payload: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      if (!isRecord(payload) || typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 256) return anonymous();
      if (payload.iss !== 'cos' || payload.aud !== 'cos-api') return anonymous();
      if (payload.role !== 'user' && payload.role !== 'admin') return anonymous();
      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp) || payload.exp <= now) return anonymous();
      if (typeof payload.iat !== 'number' || !Number.isSafeInteger(payload.iat) || payload.iat > now || payload.exp <= payload.iat) return anonymous();
      if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || !Number.isSafeInteger(payload.nbf) || payload.nbf > now)) return anonymous();
      const allowed = payload.role === 'admin' ? ['read', 'write', 'execute', 'admin'] : ['read', 'write', 'execute'];
      if (!Array.isArray(payload.permissions) || !payload.permissions.every(p => typeof p === 'string' && allowed.includes(p))) return anonymous();
      return {
        userId: payload.sub,
        role: payload.role,
        permissions: [...new Set<string>(payload.permissions)],
        tokenType: 'jwt',
      };
    } catch {
      // Parse, signature and configuration failures all deny access.
      return anonymous();
    }
  }

  /** Route-level gate, called before reading bodies or invoking services. */
  authorize(identity: AuthIdentity, method: string, path: string): boolean {
    if (method === 'GET' && ['/', '/dashboard', '/health', '/chat', '/research'].includes(path)) return true;
    if (identity.tokenType === 'none') return false;
    if (path === '/config' || path === '/auth/token') {
      return identity.role === 'admin' && identity.permissions.includes('admin');
    }
    if (path === '/self-improve') return identity.permissions.includes('execute');
    if (method === 'GET' || method === 'HEAD') return identity.permissions.includes('read');
    return identity.permissions.includes('write') && identity.permissions.includes('execute');
  }

  /** Configuration diagnostics must not return signing keys or other credentials. */
  redactedConfiguration(): ReturnType<Configuration['snapshot']> {
    const result = this.config.snapshot();
    for (const [key, entry] of Object.entries(result)) {
      if (/^auth\.|secret|password|token|credential|api.?key/i.test(key)) {
        result[key] = { ...entry, value: '[REDACTED]' };
      }
    }
    return result;
  }

  /** Issue a local token. HTTP callers must pass the administrator route gate. */
  generateToken(userId: string, role: 'admin' | 'user' = 'user'): string {
    if (typeof userId !== 'string' || userId.length === 0 || userId.length > 256 || (role !== 'admin' && role !== 'user')) {
      throw new Error('Invalid token subject or role');
    }
    const secret = this.signingKey();
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      sub: userId, role, iss: 'cos', aud: 'cos-api',
      permissions: role === 'admin' ? ['read', 'write', 'execute', 'admin'] : ['read', 'write', 'execute'],
      iat: now, exp: now + 86400,
    })).toString('base64url');
    const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  }

  toCellContext(identity: AuthIdentity, traceId?: string): CellContext {
    return {
      traceId: traceId || `cos_${Date.now()}`,
      userId: identity.userId,
      metadata: { role: identity.role, permissions: identity.permissions.join(',') },
    };
  }
}
