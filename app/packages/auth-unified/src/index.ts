import { SMBClient } from "@cos/smb-client";

export interface AuthToken {
  token: string;
  project: string;
  permissions: string[];
  expiresAt: number;
  issuedAt: number;
}

export interface AuthSession {
  id: string;
  userId: string;
  project: string;
  token: string;
  permissions: string[];
  createdAt: string;
  expiresAt: string;
}

const SMB_URL = "https://shared-memory-bus.higgsfield.app";
const SESSION_TTL = 3600;

export class AuthUnified {
  private smb: SMBClient;

  constructor(masterToken: string) {
    this.smb = new SMBClient({ baseUrl: SMB_URL, token: masterToken, timeout: 5000 });
  }

  async createToken(project: string, permissions: string[] = ["read"], ttlSeconds = 86400): Promise<AuthToken> {
    const token = "agency_" + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const authToken: AuthToken = { token, project, permissions, expiresAt, issuedAt: Date.now() };
    await this.smb.setNote("auth:token:" + token, JSON.stringify(authToken), { category: "auth", ttlSeconds });
    return authToken;
  }

  async validateToken(token: string): Promise<AuthToken | null> {
    const note = await this.smb.getNote("auth:token:" + token);
    if (!note) return null;
    const authToken: AuthToken = JSON.parse(note.value);
    if (Date.now() > authToken.expiresAt) return null;
    return authToken;
  }

  async revokeToken(token: string): Promise<void> {
    await this.smb.deleteNote("auth:token:" + token);
  }

  async createSession(token: string, userId: string): Promise<AuthSession> {
    const authToken = await this.validateToken(token);
    if (!authToken) throw new Error("Invalid token");
    const session: AuthSession = {
      id: crypto.randomUUID(),
      userId,
      project: authToken.project,
      token,
      permissions: authToken.permissions,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TTL * 1000).toISOString(),
    };
    await this.smb.setNote("auth:session:" + session.id, JSON.stringify(session), { category: "session", ttlSeconds: SESSION_TTL });
    return session;
  }

  async validateSession(sessionId: string): Promise<AuthSession | null> {
    const note = await this.smb.getNote("auth:session:" + sessionId);
    if (!note) return null;
    const session: AuthSession = JSON.parse(note.value);
    if (new Date(session.expiresAt) < new Date()) return null;
    return session;
  }

  middleware(requiredPermissions: string[] = ["read"]) {
    return async (request: Request): Promise<{ ok: boolean; session?: AuthSession; error?: string; status?: number }> => {
      const authHeader = request.headers.get("Authorization") || request.headers.get("X-Auth-Token");
      if (!authHeader) return { ok: false, error: "No authorization header", status: 401 };

      const token = authHeader.replace("Bearer ", "").replace("Agency ", "");
      const sessionId = request.headers.get("X-Session-Id");

      if (sessionId) {
        const session = await this.validateSession(sessionId);
        if (!session) return { ok: false, error: "Invalid or expired session", status: 401 };
        const hasPermission = requiredPermissions.every(p => session.permissions.includes(p));
        if (!hasPermission) return { ok: false, error: "Insufficient permissions", status: 403 };
        return { ok: true, session };
      }

      const authToken = await this.validateToken(token);
      if (!authToken) return { ok: false, error: "Invalid or expired token", status: 401 };
      const hasPermission = requiredPermissions.every(p => authToken.permissions.includes(p));
      if (!hasPermission) return { ok: false, error: "Insufficient permissions", status: 403 };
      return {
        ok: true,
        session: {
          id: "token-only", userId: "system", project: authToken.project,
          token: authToken.token, permissions: authToken.permissions,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(authToken.expiresAt).toISOString(),
        },
      };
    };
  }
}