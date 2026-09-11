#!/usr/bin/env node

// ================================================================
// Phase 5: COS CLI — Command-Line Interface
// ================================================================

import * as http from 'http';

const API_URL = process.env.COS_API_URL || 'http://localhost:8080';

function apiRequest(method: string, path: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });

    req.on('error', (error) => reject(error));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
  COS — Cognitive Operating System CLI

  Usage:
    cos <command> [options]

  Commands:
    start             Start the COS server
    stop              Stop the COS server
    status            Check system health
    process <input>   Process input through the COS
    memory [--stats]  View memory stats or retrieve by ID
    knowledge <query> Query the knowledge graph
    improve           Run self-improvement meta-cognition
    config            View current configuration
    token <userId>    Generate an auth token for testing
    help              Show this help
    `);
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
        if (args[1] === '--stats') {
          const stats = await apiRequest('GET', '/memory');
          console.log('Memory Stats:', JSON.stringify(stats, null, 2));
        } else if (args[1]) {
          const entry = await apiRequest('GET', `/memory/${args[1]}`);
          console.log('Entry:', JSON.stringify(entry, null, 2));
        } else {
          const stats = await apiRequest('GET', '/memory');
          console.log('Total entries:', stats.totalEntries);
          for (const [layer, count] of Object.entries(stats.byLayer || {})) {
            if (typeof count === 'number' && count > 0) console.log(`  ${layer}: ${count}`);
          }
        }
        break;
      }

      case 'knowledge': {
        const query = args.slice(1).join(' ') || 'COS';
        const results = await apiRequest('GET', `/knowledge/${encodeURIComponent(query)}`);
        console.log(`Knowledge Graph results for "${query}":`);
        for (const r of results) {
          console.log(`  ${r.subject} → ${r.predicate} → ${r.object} (conf: ${(r.confidence*100).toFixed(0)}%)`);
        }
        break;
      }

      case 'improve': {
        const report = await apiRequest('GET', '/self-improve');
        console.log('Self-Improvement Report:');
        console.log(`  Score: ${(report.averageScore*100).toFixed(0)}/100`);
        console.log(`  Trend: ${report.scoreTrend}`);
        console.log(`  Evaluations: ${report.totalEvaluations}`);
        console.log(`  Patterns: ${report.topPatterns.length}`);
        for (const s of report.suggestions) console.log(`  • ${s}`);
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

      case 'token': {
        const userId = args[1] || 'test-user';
        const role = args[2] || 'admin';
        const result = await apiRequest('POST', '/auth/token', { userId, role });
        console.log(`Token for ${userId} (${role}):`);
        console.log(result.token);
        break;
      }

      case 'start': {
        console.log('Starting COS server...');
        const { main } = require('./bootstrap');
        await main();
        console.log('COS running. API at', API_URL);
        break;
      }

      default:
        console.log(`Unknown command: ${command}. Run 'cos help' for usage.`);
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('Error: COS server is not running. Start it with `cos start`');
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

main();