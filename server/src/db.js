'use strict';

const mongoose = require('mongoose');

/**
 * Database connection helpers.
 *
 * The URI is injected by the caller (production reads MONGODB_URI; the OQ harness
 * passes an in-memory mongodb-memory-server URI). Keeping connect/disconnect thin
 * and explicit lets the test harness spin an isolated database per run so evidence
 * is reproducible and never contaminated by prior state.
 */
async function connect(uri) {
  if (!uri) throw new Error('connect(uri): a MongoDB connection URI is required');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

async function disconnect() {
  await mongoose.connection.close();
}

module.exports = { connect, disconnect };
