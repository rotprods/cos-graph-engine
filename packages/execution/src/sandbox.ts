import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import type { CellContext, CogError } from '@cos/core';
import { generateId } from '@cos/core';

export interface SandboxConfig {
  maxMemory: number;
  maxCpu: number;
  maxOutput: number;
  allowedModules: string[];
  timeout: number;
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

interface SandboxWireResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  memoryUsed: number;
  errorCode?: string;
  errorMessage?: string;
}

const SANDBOX_IMAGE = 'node@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868';
const READY_PREFIX = '__COS_SANDBOX_READY__';
const RESULT_PREFIX = '__COS_SANDBOX_RESULT__';
const STARTUP_TIMEOUT_MS = 10_000;
const DEFAULT_CONFIG: Readonly<SandboxConfig> = Object.freeze({
  maxMemory: 256,
  maxCpu: 30_000,
  maxOutput: 1024 * 1024,
  allowedModules: [],
  timeout: 30_000,
  networkAccess: false,
  filesystemAccess: false,
});

// The Docker container is the W1C authority boundary. node:vm and Node's
// Permission Model are defence-in-depth only and are never treated as a hostile
// code security boundary.
const CONTAINER_BOOTSTRAP = `
const vm = require('node:vm');

(async () => {
  process.stdout.write('${READY_PREFIX}\\n');

  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;

  const request = JSON.parse(raw);
  const maxOutput = request.maxOutput;
  const vmTimeout = request.timeout;
  const context = vm.createContext(Object.create(null), {
    name: 'cos-w1c-sandbox',
    codeGeneration: { strings: false, wasm: false },
  });

  const setupSource = [
    '(() => {',
    '  const max = ' + String(maxOutput) + ';',
    '  const stdout = [];',
    '  const stderr = [];',
    '  let used = 0;',
    '  let overflow = false;',
    '  const encode = (value) => {',
    "    if (typeof value === 'string') return value;",
    '    try {',
    '      const json = JSON.stringify(value);',
    '      return json === undefined ? String(value) : json;',
    '    } catch {',
    '      return String(value);',
    '    }',
    '  };',
    '  const append = (target, args) => {',
    "    const line = args.map(encode).join(' ');",
    '    used += line.length + (target.length === 0 ? 0 : 1);',
    '    if (used > max) {',
    '      overflow = true;',
    "      throw new Error('SANDBOX_OUTPUT_LIMIT');",
    '    }',
    '    target.push(line);',
    '  };',
    '  const consoleValue = Object.freeze({',
    '    log: (...args) => append(stdout, args),',
    '    error: (...args) => append(stderr, args),',
    '    warn: (...args) => append(stderr, args),',
    '  });',
    '  const output = Object.freeze({',
    "    take: () => ({ stdout: stdout.join('\\\\n'), stderr: stderr.join('\\\\n'), overflow }),",
    '  });',
    "  Object.defineProperty(globalThis, 'console', {",
    '    value: consoleValue, writable: false, configurable: false, enumerable: true,',
    '  });',
    "  Object.defineProperty(globalThis, '__cosOutput', {",
    '    value: output, writable: false, configurable: false, enumerable: false,',
    '  });',
    '})()',
  ].join('\\n');

  const setup = new vm.Script(setupSource, { filename: 'sandbox-bootstrap.js' });
  setup.runInContext(context, { timeout: Math.min(vmTimeout, 1000) });

  let value;
  let executionError = null;
  try {
    const script = new vm.Script(request.code, { filename: 'sandbox.js' });
    value = script.runInContext(context, { timeout: vmTimeout });
    if (value !== null && value !== undefined && typeof value.then === 'function') value = await value;
  } catch (error) {
    executionError = error;
  }

  let captured;
  try {
    captured = vm.runInContext('__cosOutput.take()', context, { timeout: 100 });
  } catch {
    captured = { stdout: '', stderr: '', overflow: false };
  }

  const truncate = (text) => {
    const bytes = Buffer.from(String(text));
    if (bytes.length <= maxOutput) return bytes.toString('utf8');
    return bytes.subarray(0, maxOutput).toString('utf8');
  };

  let stdout = truncate(captured.stdout || '');
  const stderr = truncate(captured.stderr || '');
  let errorCode;
  let errorMessage;

  if (executionError) {
    errorMessage = executionError && executionError.message ? String(executionError.message) : String(executionError);
    errorCode = errorMessage.includes('SANDBOX_OUTPUT_LIMIT') ? 'SANDBOX_OUTPUT_LIMIT' : 'SANDBOX_EXECUTION_ERROR';
  } else if (captured.overflow) {
    errorCode = 'SANDBOX_OUTPUT_LIMIT';
    errorMessage = 'Sandbox output exceeded configured maximum';
  } else if (value !== undefined) {
    let encoded;
    try {
      encoded = JSON.stringify(value);
    } catch {
      encoded = JSON.stringify(String(value));
    }
    if (encoded !== undefined) {
      const suffix = (stdout.length > 0 ? '\\n' : '') + '=> ' + encoded;
      if (Buffer.byteLength(stdout + suffix) > maxOutput) {
        errorCode = 'SANDBOX_OUTPUT_LIMIT';
        errorMessage = 'Sandbox result exceeded configured maximum';
      } else {
        stdout += suffix;
      }
    }
  }

  const result = {
    ok: !errorCode,
    stdout: truncate(stdout),
    stderr: truncate(stderr),
    memoryUsed: Math.ceil(process.memoryUsage().rss / (1024 * 1024)),
    errorCode,
    errorMessage,
  };

  process.stdout.write('${RESULT_PREFIX}' + JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
})().catch((error) => {
  const result = {
    ok: false,
    stdout: '',
    stderr: '',
    memoryUsed: 0,
    errorCode: 'SANDBOX_BOOTSTRAP_ERROR',
    errorMessage: error && error.message ? String(error.message) : String(error),
  };
  process.stdout.write('${RESULT_PREFIX}' + JSON.stringify(result));
  process.exit(1);
});
`;

