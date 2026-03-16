/**
 * Playwright worker fixtures.
 *
 * Each worker gets its own Flask server process running on a unique port
 * with its own SQLite database file.  This eliminates all cross-worker
 * database contention without requiring tests to clear and re-seed before
 * every single case.
 *
 * Usage — replace the @playwright/test import in every spec file:
 *
 *   // before
 *   import { test, expect } from '@playwright/test';
 *   // after
 *   import { test, expect } from './fixtures';
 */

import { test as base, BrowserContext } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Ask the OS for a free TCP port by binding a server to port 0, reading the
 * assigned port, then closing the server before Flask tries to bind to it.
 * There is a small TOCTOU window between close and Flask binding, but in
 * practice this is reliable and far safer than hardcoded port offsets.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

/**
 * Poll until the given TCP port accepts connections, or throw after `timeout` ms.
 */
async function waitForPort(port: number, timeout = 30_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const open = await new Promise<boolean>(resolve => {
      const socket = net.createConnection({ port, host: '127.0.0.1' });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (open) return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Server on port ${port} did not become ready within ${timeout}ms`);
}

// ─── fixture types ────────────────────────────────────────────────────────────

type WorkerFixtures = {
  /** The base URL of this worker's dedicated Flask server, e.g. http://127.0.0.1:5101 */
  workerBaseURL: string;
};

// ─── extended test object ─────────────────────────────────────────────────────

export const test = base.extend<{ context: BrowserContext }, WorkerFixtures>({

  /**
   * Worker-scoped: starts one Flask server per worker and tears it down
   * (along with its config file and database) when the worker exits.
   */
  workerBaseURL: [async ({}, use, workerInfo) => {
    const port = await getFreePort();
    const dbPath = path.resolve(`test-expenses-worker-${workerInfo.workerIndex}.db`);
    const cfgPath = path.resolve(`test-worker-${workerInfo.workerIndex}.env`);

    fs.writeFileSync(cfgPath, [
      'TESTING=True',
      'WTF_CSRF_ENABLED=False',
      `SECRET_KEY=test-secret-key-worker-${workerInfo.workerIndex}`,
      'ENABLE_TEST_ROUTES=1',
      'FLASK_RUN_HOST=127.0.0.1',
      `FLASK_RUN_PORT=${port}`,
      'DATABASE_TYPE=sqlite',
      `SQLITE_PATH=${dbPath}`,
      'FLASK_DEBUG=0',
    ].join('\n'));

    let server: ChildProcess | null = null;
    try {
      server = spawn('JustAnotherExpenseManager', ['--config', cfgPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      server.stdout?.on('data', (d: Buffer) => process.stdout.write(d));
      server.stderr?.on('data', (d: Buffer) => process.stderr.write(d));

      // Fail immediately if the process exits before the port opens, rather
      // than letting waitForPort poll silently until its timeout expires.
      // startupComplete suppresses the rejection when SIGTERM fires during
      // normal teardown — without it, the exit listener would reject the
      // promise on every successful cleanup and cause a spurious test failure.
      let startupComplete = false;
      const earlyExit = new Promise<never>((_, reject) => {
        server!.once('exit', (code, signal) => {
          if (!startupComplete) {
            reject(new Error(
              `Worker ${workerInfo.workerIndex}: Flask process exited early ` +
              `(code=${code}, signal=${signal}). Check port ${port} and config ${cfgPath}.`
            ));
          }
        });
        server!.once('error', (err) => {
          if (!startupComplete) {
            reject(new Error(
              `Worker ${workerInfo.workerIndex}: Failed to spawn Flask process: ${err.message}`
            ));
          }
        });
      });

      await Promise.race([waitForPort(port), earlyExit]);
      startupComplete = true;
      await use(`http://127.0.0.1:${port}`);
    } finally {
      server?.kill('SIGTERM');
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);
    }
  }, { scope: 'worker' }],

  /**
   * Test-scoped: creates a fresh browser context pointed at this worker's
   * server URL so that page.goto('/') always resolves correctly.
   */
  context: async ({ browser, workerBaseURL }, use) => {
    const ctx = await browser.newContext({ baseURL: workerBaseURL });
    await use(ctx);
    await ctx.close();
  },
});

export { expect } from '@playwright/test';
