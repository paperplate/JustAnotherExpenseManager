/**
 * Custom Playwright fixtures.
 *
 * Worker fixture `port`:
 *   Spawns one Flask process per Playwright worker on a unique port
 *   (5005, 5006, …) backed by a dedicated SQLite file.  All tests
 *   running on the same worker share that server; tests on different
 *   workers are fully isolated — no shared DB, no port conflicts.
 *
 * The `baseURL` fixture is overridden so every `page.goto('/')` call
 *   resolves against the correct worker-local server automatically.
 */

import { test as base, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SummaryPage } from './pages/SummaryPage';

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkerFixtures = {
  /** TCP port the Flask server for this worker is listening on. */
  port: number;
};

type TestFixtures = {
  settingsPage: SettingsPage;
  transactionsPage: TransactionsPage;
  summaryPage: SummaryPage;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return; // server is up
    } catch {
      // ECONNREFUSED — not ready yet
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Server ${url} did not start within ${timeoutMs}ms`);
}

// ── Fixture definitions ───────────────────────────────────────────────────────

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // ── Worker-scoped: one Flask server per Playwright worker ─────────────────
  port: [
    async ({}, use, workerInfo) => {
      const port = 5005 + workerInfo.workerIndex;
      const dbPath = path.resolve(`/tmp/jaem-worker-${workerInfo.workerIndex}.db`);

      // Remove stale DB from a previous run.
      try { fs.unlinkSync(dbPath); } catch { /* no stale file */ }

      const server: ChildProcess = spawn('flask', ['run'], {
        env: {
          ...process.env,
          FLASK_APP: 'JustAnotherExpenseManager',
          JAEM_CONFIG: 'testing',
          FLASK_RUN_PORT: String(port),
          FLASK_RUN_HOST: '127.0.0.1',
          SQLITE_PATH: dbPath,
        },
        stdio: ['ignore', 'pipe', 'pipe'], // prevent buffer block
      });

      // Drain stdio to prevent blocking.
      server.stdout?.resume();
      server.stderr?.resume();

      try {
        await waitForServer(`http://127.0.0.1:${port}`);
      } catch (e) {
        server.kill();
        throw e;
      }

      await use(port);

      server.kill('SIGTERM');
      // Allow Flask a moment to shut down before we delete the DB.
      await new Promise(r => setTimeout(r, 500));
      try { fs.unlinkSync(dbPath); } catch { /* already removed */ }
    },
    { scope: 'worker' },
  ],

  // ── Override baseURL so page.goto('/') resolves to the right worker server.
  baseURL: async ({ port }, use) => {
    await use(`http://127.0.0.1:${port}`);
  },

  // ── Test-scoped page objects ───────────────────────────────────────────────
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  transactionsPage: async ({ page }, use) => {
    await use(new TransactionsPage(page));
  },
  summaryPage: async ({ page }, use) => {
    await use(new SummaryPage(page));
  },
});

export { expect } from '@playwright/test';
