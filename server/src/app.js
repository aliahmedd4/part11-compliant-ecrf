'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

/**
 * Express application factory.
 *
 * Building the app in a factory (rather than binding a port at import time) is
 * what lets the OQ harness mount the exact same application against an in-memory
 * database with no network listener — the tests exercise production code paths,
 * which is essential for the evidence to be meaningful.
 *
 * Routers are attached lazily as each phase adds them; unknown routes and thrown
 * errors are normalised to JSON so API clients (and the OQ suite) get consistent
 * shapes.
 */
function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Feature routers (added across phases). Each is mounted only if its file
  // already exists, so the app can boot during incremental development.
  mount(app, '/auth', './routes/auth.routes');
  mount(app, '/subjects', './routes/subject.routes');
  mount(app, '/forms', './routes/form.routes');
  mount(app, '/forms', './routes/signature.routes');
  mount(app, '/queries', './routes/query.routes');
  mount(app, '/export', './routes/export.routes');
  mount(app, '/admin', './routes/admin.routes');

  // 404 for unmatched routes.
  app.use((req, res) => res.status(404).json({ error: 'not_found', path: req.path }));

  // Central error handler — maps known error shapes to HTTP status codes.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.code || 'server_error', message: err.message });
  });

  return app;
}

// Mount a router only if its file already exists (skip during incremental dev).
// A require() error from an EXISTING file is a real bug and is allowed to throw.
function mount(app, base, modulePath) {
  const abs = path.join(__dirname, `${modulePath}.js`);
  if (!fs.existsSync(abs)) return;
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const router = require(modulePath);
  app.use(base, router);
}

module.exports = { createApp };
