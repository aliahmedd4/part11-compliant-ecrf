'use strict';

const path = require('path');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');

const { getConfig } = require(path.join(SERVER_SRC, 'models', 'config.model'));
const config = require(path.join(SERVER_SRC, 'config'));

/**
 * OQ — App bootstrap & configuration singleton.
 */
describe('Application bootstrap', () => {
  let ctx;
  beforeAll(async () => { ctx = await startTestServer(); });
  afterAll(async () => { await ctx.stop(); });

  test('OQ-APP-01: health endpoint responds ok', async () => {
    const res = await ctx.agent.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('OQ-APP-02: unknown route returns structured 404', async () => {
    const res = await ctx.agent.get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('OQ-APP-03: config singleton seeds from defaults and is reused', async () => {
    const c1 = await getConfig(config.defaultPolicy);
    expect(c1.passwordPolicy.minLength).toBe(config.defaultPolicy.passwordPolicy.minLength);
    const c2 = await getConfig(config.defaultPolicy);
    expect(String(c1._id)).toBe(String(c2._id)); // same singleton, not duplicated
  });
});
