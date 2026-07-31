/**
 * SMB Client — COS Graph Engine integration with Shared Memory Bus.
 * Persists graph data, versioned computations, and user sessions.
 * Prefix: 'cos-' for all keys.
 */
import { SMBClient } from "@cos/smb-client";
import { bindings } from "./bindings.server";

const PREFIX = "cos-";
const SMB_URL = "https://shared-memory-bus.higgsfield.app";

let client: SMBClient | null = null;

function getClient(): SMBClient {
  if (!client) {
    const env = bindings() as Record<string, string | undefined>;
    const token = env.SMB_TOKEN;
    if (!token) throw new Error("SMB_TOKEN not set in bindings");
    client = new SMBClient({ baseUrl: SMB_URL, token, project: "cos-graph-engine", timeout: 10000 });
  }
  return client;
}

// ─── Graph Persistence (save/load graph structures) ───────────────────────

export async function saveGraph(graphId: string, data: Record<string, unknown>) {
  const c = getClient();
  return c.setNote(`${PREFIX}graph:${graphId}`, JSON.stringify(data), { category: "graph_data" });
}

export async function loadGraph(graphId: string): Promise<Record<string, unknown> | null> {
  const c = getClient();
  const note = await c.getNote(`${PREFIX}graph:${graphId}`);
  if (!note) return null;
  return JSON.parse(note.value);
}

export async function listGraphs() {
  const c = getClient();
  return c.listNotes("graph_data");
}

export async function deleteGraph(graphId: string) {
  const c = getClient();
  return c.deleteNote(`${PREFIX}graph:${graphId}`);
}

// ─── Versioned Graph Data (leveraging SMB versioning) ─────────────────────

export async function saveGraphVersion(graphId: string, version: number, data: Record<string, unknown>) {
  const c = getClient();
  return c.setNote(`${PREFIX}graph:${graphId}:v${version}`, JSON.stringify(data), { category: "graph_version" });
}

export async function listGraphVersions(graphId: string) {
  const c = getClient();
  return c.listVersions(`${PREFIX}graph:${graphId}`);
}

// ─── Computation Queue (for distributed graph processing) ─────────────────

export async function enqueueComputation(graphId: string, operation: string, payload: string) {
  const c = getClient();
  return c.queuePush(`${PREFIX}compute:${graphId}`, JSON.stringify({ operation, payload }));
}

export async function dequeueComputation(graphId: string) {
  const c = getClient();
  return c.queuePop(`${PREFIX}compute:${graphId}`);
}

// ─── User Sessions (ephemeral state) ──────────────────────────────────────

export async function saveSession(sessionId: string, data: Record<string, unknown>) {
  const c = getClient();
  return c.setNote(`${PREFIX}session:${sessionId}`, JSON.stringify(data), {
    category: "session",
    ttlSeconds: 3600,
  });
}

export async function loadSession(sessionId: string): Promise<Record<string, unknown> | null> {
  const c = getClient();
  const note = await c.getNote(`${PREFIX}session:${sessionId}`);
  if (!note) return null;
  return JSON.parse(note.value);
}

// ─── Locks (for concurrent graph editing) ─────────────────────────────────

export async function acquireGraphLock(graphId: string, userId: string): Promise<boolean> {
  const c = getClient();
  return c.acquireLock(`${PREFIX}lock:${graphId}`, userId, 60);
}

export async function releaseGraphLock(graphId: string, userId: string): Promise<boolean> {
  const c = getClient();
  return c.releaseLock(`${PREFIX}lock:${graphId}`, userId);
}

// ─── Health ───────────────────────────────────────────────────────────────

export async function checkSMBHealth() {
  const c = getClient();
  return c.health();
}