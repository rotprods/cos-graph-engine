#!/usr/bin/env node

import { AuthMiddleware, COSServer, HttpApiServer } from '@cos/api';
import { Configuration } from '@cos/infrastructure';

export interface ProductionService {
  config: Configuration;
  auth: AuthMiddleware;
  server: COSServer;
  httpServer: HttpApiServer;
  stop(): Promise<void>;
}

function productionPort(config: Configuration): number {
  const port = config.get<number>('server.port') ?? 8080;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('server.port must be an integer between 1 and 65535');
  }
  return port;
}

/**
 * Start the production COS service without demo data, permissive bootstrap
 * policies, synthetic goals, or development-only side effects.
 */
export async function serveProduction(): Promise<ProductionService> {
  const config = new Configuration();
  config.loadPresets();

  const host = config.get<string>('server.host') ?? '0.0.0.0';
  const port = productionPort(config);
  const maxMemory = config.get<number>('storage.memory.maxEntries') ?? 10_000;
  const logLevel = config.get<string>('log.level') ?? 'info';

  const server = new COSServer({ host, port, maxMemory, logLevel, plugins: [] });
  const auth = new AuthMiddleware(config);
  const httpServer = new HttpApiServer(server, auth, config);

  await server.start();
  try {
    await httpServer.start();
  } catch (error) {
    await server.shutdown();
    throw error;
  }

  let stopping: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    if (!stopping) {
      stopping = (async () => {
        process.off('SIGTERM', requestStop);
        process.off('SIGINT', requestStop);
        await httpServer.stop();
        await server.shutdown();
      })();
    }
    return stopping;
  };

  const requestStop = (): void => {
    void stop().catch(() => {
      process.exitCode = 1;
    });
  };

  process.once('SIGTERM', requestStop);
  process.once('SIGINT', requestStop);

  return { config, auth, server, httpServer, stop };
}

if (require.main === module) {
  serveProduction().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown startup failure';
    console.error(`[COS] Production startup failed: ${message}`);
    process.exitCode = 1;
  });
}
