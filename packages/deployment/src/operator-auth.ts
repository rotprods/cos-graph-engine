import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { AuthMiddleware } from '@cos/api';
import { Configuration } from '@cos/infrastructure';

export const DEFAULT_OPERATOR_TOKEN_FILE = join(homedir(), '.cos', 'operator.jwt');

function normalizeToken(raw: string): string {
  const token = raw.trim();
  if (!token) throw new Error('Operator credential is empty');
  if (/[\r\n]/.test(token)) throw new Error('Operator credential contains an invalid line break');
  return token;
}

function assertPrivateFile(filePath: string): void {
  const stat = statSync(filePath);
  if (!stat.isFile()) throw new Error(`Credential path is not a regular file: ${filePath}`);
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
    throw new Error(`Credential file must not be group/world accessible: chmod 600 ${filePath}`);
  }
}

/** Resolve an API bearer credential without inventing any implicit persistent browser/session state. */
export function readOperatorToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const direct = env.COS_API_TOKEN;
  if (typeof direct === 'string' && direct.trim()) return normalizeToken(direct);

  const tokenFile = env.COS_API_TOKEN_FILE;
  if (typeof tokenFile !== 'string' || !tokenFile.trim()) return undefined;
  const resolved = resolve(tokenFile);
  assertPrivateFile(resolved);
  return normalizeToken(readFileSync(resolved, 'utf8'));
}

/** Persist a locally provisioned token with owner-only permissions; never logs or returns the token value. */
export function writeOperatorToken(token: string, outputPath: string = DEFAULT_OPERATOR_TOKEN_FILE): string {
  const normalized = normalizeToken(token);
  const resolved = resolve(outputPath);
  mkdirSync(dirname(resolved), { recursive: true, mode: 0o700 });
  writeFileSync(resolved, `${normalized}\n`, { encoding: 'utf8', mode: 0o600, flag: 'w' });
  if (process.platform !== 'win32') chmodSync(resolved, 0o600);
  assertPrivateFile(resolved);
  return resolved;
}

export function removeOperatorToken(tokenFile: string = process.env.COS_API_TOKEN_FILE || DEFAULT_OPERATOR_TOKEN_FILE): boolean {
  const resolved = resolve(tokenFile);
  if (!existsSync(resolved)) return false;
  assertPrivateFile(resolved);
  unlinkSync(resolved);
  return true;
}

/**
 * Local-only bootstrap: the strong signing key is read through canonical Configuration bindings.
 * No HTTP endpoint is used, so a fresh operator does not need an already-authenticated admin.
 */
export function bootstrapAdminToken(userId: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!userId || userId.length > 256) throw new Error('A valid operator user id is required');
  const previous = process.env;
  try {
    // Configuration.loadPresets reads process.env. Temporarily bind only for this synchronous operation.
    process.env = env;
    const config = new Configuration();
    config.loadPresets();
    return new AuthMiddleware(config).generateToken(userId, 'admin');
  } finally {
    process.env = previous;
  }
}

export function defaultNamedTokenFile(label: string): string {
  const safe = label.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'credential';
  return join(homedir(), '.cos', `${safe}.jwt`);
}
