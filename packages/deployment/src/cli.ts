#!/usr/bin/env node

// ================================================================
// COS CLI — authenticated operator interface
// ================================================================

import { ApiRequestError, apiRequest } from './api-client';
import {
  DEFAULT_OPERATOR_TOKEN_FILE,
  bootstrapAdminToken,
  defaultNamedTokenFile,
  removeOperatorToken,
  writeOperatorToken,
} from './operator-auth';

const API_URL = process.env.COS_API_URL || 'http://localhost:8080';

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function positional(args: string[], index: number, fallback: string): string {
  const value = args[index];
  return value && !value.startsWith('--') ? value : fallback;
}

function printHelp(): void {
  console.log(`
  COS — Cognitive Operating System CLI

  Usage:
    cos <command> [options]

  Authentication:
    COS_API_TOKEN=<bearer>           ephemeral credential from environment
    COS_API_TOKEN_FILE=/secure/file  owner-only credential file (chmod 600)

  Commands:
    start                         Start the COS server
    status                        Check public system health
    process <input>               Process input through the COS (auth required)
    memory [--stats]              View memory stats or retrieve by ID (auth required)
    knowledge <query>             Query the knowledge graph (auth required)
    improve                       Run self-improvement meta-cognition (auth required)
    config                        View redacted configuration (admin required)
    bootstrap-admin [user]        Provision an admin JWT locally from COS_JWT_SECRET
      [--output <file>]            Default: ~/.cos/operator.jwt, written mode 0600
    token [user] [user|admin]     Mint a token through the authenticated API
      [--output <file>]            Writes token to an owner-only file; never prints it
    logout [--file <file>]        Delete a local credential file
    help                          Show this help

  A fresh deployment must set a strong COS_JWT_SECRET locally before bootstrap-admin.
  No unauthenticated network bootstrap exists.
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  try {
    switch (command) {
      case 'status': {
        const health = await apiRequest('GET', '/health');
        console.log('System:', health.system?.status);
        console.log('Cells:', health.system?.metrics?.cells);
        console.log('Tools:', health.system?.metrics?.tools);
        console.log('Memory:', health.system?.metrics?.memory);
        break;
      }

      case 'process': {
        const input = args.slice(1).join(' ') || 'hello';
        const result = await apiRequest('POST', '/process', { input });
        console.log('Result:', JSON.stringify(result.result, null, 2));
        console.log('Confidence:', result.confidence);
        console.log('Latency:', result.latency + 'ms');
        break;
      }

      case 'memory': {
        if (args[1] === '--stats' || !args[1]) {
          const stats = await apiRequest('GET', '/memory');
          console.log('Memory Stats:', JSON.stringify(stats, null, 2));
        } else {
          const entry = await apiRequest('GET', `/memory/${encodeURIComponent(args[1])}`);
          console.log('Entry:', JSON.stringify(entry, null, 2));
        }
        break;
      }

      case 'knowledge': {
        const query = args.slice(1).join(' ') || 'COS';
        const results = await apiRequest('GET', `/knowledge/${encodeURIComponent(query)}`);
        console.log(`Knowledge Graph results for "${query}":`);
        for (const result of results) {
          console.log(`  ${result.subject} → ${result.predicate} → ${result.object} (conf: ${(result.confidence * 100).toFixed(0)}%)`);
        }
        break;
      }

      case 'improve': {
        const report = await apiRequest('GET', '/self-improve');
        console.log('Self-Improvement Report:');
        console.log(`  Score: ${(report.averageScore * 100).toFixed(0)}/100`);
        console.log(`  Trend: ${report.scoreTrend}`);
        console.log(`  Evaluations: ${report.totalEvaluations}`);
        console.log(`  Patterns: ${report.topPatterns.length}`);
        for (const suggestion of report.suggestions) console.log(`  • ${suggestion}`);
        break;
      }

      case 'config': {
        const config = await apiRequest('GET', '/config');
        console.log('Configuration:');
        for (const [key, entry] of Object.entries<any>(config)) {
          console.log(`  ${key}: ${JSON.stringify(entry.value)} (source: ${entry.source})`);
        }
        break;
      }

      case 'bootstrap-admin': {
        const userId = positional(args, 1, 'operator');
        const output = option(args, '--output') || DEFAULT_OPERATOR_TOKEN_FILE;
        const token = bootstrapAdminToken(userId);
        const written = writeOperatorToken(token, output);
        console.log(`Local admin credential written securely to ${written}`);
        console.log(`Use it with: COS_API_TOKEN_FILE=${written} cos <protected-command>`);
        break;
      }

      case 'token': {
        const userId = positional(args, 1, 'operator-user');
        const roleValue = positional(args, 2, 'user');
        if (roleValue !== 'user' && roleValue !== 'admin') throw new Error('role must be user or admin');
        const result = await apiRequest('POST', '/auth/token', { userId, role: roleValue });
        if (!result || typeof result.token !== 'string') throw new Error('COS API did not return a token');
        const output = option(args, '--output') || defaultNamedTokenFile(`${userId}-${roleValue}`);
        const written = writeOperatorToken(result.token, output);
        console.log(`Credential for ${userId} (${roleValue}) written securely to ${written}`);
        break;
      }

      case 'logout': {
        const tokenFile = option(args, '--file') || process.env.COS_API_TOKEN_FILE || DEFAULT_OPERATOR_TOKEN_FILE;
        const removed = removeOperatorToken(tokenFile);
        console.log(removed ? `Removed local credential ${tokenFile}` : `No local credential found at ${tokenFile}`);
        break;
      }

      case 'start': {
        console.log('Starting COS server...');
        const { main: bootstrap } = require('./bootstrap');
        await bootstrap();
        console.log('COS running. API at', API_URL);
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}. Run 'cos help' for usage.`);
    }
  } catch (error: any) {
    if (error?.code === 'ECONNREFUSED') {
      console.error('Error: COS server is not running. Start it with `cos start`.');
    } else if (error instanceof ApiRequestError) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Error:', error?.message || String(error));
    }
    process.exitCode = 1;
  }
}

void main();
