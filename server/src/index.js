'use strict';

const config = require('./config');
const { connect } = require('./db');
const { createApp } = require('./app');

/**
 * Production entrypoint. Reads MONGODB_URI from the environment (documented in the
 * IQ), connects, then starts the HTTP listener. Kept separate from app.js so the
 * OQ harness can import the app without opening a socket.
 */
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is required');
  config.assertSecretsConfigured();
  await connect(uri);
  const app = createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Part 11 eCRF API listening on port ${config.port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
