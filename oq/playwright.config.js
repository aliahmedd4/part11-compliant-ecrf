'use strict';

const { defineConfig } = require('@playwright/test');

/**
 * Playwright configuration for the UI Operational Qualification.
 *
 * These specs drive the real React client in a browser to exercise the critical
 * end-user flows (login, edit-check feedback, signing, edit-after-sign lockout).
 * They are authored and runnable; execution requires the API + client dev servers
 * running (documented in the README and wired in CI as an optional job). Results
 * are emitted as JSON to /evidence alongside the API OQ evidence.
 */
module.exports = defineConfig({
  testDir: './ui',
  timeout: 30000,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['json', { outputFile: '../evidence/oq-ui-results.json' }],
  ],
  use: {
    baseURL: process.env.CLIENT_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
});
