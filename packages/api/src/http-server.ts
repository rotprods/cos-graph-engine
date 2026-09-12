import * as http from 'http';
import { EntityId } from '@cos/core';
import { COSServer } from './server';
import { AuthMiddleware } from './auth';
import { Configuration } from '@cos/infrastructure';
import { createOperatorActionPage, createOperatorDashboardPage } from './operator-ui';

class HttpRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const HARD_MAX_BODY_BYTES = 8 * 1024 * 1024;

/** REST boundary for COS. Privileged routes are authorized before reading bodies or invoking services. */
export class HttpApiServer {
  private httpServer: http.Server | null = null;
  private started = false;

  constructor(
    private cosServer: COSServer,
    private auth: AuthMiddleware,
    private config: Configuration,
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    const host = this.config.get<string>('server.host') || '0.0.0.0';
    const port = this.config.get<number>('server.port') || 8080;
    this.httpServer = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    await new Promise<void>((resolve) => {
      this.httpServer!.listen(port, host, () => {
        this.started = true;
        console.log(`[COS API] Server listening on http://${host}:${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.httpServer || !this.started) return;
    await new Promise<void>((resolve) => {
      this.httpServer!.close(() => {
        this.started = false;
        console.log('[COS API] Server stopped');
        resolve();
      });
    });
  }

  private setSecurityHeaders(res: http.ServerResponse): void {
    // The supported browser console is same-origin. Do not grant wildcard
    // cross-origin bearer access by default; explicit CORS policy requires
    // a separate reviewed deployment boundary.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    this.setSecurityHeaders(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const path = url.pathname;
      const method = req.method || 'GET';
      const authHeader = req.headers.authorization;
      const identity = await this.auth.authenticate(authHeader);

      if (!this.auth.authorize(identity, method, path)) {
        this.sendJson(res, identity.tokenType === 'none' ? 401 : 403, {
          error: 'Unauthorized or insufficient permissions',
        });
        return;
      }

      const body = this.methodMayHaveBody(method) ? await this.readBody(req) : {};

      if ((path === '/' || path === '/dashboard') && method === 'GET') {
        const page = createOperatorDashboardPage();
        this.sendHtml(res, page.html, page.nonce);
        return;
      }
      if (path === '/chat' && method === 'GET') {
        const page = createOperatorActionPage('COS Chat', '/chat', 'message');
        this.sendHtml(res, page.html, page.nonce);
        return;
      }
      if (path === '/research' && method === 'GET') {
        const page = createOperatorActionPage('COS Research Assistant', '/research', 'question');
        this.sendHtml(res, page.html, page.nonce);
        return;
      }

      if (path === '/health' && method === 'GET') {
        this.sendJson(res, 200, await this.cosServer.getHealth());
      } else if (path === '/stats' && method === 'GET') {
        this.sendJson(res, 200, await this.cosServer.getStats());
      } else if (path === '/process' && method === 'POST') {
        if (!identity.permissions.includes('execute')) {
          this.sendJson(res, 403, { error: 'Forbidden: execute permission required' });
          return;
        }
        const result = await this.cosServer.process({
          input: body.input,
          target: body.target,
          reasoning: body.reasoning,
          context: this.auth.toCellContext(identity, body.traceId),
        });
        this.sendJson(res, 200, result);
      } else if (path === '/memory' && method === 'GET') {
        this.sendJson(res, 200, await this.cosServer.memory.stats());
      } else if (path.startsWith('/memory/') && method === 'GET') {
        const id = path.substring(8) as EntityId;
        const entry = await this.cosServer.memory.retrieve(id);
        this.sendJson(res, entry ? 200 : 404, entry ?? { error: 'Not found' });
      } else if (path === '/knowledge' && method === 'GET') {
        this.sendJson(res, 200, await this.cosServer.knowledge.stats());
      } else if (path.startsWith('/knowledge/') && method === 'GET') {
        this.sendJson(res, 200, await this.cosServer.knowledge.query(path.substring(11)));
      } else if (path === '/self-improve' && method === 'GET') {
        this.sendJson(res, 200, await this.cosServer.selfImprovement.runMetaCognition(true));
      } else if (path === '/cells' && method === 'GET') {
        const cells = this.cosServer.cellHost.getAllCells().map((cell) => ({
          id: cell.definition.id,
          name: cell.definition.name,
          type: cell.definition.type,
          purpose: cell.definition.purpose,
          health: cell.state.health,
        }));
        this.sendJson(res, 200, cells);
      } else if (path.startsWith('/cells/') && method === 'GET') {
        const inspection = await this.cosServer.cellHost.inspectCell(path.substring(7) as EntityId);
        this.sendJson(res, inspection ? 200 : 404, inspection ?? { error: 'Cell not found' });
      } else if (path === '/goals' && method === 'POST') {
        if (typeof body.description !== 'string' || body.description.trim().length === 0) {
          this.sendJson(res, 400, { error: 'description required' });
          return;
        }
        const goal = await this.cosServer.createGoal(body.description, {
          traceId: `http-goal-${Date.now()}`,
        });
        this.sendJson(res, 201, goal);
      } else if (path === '/goals' && method === 'GET') {
        this.sendJson(res, 200, await this.cosServer.getActiveGoals());
      } else if (path.startsWith('/goals/') && method === 'POST') {
        const goalId = path.substring(7) as EntityId;
        const action = body.action || 'execute';
        if (action === 'execute') {
          this.sendJson(res, 200, await this.cosServer.executeGoal(goalId));
        } else if (action === 'step') {
          this.sendJson(res, 200, await this.cosServer.executeNextStep(goalId));
        } else {
          this.sendJson(res, 400, { error: `Unknown action: ${String(action)}` });
        }
      } else if (path === '/research' && method === 'POST') {
        await this.handleResearch(res, body);
      } else if (path === '/chat' && method === 'POST') {
        await this.handleChat(res, body);
      } else if (path === '/config' && method === 'GET') {
        res.setHeader('Cache-Control', 'no-store');
        this.sendJson(res, 200, this.auth.redactedConfiguration());
      } else if (path === '/auth/token' && method === 'POST') {
        const userId = typeof body.userId === 'string' ? body.userId : 'user';
        const role = body.role === 'admin' ? 'admin' : 'user';
        this.sendJson(res, 200, { token: this.auth.generateToken(userId, role) });
      } else {
        this.sendJson(res, 404, { error: 'Not found', path });
      }
    } catch (error) {
      const status = error instanceof HttpRequestError ? error.status : 500;
      if (status >= 500) {
        console.error('[COS API] request failed', {
          status,
          type: error instanceof Error ? error.name : 'UnknownError',
        });
      }
      this.sendJson(res, status, {
        error: error instanceof HttpRequestError ? error.message : 'Internal server error',
      });
    }
  }

  private async handleResearch(res: http.ServerResponse, body: Record<string, any>): Promise<void> {
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (!question) {
      this.sendJson(res, 400, { error: 'question required' });
      return;
    }
    const memResults = await this.cosServer.memory.query({ content: question, limit: 5 });
    const kgQuery = question.split(' ').slice(0, 5).join(' ');
    const kgResults = await this.cosServer.knowledge.query(kgQuery);
    const reasoningSteps = await this.cosServer.reasoning.reason(
      'chain_of_thought',
      { problem: question, steps: 5 },
      { traceId: `research-${Date.now()}` },
    );
    const llmResponse = await this.cosServer.llm.get().generate({
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant. Analyze the question thoroughly and provide structured analysis.',
        },
        {
          role: 'user',
          content: `Research question: ${question}\n\nContext from knowledge graph: ${kgResults
            .map((item: any) => `${item.subject} ${item.predicate} ${item.object}`)
            .join(', ')}\n\nProvide a structured analysis.`,
        },
      ],
    });
    await this.cosServer.memory.store(
      { type: 'research', question, answer: llmResponse.content },
      'episodic',
      { tags: ['research', question.split(' ').slice(0, 3).join('-')], importance: 0.8 },
    );
    await this.cosServer.selfImprovement.recordOutput(
      { type: 'research', question },
      { answer: llmResponse.content, steps: reasoningSteps.length },
    );
    const siStats = this.cosServer.selfImprovement.stats;
    this.sendJson(res, 200, {
      report: {
        title: `Research: ${question.substring(0, 60)}`,
        summary: llmResponse.content,
        conclusions: reasoningSteps.slice(-2).map((step) => String(step.output ?? '').substring(0, 100)),
      },
      reasoning: reasoningSteps.map((step) => ({ output: step.output, confidence: step.confidence })),
      llmTrace: { content: llmResponse.content.substring(0, 500) },
      knowledge: kgResults.slice(0, 5),
      memory: {
        entries: memResults.length,
        layers: Object.values((await this.cosServer.memory.stats()).byLayer).filter((count) => count > 0).length,
      },
      selfImprovement: { score: siStats.outputsRecorded > 0 ? 0.7 : 0.5, trend: 'stable' },
      confidence: llmResponse.usage.totalTokens > 0 ? 0.85 : 0.6,
    });
  }

  private async handleChat(res: http.ServerResponse, body: Record<string, any>): Promise<void> {
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      this.sendJson(res, 400, { error: 'message required' });
      return;
    }
    const memResults = await this.cosServer.memory.query({ content: message, limit: 3 });
    const kgResults = await this.cosServer.knowledge.query(message.split(' ').slice(0, 3).join(' '));
    const reasoning = await this.cosServer.reasoning.reason(
      'chain_of_thought',
      { problem: message, steps: 3 },
      { traceId: `chat-${Date.now()}` },
    );
    const llmResponse = await this.cosServer.llm.get().generate({
      messages: [
        { role: 'system', content: 'You are a cognitive operating system. Respond helpfully and concisely.' },
        { role: 'user', content: message },
      ],
    });
    await this.cosServer.memory.store(
      { role: 'user', content: message },
      'episodic',
      { tags: ['chat', 'user'], importance: 0.6 },
    );
    await this.cosServer.memory.store(
      { role: 'cos', content: llmResponse.content },
      'episodic',
      { tags: ['chat', 'cos'], importance: 0.6 },
    );
    await this.cosServer.selfImprovement.recordOutput(
      { type: 'chat', message },
      { response: llmResponse.content, quality: llmResponse.usage.totalTokens },
    );
    this.sendJson(res, 200, {
      response: llmResponse.content.substring(0, 2000),
      memory: memResults.length > 0 ? `${memResults.length} relevant memories` : 'none',
      knowledge: kgResults.length > 0 ? `${kgResults.length} facts found` : 'general',
      reasoning: `chain_of_thought: ${reasoning.length} steps`,
      confidence: llmResponse.usage.totalTokens > 0 ? 0.8 : 0.5,
    });
  }

  private methodMayHaveBody(method: string): boolean {
    return method === 'POST' || method === 'PUT' || method === 'PATCH';
  }

  private maxBodyBytes(): number {
    const configured = this.config.get<number>('server.maxBodyBytes');
    if (typeof configured === 'number' && Number.isSafeInteger(configured) && configured > 0) {
      return Math.min(configured, HARD_MAX_BODY_BYTES);
    }
    return DEFAULT_MAX_BODY_BYTES;
  }

  private readBody(req: http.IncomingMessage): Promise<Record<string, any>> {
    const maxBytes = this.maxBodyBytes();
    const lengthHeader = req.headers['content-length'];
    if (lengthHeader !== undefined) {
      const rawLength = Array.isArray(lengthHeader) ? lengthHeader[0] : lengthHeader;
      const declared = Number(rawLength);
      if (!Number.isSafeInteger(declared) || declared < 0) {
        return Promise.reject(new HttpRequestError(400, 'Invalid Content-Length'));
      }
      if (declared > maxBytes) {
        return Promise.reject(new HttpRequestError(413, 'Request body too large'));
      }
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      let settled = false;

      const cleanup = () => {
        req.off('data', onData);
        req.off('end', onEnd);
        req.off('error', onError);
        req.off('aborted', onAborted);
      };
      const fail = (error: HttpRequestError) => {
        if (settled) return;
        settled = true;
        cleanup();
        req.resume();
        reject(error);
      };
      const onData = (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maxBytes) {
          fail(new HttpRequestError(413, 'Request body too large'));
          return;
        }
        chunks.push(buffer);
      };
      const onEnd = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) {
          resolve({});
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          reject(new HttpRequestError(400, 'Malformed JSON request body'));
          return;
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new HttpRequestError(400, 'JSON request body must be an object'));
          return;
        }
        resolve(parsed as Record<string, any>);
      };
      const onError = () => fail(new HttpRequestError(400, 'Request body read failed'));
      const onAborted = () => fail(new HttpRequestError(400, 'Request body aborted'));

      req.on('data', onData);
      req.once('end', onEnd);
      req.once('error', onError);
      req.once('aborted', onAborted);
    });
  }

  private sendJson(res: http.ServerResponse, status: number, data: unknown): void {
    if (status >= 400) res.setHeader('Cache-Control', 'no-store');
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
  }

  private sendHtml(res: http.ServerResponse, html: string, scriptNonce: string): void {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }
}
