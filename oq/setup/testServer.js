'use strict';

const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const supertest = require('supertest');

const SERVER_SRC = path.join(__dirname, '..', '..', 'server', 'src');
const { connect, disconnect } = require(path.join(SERVER_SRC, 'db'));
const { createApp } = require(path.join(SERVER_SRC, 'app'));

/**
 * Boot an isolated Part 11 eCRF stack for OQ testing:
 *   - a real MongoDB engine running in-memory (mongodb-memory-server), so tests
 *     exercise genuine Mongoose middleware/plugins (append-only, soft-delete) —
 *     not a stub. This is what makes the evidence credible.
 *   - the Express app built via the same createApp() factory used in production.
 *
 * Returns a supertest agent bound to the app, plus the mongoose connection and a
 * stop() that tears everything down for a clean per-suite environment.
 */
async function startTestServer() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const connection = await connect(uri);
  const app = createApp();
  const agent = supertest(app);

  async function stop() {
    await disconnect();
    await mongod.stop();
  }

  return { app, agent, connection, uri, stop };
}

module.exports = { startTestServer, SERVER_SRC };
