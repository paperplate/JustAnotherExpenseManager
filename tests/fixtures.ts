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
    // Use ports 5100+ to avoid clashing with a local dev server on 5000.
    const port = 5100 + workerInfo.workerIndex;
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
      const earlyExit = new Promise<never>((_, reject) => {
        server!.once('exit', (code, signal) => {
          reject(new Error(
            `Worker ${workerInfo.workerIndex}: Flask process exited early ` +
            `(code=${code}, signal=${signal}). Check port ${port} and config ${cfgPath}.`
          ));
        });
        server!.once('error', (err) => {
          reject(new Error(
            `Worker ${workerInfo.workerIndex}: Failed to spawn Flask process: ${err.message}`
          ));
        });
      });

      await Promise.race([waitForPort(port), earlyExit]);
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
