import { describe, it, expect } from "bun:test";
import { AuthUnified } from "../src/index";

const auth = new AuthUnified("smb-agent-2026-shared-secure-token");

describe("AuthUnified", () => {
  it("creates and validates a token", async () => {
    const token = await auth.createToken("test-project", ["read", "write"]);
    expect(token.project).toBe("test-project");
    const validated = await auth.validateToken(token.token);
    expect(validated).not.toBeNull();
    expect(validated!.project).toBe("test-project");
  });

  it("creates and validates a session", async () => {
    const token = await auth.createToken("test-project", ["read"]);
    const session = await auth.createSession(token.token, "user-1");
    expect(session.userId).toBe("user-1");
    const validated = await auth.validateSession(session.id);
    expect(validated).not.toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await auth.createToken("test", ["read"], 0);
    await new Promise(r => setTimeout(r, 10));
    const validated = await auth.validateToken(token.token);
    expect(validated).toBeNull();
  });

  it("middleware rejects missing auth", async () => {
    const req = new Request("https://test.com");
    const result = await auth.middleware()(req);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it("middleware accepts valid token", async () => {
    const token = await auth.createToken("test", ["read"]);
    const req = new Request("https://test.com", { headers: { "Authorization": "Bearer " + token.token } });
    const result = await auth.middleware()(req);
    expect(result.ok).toBe(true);
  });
});