'use strict';

const path = require('path');
const { SERVER_SRC } = require('../setup/testServer');
const config = require(path.join(SERVER_SRC, 'config'));

/**
 * OQ — Configuration fail-closed guard (21 CFR 11.10(d)/(g)): the app must refuse
 * to start in production with the well-known development secrets.
 */
describe('Config secret guard', () => {
  test('OQ-CFG-01: refuses to start in production with default secrets', () => {
    expect(() => config.assertSecretsConfigured({ nodeEnv: 'production' })).toThrow(/default secret/i);
  });

  test('OQ-CFG-02: allows default secrets outside production (dev/test/OQ)', () => {
    expect(() => config.assertSecretsConfigured({ nodeEnv: 'test' })).not.toThrow();
  });
});
