// MCP Client SDK — use from any Higgsfield repo, sub-agent, or chat session
// Connects to the Agency MCP Bridge via SSE + POST
import type {
  MCPMessage,
  MCPHelloPayload,
  MCPTool,
  MCPToolCallResponse,
  MCPResource,
  MCPSessionInfo,
  MCPEventPayload,
} from './types';

export interface MCPClientConfig {
  bridgeUrl?: string;
  name: string;
  type: MCPHelloPayload['type'];
  project: string;
  capabilities?: string[];
  apiKey?: string;
  autoReconnect?: boolean;
  maxRetries?: number;
}

export interface MCPEventMap {
  open: () => void;
  close: () => void;
  error: (err: Error) => void;
  message: (msg: MCPMessage) => void;
  event: (type: string, data: unknown) => void;
}

type MCPEventHandler<E extends keyof MCPEventMap> = MCPEventMap[E];

export class MCPClient {
  private bridgeUrl: string;
  private hello: MCPHelloPayload;
  private apiKey: string;
  private autoReconnect: boolean;
  private maxRetries: number;
  private eventSource: EventSource | null = null;
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private pendingResponses: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }> = new Map();
  private messageCounter = 0;
  private sessionId: string | null = null;
  private connected = false;
  private retryCount = 0;
  private serverUrl: string;

  // Built-in tools exposed directly
  tools: MCPClientTools;

  constructor(config: MCPClientConfig) {
    this.bridgeUrl = config.bridgeUrl || 'https://agency-mcp-bridge.higgsfield.app';
    this.hello = {
      name: config.name,
      type: config.type,
      project: config.project,
      version: '1.0.0',
      capabilities: config.capabilities || [],
    };
    this.apiKey = config.apiKey || '';
    this.autoReconnect = config.autoReconnect ?? true;
    this.maxRetries = config.maxRetries ?? 5;
    this.serverUrl = `${this.bridgeUrl}/api/mcp`;
    this.tools = new MCPClientTools(this);
  }

  async connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      const keyParam = this.apiKey ? `&key=${encodeURIComponent(this.apiKey)}` : '';
      const url = `${this.serverUrl}/stream?name=${encodeURIComponent(this.hello.name)}&type=${this.hello.type}&project=${encodeURIComponent(this.hello.project)}&capabilities=${encodeURIComponent((this.hello.capabilities || []).join(','))}${keyParam}`;
      const es = new EventSource(url);
      this.eventSource = es;

      es.onopen = () => {
        this.connected = true;
        this.retryCount = 0;
        this.emit('open');
      };

      es.onmessage = (event) => {
        try {
          const msg: MCPMessage = JSON.parse(event.data);
          this.handleIncoming(msg);
        } catch {}
      };

      es.addEventListener('welcome', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const msg = data as MCPMessage;
          if (msg.type === 'welcome' && msg.payload) {
            const welcome = msg.payload as any;
            this.sessionId = welcome.sessionId || msg.sessionId;
            this.connected = true;
            resolve(this.sessionId!);
          }
        } catch (err) {
          reject(new Error('Failed to parse welcome'));
        }
      });

      es.onerror = () => {
        this.connected = false;
        if (!this.sessionId) {
          reject(new Error('Connection failed'));
          return;
        }
        this.emit('error', new Error('SSE connection lost'));
        if (this.autoReconnect && this.retryCount < this.maxRetries) {
          this.retryCount++;
          setTimeout(() => this.connect(), 2000 * this.retryCount);
        }
      };

      // Timeout if no welcome within 10s
      setTimeout(() => {
        if (!this.sessionId) {
          es.close();
          reject(new Error('Connection timeout'));
        }
      }, 10_000);
    });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connected = false;
    this.sessionId = null;
    this.emit('close');
  }

  get session(): string | null {
    return this.sessionId;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // === Send message (POST) ===
  async send(type: string, payload?: unknown, target?: string): Promise<MCPMessage> {
    if (!this.sessionId) throw new Error('Not connected');

    const id = `msg-${++this.messageCounter}-${crypto.randomUUID()}`;
    const msg: MCPMessage = {
      protocol: 'agency-mcp',
      version: '0.1.0',
      type: type as any,
      id,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      payload,
    };

    // Send via POST
    const res = await fetch(`${this.serverUrl}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });

    const responseMsg: MCPMessage = await res.json();

    // If there's a pending response (tools/call), resolve it
    if (responseMsg.id && this.pendingResponses.has(responseMsg.id)) {
      const pending = this.pendingResponses.get(responseMsg.id)!;
      clearTimeout(pending.timer);
      this.pendingResponses.delete(responseMsg.id);
      pending.resolve(responseMsg);
    }

    return responseMsg;
  }

  // === Send with response waiting ===
  async sendAndWait(type: string, payload?: unknown, timeoutMs = 30_000): Promise<MCPMessage> {
    if (!this.sessionId) throw new Error('Not connected');

    const id = `msg-${++this.messageCounter}-${crypto.randomUUID()}`;
    const msg: MCPMessage = {
      protocol: 'agency-mcp',
      version: '0.1.0',
      type: type as any,
      id,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      payload,
    };

    const responseType = `${type}:response`;

    return new Promise((resolve, reject) => {
      // Set up a one-shot listener for the response
      const handler = (incoming: MCPMessage) => {
        if (incoming.id === id && incoming.type === responseType) {
          this.off('message', handler as any);
          const pending = this.pendingResponses.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingResponses.delete(id);
          }
          resolve(incoming);
        }
        // Also match by correlation
        if (incoming.id === id) {
          this.off('message', handler as any);
          const pending = this.pendingResponses.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingResponses.delete(id);
          }
          resolve(incoming);
        }
      };

      this.on('message', handler as any);

      // Timeout
      const timer = setTimeout(() => {
        this.off('message', handler as any);
        this.pendingResponses.delete(id);
        reject(new Error(`Response timeout for ${type} (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pendingResponses.set(id, {
        resolve: (v) => resolve(v as MCPMessage),
        reject,
        timer,
      });

      // Send via POST
      fetch(`${this.serverUrl}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(reject);
    });
  }

  // === Event System ===
  on<E extends keyof MCPEventMap>(event: E, handler: MCPEventHandler<E>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler as any);
    return () => this.eventListeners.get(event)?.delete(handler as any);
  }

  off<E extends keyof MCPEventMap>(event: E, handler: MCPEventHandler<E>) {
    this.eventListeners.get(event)?.delete(handler as any);
  }

  private emit<E extends keyof MCPEventMap>(event: E, ...args: Parameters<MCPEventMap[E]>) {
    this.eventListeners.get(event)?.forEach((handler) => {
      try {
        (handler as Function)(...args);
      } catch {}
    });
  }

  private handleIncoming(msg: MCPMessage) {
    this.emit('message', msg);

    // Resolve pending responses
    if (msg.id && this.pendingResponses.has(msg.id)) {
      const pending = this.pendingResponses.get(msg.id)!;
      clearTimeout(pending.timer);
      this.pendingResponses.delete(msg.id);
      pending.resolve(msg);
    }

    // Emit typed events
    if (msg.type === 'events/event' && msg.payload) {
      const eventPayload = msg.payload as { type: string; data: unknown };
      this.emit('event', eventPayload.type, eventPayload.data);
    }
  }
}

// === High-level client tools ===
export class MCPClientTools {
  private client: MCPClient;

  constructor(client: MCPClient) {
    this.client = client;
  }

  async list(): Promise<MCPTool[]> {
    const res = await this.client.sendAndWait('tools/list');
    return (res.payload as any)?.tools || [];
  }

  async call(tool: string, args: Record<string, unknown> = {}): Promise<MCPToolCallResponse> {
    const res = await this.client.sendAndWait('tools/call', { tool, arguments: args });
    return res.payload as unknown as MCPToolCallResponse;
  }

  async ping(): Promise<{ pong: boolean; serverTime: string }> {
    const res = await this.client.sendAndWait('ping');
    return res.payload as any;
  }

  async listSessions(): Promise<MCPSessionInfo[]> {
    const res = await this.client.sendAndWait('tools/call', { tool: 'mcp.session.list', arguments: {} });
    return (res.payload as any)?.result || [];
  }

  async broadcast(type: string, data: Record<string, unknown>): Promise<void> {
    await this.client.send('session/broadcast', { type, data });
  }

  async sendTo(targetSession: string, type: string, data: Record<string, unknown>): Promise<void> {
    await this.client.send('session/send', { targetSession, type, data });
  }

  async memoryRead(key: string): Promise<string | null> {
    const res = await this.client.sendAndWait('tools/call', { tool: 'mcp.memory.read', arguments: { key } });
    return (res.payload as any)?.result?.value ?? null;
  }

  async memoryWrite(key: string, value: string, category?: string): Promise<void> {
    await this.client.send('tools/call', { tool: 'mcp.memory.write', arguments: { key, value, category } });
  }

  async emitEvent(type: string, data: Record<string, unknown>): Promise<void> {
    await this.client.send('events/emit', { type, data });
  }
}