import { EntityId, Cost, CellContext } from '@cos/core';
import { generateId } from '@cos/core';
import * as https from 'https';
import * as http from 'http';

// ================================================================
// LLM ADAPTER LAYER — Abstract interface for any LLM provider
// ================================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  latency: number;
  cost: Cost;
}

export interface LLMProvider {
  readonly name: string;
  readonly models: string[];
  generate(request: LLMRequest, context?: CellContext): Promise<LLMResponse>;
  isAvailable(): boolean;
}

// ================================================================
// SIMULATED PROVIDER — Pattern-based generation (default)
// ================================================================

export class SimulatedProvider implements LLMProvider {
  readonly name = 'simulated';
  readonly models = ['simulated-default'];

  isAvailable(): boolean { return true; }

  async generate(request: LLMRequest, context?: CellContext): Promise<LLMResponse> {
    const startTime = Date.now();
    const lastMsg = request.messages[request.messages.length - 1]?.content || '';
    const systemMsg = request.messages.find(m => m.role === 'system')?.content || '';

    const content = this.generateResponse(lastMsg, systemMsg, request.temperature || 0.7);

    // Simulate token usage
    const totalTokens = content.length + lastMsg.length;
    return {
      content,
      model: 'simulated-default',
      usage: { promptTokens: lastMsg.length, completionTokens: content.length, totalTokens },
      latency: Date.now() - startTime,
      cost: { units: 'tokens', amount: totalTokens, tokens: { input: lastMsg.length, output: content.length, total: totalTokens } },
    };
  }

  private generateResponse(prompt: string, system: string, temperature: number): string {
    const promptLower = prompt.toLowerCase();

    // Extract problem/topic from structured inputs
    const problemMatch = prompt.match(/problem["']?\s*:\s*["']([^"']+)/i) || prompt.match(/["']problem["']\s*:\s*["']([^"']+)/i);
    const topicMatch = prompt.match(/topic["']?\s*:\s*["']([^"']+)/i);
    const queryMatch = prompt.match(/query["']?\s*:\s*["']([^"']+)/i);
    const question = problemMatch?.[1] || topicMatch?.[1] || queryMatch?.[1] || prompt.substring(0, 80);

    if (system.includes('evaluate') || system.includes('critique')) {
      const score = 0.5 + (Math.random() * 0.4);
      const aspects = ['accuracy', 'completeness', 'coherence', 'relevance'];
      let evalText = aspects.map(a => {
        const s = Math.min(1, score + (Math.random() * 0.3 - 0.15));
        return `${a}: ${(s * 100).toFixed(0)}/100 — ${s > 0.7 ? 'good' : s > 0.5 ? 'acceptable' : 'needs improvement'}`;
      }).join('\n');
      return `Evaluation Report:\n${evalText}\n\nOverall: ${(score * 100).toFixed(0)}/100\nStrengths: Good coverage of core concepts\nWeaknesses: Could explore edge cases more thoroughly`;
    }

    if (system.includes('debate') || system.includes('argument')) {
      const stance = prompt.includes('Pro') ? 'supporting' : prompt.includes('Con') ? 'opposing' : 'neutral';
      return `Argument from ${stance} perspective on "${question.substring(0, 50)}":\n\n` +
        `The evidence suggests that ${question.substring(0, 40)} has significant implications. ` +
        `From a ${stance} standpoint, the key considerations are: (1) empirical validation, ` +
        `(2) theoretical consistency, and (3) practical applicability. Further analysis is needed ` +
        `to fully understand the trade-offs involved in this complex topic.`;
    }

    if (system.includes('step') || system.includes('decompose') || promptLower.includes('step')) {
      const steps = prompt.match(/steps["']?\s*:\s*(\d+)/i);
      const numSteps = steps ? Math.min(parseInt(steps[1]), 7) : 5;
      const result: string[] = [];
      for (let i = 0; i < numSteps; i++) {
        result.push(`Step ${i + 1}/${numSteps}: Analyzing "${question.substring(0, 40)}" — ` +
          `processing substep ${i + 1} of the reasoning chain. ` +
          `Applying systematic decomposition to understand the underlying structure.`);
      }
      return result.join('\n');
    }

    // Default: informative response
    return `Analysis of "${question.substring(0, 60)}":\n\n` +
      `Based on the available information, we can identify several key aspects:\n\n` +
      `1. **Core Concept**: The subject involves multiple interconnected components that require systematic analysis.\n\n` +
      `2. **Key Insight**: The relationship between the components reveals patterns that suggest a structured approach is most effective.\n\n` +
      `3. **Recommendation**: Proceed with a phased strategy, starting with the most foundational elements and building up complexity.\n\n` +
      `Confidence in this analysis: ${(0.6 + Math.random() * 0.3).toFixed(2)}`;
  }
}

// ================================================================
// OPENAI-COMPATIBLE PROVIDER — Real HTTP calls
// ================================================================

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; defaultModel?: string }) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = config?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.defaultModel = config?.defaultModel || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async generate(request: LLMRequest, context?: CellContext): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI provider not available: no API key configured. Set OPENAI_API_KEY or use SimulatedProvider.');
    }

    const startTime = Date.now();
    const model = request.model || this.defaultModel;

    const body = JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2048,
    });

    const response = await this.post('/chat/completions', body);
    const data = JSON.parse(response);

    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      content,
      model: data.model || model,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      latency: Date.now() - startTime,
      cost: { units: 'tokens', amount: usage.total_tokens || 0, tokens: { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0, total: usage.total_tokens || 0 } },
    };
  }

  private post(path: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const mod = url.protocol === 'https:' ? https : http;
      const req = mod.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 60000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`OpenAI API error ${res.statusCode}: ${data.substring(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('OpenAI API request timeout')); });
      req.write(body);
      req.end();
    });
  }
}

// ================================================================
// LLM FACTORY — Creates the right provider based on config
// ================================================================

export class LLMFactory {
  private providers: Map<string, LLMProvider> = new Map();

  constructor() {
    // Register built-in providers
    this.register(new SimulatedProvider());
    this.register(new OpenAIProvider());
  }

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name?: string): LLMProvider {
    if (name && this.providers.has(name)) return this.providers.get(name)!;

    // Auto-select: if OpenAI is available, use it; otherwise use simulated
    const openai = this.providers.get('openai');
    if (openai?.isAvailable()) return openai;

    return this.providers.get('simulated')!;
  }

  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isAvailable());
  }

  getAllProviders(): LLMProvider[] {
    return Array.from(this.providers.values());
  }
}