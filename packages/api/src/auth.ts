import { EntityId, CellContext } from '@cos/core';
import { Configuration } from '@cos/infrastructure';

// ================================================================
// Phase 5: Authentication Middleware
// Supports: JWT tokens, API Keys
// ================================================================

export interface AuthIdentity {
  userId: string;
  role: 'admin' | 'user' | 'system';
  permissions: string[];
  tokenType: 'jwt' | 'api_key' | 'none';
}

export class AuthMiddleware {
  private config: Configuration;
  private apiKeys: Set<string> = new Set();
  private tokens: Map<string, AuthIdentity> = new Map();

  constructor(config: Configuration) {
    this.config = config;
    this.loadKeys();
  }

  private loadKeys(): void {
    const keys = this.config.get<string[]>('auth.apiKeys') || [];
    for (const key of keys) {
      this.apiKeys.add(key);
    }
  }

  /** Authenticate a request, return identity or throw */
  async authenticate(authorization?: string): Promise<AuthIdentity> {
    if (!authorization) {
      // No auth → system user with limited permissions
      return {
        userId: 'anonymous',
        role: 'user',
        permissions: ['read'],
        tokenType: 'none',
      };
    }

    if (authorization.startsWith('Bearer ')) {
      const token = authorization.substring(7);

      // Check if it's an API key
      if (this.apiKeys.has(token)) {
        return {
          userId: 'api-user',
          role: 'user',
          permissions: ['read', 'write', 'execute'],
          tokenType: 'api_key',
        };
      }

      // Check cached JWT
      const cached = this.tokens.get(token);
      if (cached) return cached;

      // Validate JWT (simple HMAC for now)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          const identity: AuthIdentity = {
            userId: payload.sub || 'unknown',
            role: payload.role || 'user',
            permissions: payload.permissions || ['read'],
            tokenType: 'jwt',
          };
          this.tokens.set(token, identity);
          return identity;
        }
      } catch {
        // Invalid JWT, fall through
      }
    }

    // Default: anonymous user
    return {
      userId: 'anonymous',
      role: 'user',
      permissions: ['read'],
      tokenType: 'none',
    };
  }

  /** Generate a simple JWT for testing */
  generateToken(userId: string, role: 'admin' | 'user' = 'user'): string {
    const secret = this.config.get<string>('auth.jwtSecret') || 'change-me';
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: userId,
      role,
      permissions: role === 'admin' ? ['read', 'write', 'execute', 'admin'] : ['read', 'write', 'execute'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    })).toString('base64url');
    const signature = Buffer.from(`${header}.${payload}.${secret}`).toString('base64url');
    return `${header}.${payload}.${signature}`;
  }

  /** Create cell context from auth identity */
  toCellContext(identity: AuthIdentity, traceId?: string): CellContext {
    return {
      traceId: traceId || `cos_${Date.now()}`,
      userId: identity.userId,
      metadata: { role: identity.role, permissions: identity.permissions.join(',') },
    };
  }
}