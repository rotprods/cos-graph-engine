import { createHmac, timingSafeEqual } from 'node:crypto';
import { CellContext } from '@cos/core';
import { Configuration } from '@cos/infrastructure';

export interface AuthIdentity {
  userId: string;
  role: 'admin' | 'user' | 'system';
  permissions: string[];
  tokenType: 'jwt' | 'api_key' | 'none';
}

const MAX_TOKEN_LENGTH = 8192;
const MAX_JWT_LIFETIME_SECONDS = 86400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function anonymous(): AuthIdentity {
  return { userId: 'anonymous', role: 'user', permissions: [], tokenType: 'none' };
}

export class AuthMiddleware {
  constructor(private config: Configuration) {}

  private signingKey(): string {
    const key = this.config.get<string>('auth.jwtSecret');
    if (typeof key !== 'string' || Buffer.byteLength(key, 'utf8') < 32 || /^change-me/i.test(key)) {
      throw new Error('Configure auth.jwtSecret with a strong signing key of at least 32 bytes');
    }
    return key;
  }

  private isConfiguredApiKey(token: string): boolean {
    const candidate = Buffer.from(token, 'utf8');
    const keys = this.config.get<string[]>('auth.apiKeys') || [];
    for (const configured of keys) {
      if (typeof configured !== 'string' || configured.length === 0) continue;
      const expected = Buffer.from(configured, 'utf8');
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true;
    }
    return false;
  }

  async authenticate(authorization?: string): Promise<AuthIdentity> {
    if (!authorization || !authorization.startsWith('Bearer ')) return anonymous();
    const token = authorization.substring(7);
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return anonymous();

    if (this.isConfiguredApiKey(token)) {
      return { userId: 'api-user', role: 'user', permissions: ['read', 'write', 'execute'], tokenType: 'api_key' };
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return anonymous();
      const [encodedHeader, encodedPayload, signature] = parts;
      if (signature.length !== 43) return anonymous();
      const header: unknown = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
      if (!isRecord(header) || header.alg !== 'HS256' || header.typ !== 'JWT' || header.crit !== undefined) return anonymous();

      const expected = createHmac('sha256', this.signingKey()).update(`${encodedHeader}.${encodedPayload}`).digest();
      const supplied = Buffer.from(signature, 'base64url');
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return anonymous();

      const payload: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      if (!isRecord(payload) || typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 256) return anonymous();
      if (payload.iss !== 'cos' || payload.aud !== 'cos-api') return anonymous();
      if (payload.role !== 'user' && payload.role !== 'admin') return anonymous();
      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp) || payload.exp <= now) return anonymous();
      if (typeof payload.iat !== 'number' || !Number.isSafeInteger(payload.iat) || payload.iat > now || payload.exp <= payload.iat) return anonymous();
      if (payload.exp - payload.iat > MAX_JWT_LIFETIME_SECONDS) return anonymous();
      if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || !Number.isSafeInteger(payload.nbf) || payload.nbf > now)) return anonymous();
      const allowed = payload.role === 'admin' ? ['read', 'write', 'execute', 'admin'] : ['read', 'write', 'execute'];
      if (!Array.isArray(payload.permissions) || !payload.permissions.every(permission => typeof permission === 'string' && allowed.includes(permission))) return anonymous();
      return {
        userId: payload.sub,
        role: payload.role,
        permissions: [...new Set<string>(payload.permissions)],
        tokenType: 'jwt',
      };
    } catch {
      return anonymous();
    }
  }

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

  redactedConfiguration(): ReturnType<Configuration['snapshot']> {
    const result = this.config.snapshot();
    for (const [key, entry] of Object.entries(result)) {
      if (/^auth\.|secret|password|token|credential|api.?key/i.test(key)) {
        result[key] = { ...entry, value: '[REDACTED]' };
      }
    }
    return result;
  }

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
      iat: now, exp: now + MAX_JWT_LIFETIME_SECONDS,
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
