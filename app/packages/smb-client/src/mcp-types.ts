// MCP Protocol Types for the Agency MCP Bridge
// JSON Schema for tool discovery, invocation, and resource access

// === Protocol Constants ===
export const MCP_PROTOCOL_VERSION = '0.1.0';
export const MCP_PROTOCOL = 'agency-mcp';

// === Message Types ===
export type MCPMessageType =
  | 'ping'
  | 'pong'
  | 'hello'
  | 'welcome'
  | 'error'
  | 'disconnect'
  | 'tools/list'
  | 'tools/list:response'
  | 'tools/call'
  | 'tools/call:response'
  | 'resources/list'
  | 'resources/list:response'
  | 'resources/read'
  | 'resources/read:response'
  | 'events/subscribe'
  | 'events/emit'
  | 'events/event'
  | 'session/broadcast'
  | 'session/send'
  | 'session/info'
  | 'session/info:response'
  | 'memory/read'
  | 'memory/read:response'
  | 'memory/write'
  | 'memory/write:response';

// === Base Protocol ===
export interface MCPMessage {
  protocol: typeof MCP_PROTOCOL;
  version: string;
  type: MCPMessageType;
  id: string;
  sessionId?: string;
  source?: string;
  timestamp: string;
  payload?: unknown;
}

export interface MCPError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// === Hello / Welcome (handshake) ===
export interface MCPHelloPayload {
  name: string;
  type: 'agent' | 'component' | 'ui' | 'service' | 'chat' | 'subagent';
  project: string;
  version: string;
  capabilities?: string[];
}

export interface MCPWelcomePayload {
  sessionId: string;
  serverVersion: string;
  serverName: string;
  connectedPeers: number;
  serverCapabilities: string[];
}

// === Tools ===
export interface MCPTool {
  name: string;
  description: string;
  category: string;
  parameters: MCPParameter[];
  returns?: MCPParameter[];
}

export interface MCPParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface MCPToolCallPayload {
  tool: string;
  arguments: Record<string, unknown>;
  target?: string; // optional specific session
}

export interface MCPToolCallResponse {
  tool: string;
  success: boolean;
  result?: unknown;
  error?: MCPError;
  from?: string;
}

// === Resources ===
export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
  writable?: boolean;
}

export interface MCPResourceReadPayload {
  uri: string;
}

export interface MCPResourceReadResponse {
  uri: string;
  contents: unknown;
  mimeType?: string;
}

// === Events ===
export interface MCPEventPayload {
  type: string;
  data: Record<string, unknown>;
  source?: string;
  target?: string; // broadcast or specific session
}

// === Session ===
export interface MCPSessionInfo {
  sessionId: string;
  name: string;
  type: string;
  project: string;
  connectedAt: string;
  lastActivity: string;
  capabilities: string[];
  isAlive: boolean;
}

// === Memory (SMB-backed) ===
export interface MCPMemoryReadPayload {
  key: string;
}

export interface MCPMemoryWritePayload {
  key: string;
  value: string;
  category?: string;
  ttlSeconds?: number;
}

// === Built-in Server Tools ===
export const BUILTIN_TOOLS: MCPTool[] = [
  {
    name: 'mcp.ping',
    description: 'Health check — verifies connection is alive',
    category: 'system',
    parameters: [],
  },
  {
    name: 'mcp.session.info',
    description: 'Get info about the current or another session',
    category: 'system',
    parameters: [
      { name: 'sessionId', type: 'string', description: 'Session ID (omit for self)', required: false },
    ],
  },
  {
    name: 'mcp.session.list',
    description: 'List all connected sessions',
    category: 'system',
    parameters: [],
  },
  {
    name: 'mcp.session.broadcast',
    description: 'Broadcast a message to all connected sessions',
    category: 'system',
    parameters: [
      { name: 'type', type: 'string', description: 'Message type', required: true },
      { name: 'data', type: 'object', description: 'Message payload', required: true },
    ],
  },
  {
    name: 'mcp.session.send',
    description: 'Send a message to a specific session',
    category: 'system',
    parameters: [
      { name: 'targetSession', type: 'string', description: 'Target session ID', required: true },
      { name: 'type', type: 'string', description: 'Message type', required: true },
      { name: 'data', type: 'object', description: 'Message payload', required: true },
    ],
  },
  {
    name: 'mcp.memory.read',
    description: 'Read a value from the shared memory bus',
    category: 'memory',
    parameters: [
      { name: 'key', type: 'string', description: 'Memory key', required: true },
    ],
  },
  {
    name: 'mcp.memory.write',
    description: 'Write a value to the shared memory bus',
    category: 'memory',
    parameters: [
      { name: 'key', type: 'string', description: 'Memory key', required: true },
      { name: 'value', type: 'string', description: 'Value to store', required: true },
      { name: 'category', type: 'string', description: 'Optional category', required: false },
      { name: 'ttlSeconds', type: 'number', description: 'TTL in seconds', required: false },
    ],
  },
  {
    name: 'mcp.memory.search',
    description: 'Search the shared memory bus',
    category: 'memory',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true },
      { name: 'category', type: 'string', description: 'Filter by category', required: false },
    ],
  },
  {
    name: 'mcp.events.emit',
    description: 'Emit an event to the SMB event bus',
    category: 'events',
    parameters: [
      { name: 'type', type: 'string', description: 'Event type', required: true },
      { name: 'data', type: 'object', description: 'Event data', required: true },
    ],
  },
  {
    name: 'mcp.events.subscribe',
    description: 'Subscribe to events from the SMB event bus',
    category: 'events',
    parameters: [
      { name: 'types', type: 'array', description: 'Event types to filter (omit for all)', required: false },
    ],
  },
];