export class CodeSandbox {
  private config: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.config = this.normalizeConfig({ ...DEFAULT_CONFIG, ...config });
  }

  async execute(
    code: string,
    language: 'javascript' | 'python' | 'bash' = 'javascript',
    context?: CellContext,
  ): Promise<CodeExecutionResult> {
    void context;
    const startTime = Date.now();

    if (language !== 'javascript') {
      return this.failure('UNSUPPORTED_LANGUAGE', `Language '${language}' not supported`, startTime, `Language '${language}' not supported in sandbox`);
    }

    if (Buffer.byteLength(code, 'utf8') > this.config.maxOutput) {
      return this.failure('SANDBOX_CODE_TOO_LARGE', 'Code exceeds configured maximum size', startTime, 'Code exceeds maximum size');
    }

    const policyViolation = this.policyViolation();
    if (policyViolation) return this.failure('SANDBOX_POLICY_DENIED', policyViolation, startTime, policyViolation);

    return this.executeInContainer(code, startTime);
  }

  getConfig(): SandboxConfig {
    return { ...this.config, allowedModules: [...this.config.allowedModules] };
  }

  updateConfig(updates: Partial<SandboxConfig>): void {
    this.config = this.normalizeConfig({ ...this.config, ...updates });
  }

  private policyViolation(): string | null {
    if (this.config.filesystemAccess) return 'Filesystem capability is not supported by the W1C sandbox profile';
    if (this.config.networkAccess) return 'Network capability is not supported by the W1C sandbox profile';
    if (this.config.allowedModules.length > 0) return 'Module capability is not supported by the W1C sandbox profile';
    return null;
  }

  private async executeInContainer(code: string, startTime: number): Promise<CodeExecutionResult> {
    const containerName = `cos-w1c-${process.pid}-${randomBytes(6).toString('hex')}`;
    const wallTimeout = Math.max(1, Math.min(this.config.timeout, this.config.maxCpu));
    const protocolAllowance = Math.max(64 * 1024, Math.min(this.config.maxOutput, 1024 * 1024));
    const rawLimit = this.config.maxOutput + protocolAllowance;

    const args = [
      'run', '--rm', '--name', containerName,
      '--network', 'none',
      '--read-only',
      '--user', '1000:1000',
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges=true',
      '--pids-limit', '16',
      '--memory', `${this.config.maxMemory}m`,
      '--memory-swap', `${this.config.maxMemory}m`,
      '--cpus', '1.0',
      '--ulimit', 'nofile=64:64',
      '--ipc', 'none',
      '--hostname', 'cos-sandbox',
      '--label', 'cos.sandbox.profile=w1c',
      '--entrypoint', 'node',
      '-i',
      SANDBOX_IMAGE,
      '--permission',
      '--disable-proto=throw',
      `--max-old-space-size=${Math.max(16, Math.floor(this.config.maxMemory * 0.75))}`,
      '-e', CONTAINER_BOOTSTRAP,
    ];

    return new Promise<CodeExecutionResult>((resolve) => {
      let settled = false;
      let ready = false;
      let stdout = '';
      let stderr = '';
      let forcedCode: string | null = null;
      let forcedMessage: string | null = null;
      let executionTimer: NodeJS.Timeout | null = null;

      const child = spawn('docker', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: this.dockerClientEnvironment(),
      });

      const cleanupContainer = (): void => {
        const cleanup = spawn('docker', ['rm', '-f', containerName], {
          stdio: 'ignore', windowsHide: true, env: this.dockerClientEnvironment(),
        });
        cleanup.on('error', () => undefined);
      };

      const clearTimers = (): void => {
        clearTimeout(startupTimer);
        if (executionTimer) clearTimeout(executionTimer);
      };

      const forceStop = (codeValue: string, message: string): void => {
        if (forcedCode) return;
        forcedCode = codeValue;
        forcedMessage = message;
        child.kill('SIGKILL');
        cleanupContainer();
      };

      const startupTimer = setTimeout(() => {
        forceStop('SANDBOX_STARTUP_TIMEOUT', `Sandbox container did not become ready within ${STARTUP_TIMEOUT_MS}ms`);
      }, STARTUP_TIMEOUT_MS);
      startupTimer.unref?.();

      const startExecutionTimer = (): void => {
        if (ready) return;
        ready = true;
        clearTimeout(startupTimer);
        executionTimer = setTimeout(() => {
          forceStop('SANDBOX_TIMEOUT', `Sandbox exceeded ${wallTimeout}ms execution budget`);
        }, wallTimeout);
        executionTimer.unref?.();
      };

      const collect = (current: string, chunk: string): string => {
        const next = current + chunk;
        if (Buffer.byteLength(next) > rawLimit) {
          forceStop('SANDBOX_OUTPUT_LIMIT', 'Sandbox protocol output exceeded configured maximum');
          return Buffer.from(next).subarray(0, rawLimit).toString('utf8');
        }
        return next;
      };

      child.stdout.on('data', (chunk) => {
        stdout = collect(stdout, chunk.toString());
        if (!ready && stdout.includes(READY_PREFIX)) startExecutionTimer();
      });
      child.stderr.on('data', (chunk) => {
        stderr = collect(stderr, chunk.toString());
      });

      child.once('error', (error: NodeJS.ErrnoException) => {
        clearTimers();
        if (settled) return;
        settled = true;
        cleanupContainer();
        const message = error.code === 'ENOENT'
          ? 'Docker runtime is unavailable; W1C fails closed'
          : `Docker runtime failed: ${error.message}`;
        resolve(this.failure('SANDBOX_RUNTIME_UNAVAILABLE', message, startTime, message));
      });

      child.once('close', (exitCode) => {
        clearTimers();
        if (settled) return;
        settled = true;
        cleanupContainer();

        if (forcedCode) {
          resolve(this.failure(forcedCode, forcedMessage ?? forcedCode, startTime, this.truncate(stderr), ''));
          return;
        }

        const marker = stdout.lastIndexOf(RESULT_PREFIX);
        if (marker === -1) {
          const dockerError = this.truncate(stderr) || `Sandbox container exited with code ${exitCode ?? 'unknown'}`;
          const runtimeUnavailable = /docker|daemon|pull access|manifest|permission denied/i.test(dockerError);
          resolve(this.failure(runtimeUnavailable ? 'SANDBOX_RUNTIME_UNAVAILABLE' : 'SANDBOX_PROTOCOL_ERROR', dockerError, startTime, dockerError));
          return;
        }

        const encoded = stdout.slice(marker + RESULT_PREFIX.length).trim();
        let wire: SandboxWireResult;
        try {
          wire = JSON.parse(encoded) as SandboxWireResult;
        } catch {
          resolve(this.failure('SANDBOX_PROTOCOL_ERROR', 'Sandbox returned an invalid result envelope', startTime, this.truncate(stderr)));
          return;
        }

        if (!wire.ok || exitCode !== 0) {
          const codeValue = wire.errorCode ?? 'SANDBOX_EXECUTION_ERROR';
          const message = wire.errorMessage ?? `Sandbox exited with code ${exitCode ?? 'unknown'}`;
          resolve(this.failure(codeValue, message, startTime, this.truncate(wire.stderr || message), this.truncate(wire.stdout), wire.memoryUsed));
          return;
        }

        resolve({
          stdout: this.truncate(wire.stdout),
          stderr: this.truncate(wire.stderr),
          exitCode: 0,
          duration: Date.now() - startTime,
          memoryUsed: Number.isFinite(wire.memoryUsed) ? Math.max(0, wire.memoryUsed) : 0,
          error: null,
        });
      });

      child.stdin.on('error', () => undefined);
      child.stdin.end(JSON.stringify({ code, maxOutput: this.config.maxOutput, timeout: wallTimeout }));
    });
  }

  private dockerClientEnvironment(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const key of ['PATH', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'HOME', 'TMPDIR']) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    return env;
  }

  private truncate(value: string): string {
    const bytes = Buffer.from(value);
    return bytes.length <= this.config.maxOutput ? value : bytes.subarray(0, this.config.maxOutput).toString('utf8');
  }

  private failure(
    code: string,
    message: string,
    startTime: number,
    stderr = message,
    stdout = '',
    memoryUsed = 0,
  ): CodeExecutionResult {
    return {
      stdout: this.truncate(stdout),
      stderr: this.truncate(stderr),
      exitCode: 1,
      duration: Date.now() - startTime,
      memoryUsed,
      error: this.makeError(code, message),
    };
  }

  private makeError(code: string, message: string): CogError {
    return { id: generateId(), code, message, severity: 'error', timestamp: new Date().toISOString() };
  }

  private normalizeConfig(config: SandboxConfig): SandboxConfig {
    const integer = (value: number, name: string, min: number, max: number): number => {
      if (!Number.isInteger(value) || value < min || value > max) {
        throw new RangeError(`${name} must be an integer between ${min} and ${max}`);
      }
      return value;
    };

    if (!Array.isArray(config.allowedModules) || config.allowedModules.some((name) => typeof name !== 'string')) {
      throw new TypeError('allowedModules must be an array of strings');
    }

    return {
      maxMemory: integer(config.maxMemory, 'maxMemory', 16, 4096),
      maxCpu: integer(config.maxCpu, 'maxCpu', 10, 300_000),
      maxOutput: integer(config.maxOutput, 'maxOutput', 256, 16 * 1024 * 1024),
      timeout: integer(config.timeout, 'timeout', 10, 300_000),
      allowedModules: [...config.allowedModules],
      networkAccess: Boolean(config.networkAccess),
      filesystemAccess: Boolean(config.filesystemAccess),
    };
  }
}

export const W1C_SANDBOX_IMAGE = SANDBOX_IMAGE;
