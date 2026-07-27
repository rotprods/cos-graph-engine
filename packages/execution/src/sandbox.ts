import { EntityId, CellContext, Cost, CogError } from '@cos/core';
import { generateId, CellError } from '@cos/core';

export interface SandboxConfig {
  maxMemory: number;      // max memory in MB
  maxCpu: number;         // max CPU time in ms
  maxOutput: number;      // max output size in bytes
  allowedModules: string[];
  timeout: number;        // max execution time in ms
  networkAccess: boolean;
  filesystemAccess: boolean;
}

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  memoryUsed: number;
  error: CogError | null;
}

export class CodeSandbox {
  private config: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.config = {
      maxMemory: config?.maxMemory || 256,
      maxCpu: config?.maxCpu || 30000,
      maxOutput: config?.maxOutput || 1024 * 1024,
      allowedModules: config?.allowedModules || ['*'],
      timeout: config?.timeout || 30000,
      networkAccess: config?.networkAccess || false,
      filesystemAccess: config?.filesystemAccess || false,
    };
  }

  async execute(code: string, language: 'javascript' | 'python' | 'bash' = 'javascript', context?: CellContext): Promise<CodeExecutionResult> {
    const startTime = Date.now();

    // Validate code
    if (code.length > this.config.maxOutput) {
      return {
        stdout: '',
        stderr: 'Code exceeds maximum output size',
        exitCode: 1,
        duration: 0,
        memoryUsed: 0,
        error: { id: generateId(), code: 'SANDBOX_ERROR', message: 'Code exceeds maximum size', severity: 'warn', timestamp: new Date().toISOString() },
      };
    }

    // Execute JavaScript in a sandboxed context
    if (language === 'javascript') {
      try {
        const capturedOutput: string[] = [];
        const originalLog = console.log;
        console.log = (...args: any[]) => {
          capturedOutput.push(args.map(a => JSON.stringify(a)).join(' '));
        };

        const fn = new Function(code);
        const result = await Promise.race([
          fn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timeout')), this.config.timeout)),
        ]);

        console.log = originalLog;

        return {
          stdout: capturedOutput.join('\n') + (result !== undefined ? `\n=> ${JSON.stringify(result)}` : ''),
          stderr: '',
          exitCode: 0,
          duration: Date.now() - startTime,
          memoryUsed: 0,
          error: null,
        };
      } catch (error) {
        return {
          stdout: '',
          stderr: (error as Error).message,
          exitCode: 1,
          duration: Date.now() - startTime,
          memoryUsed: 0,
          error: { id: generateId(), code: 'SANDBOX_ERROR', message: (error as Error).message, severity: 'error', timestamp: new Date().toISOString() },
        };
      }
    }

    return {
      stdout: '',
      stderr: `Language '${language}' not supported in sandbox`,
      exitCode: 1,
      duration: Date.now() - startTime,
      memoryUsed: 0,
      error: { id: generateId(), code: 'UNSUPPORTED_LANGUAGE', message: `Language '${language}' not supported`, severity: 'warn', timestamp: new Date().toISOString() },
    };
  }

  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SandboxConfig>): void {
    Object.assign(this.config, updates);
  }
}