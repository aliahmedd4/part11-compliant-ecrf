'use strict';

/**
 * Jest configuration for the API Operational Qualification suite.
 *
 * - testEnvironment node: we exercise the Express API + Mongoose directly.
 * - runInBand (also set in the script): a single in-memory Mongo instance is
 *   shared per test file, so tests must not run in parallel against it.
 * - a custom reporter emits structured, timestamped evidence to /evidence,
 *   which is the objective OQ record (Computer Software Assurance approach —
 *   evidence from the system, not screenshots).
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/api'],
  testMatch: ['**/*.test.js'],
  reporters: [
    'default',
    ['<rootDir>/reporters/jsonReporter.js', { outputDir: '<rootDir>/../evidence' }],
  ],
  // Each API test file boots its own in-memory server; give downloads/boot room.
  testTimeout: 60000,
  globalTeardown: undefined,
};
