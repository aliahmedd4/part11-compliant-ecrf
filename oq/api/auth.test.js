'use strict';

const path = require('path');
const jwt = require('jsonwebtoken');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');
const { seedFixtures, PASSWORD } = require('../setup/fixtures');

const AuditEvent = require(path.join(SERVER_SRC, 'models', 'auditEvent.model'));
const User = require(path.join(SERVER_SRC, 'models', 'user.model'));
const config = require(path.join(SERVER_SRC, 'config'));

/**
 * OQ — Authentication controls (21 CFR 11.10(d)/(g), 11.300):
 * password policy, non-reuse history, account lockout, and session issuance.
 */
describe('Authentication, password policy, lockout, session', () => {
  let ctx; let fx;
  beforeAll(async () => { ctx = await startTestServer(); fx = await seedFixtures(ctx.agent); });
  afterAll(async () => { await ctx.stop(); });

  test('OQ-AUTH-01: valid login returns a session JWT with configured expiry', async () => {
    const res = await ctx.agent.post('/auth/login').send({ username: 'investigator', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    const decoded = jwt.verify(res.body.token, config.jwtSecret);
    expect(decoded.sub).toBeDefined();
    // exp - iat equals the configured idle timeout (minutes -> seconds).
    expect(decoded.exp - decoded.iat).toBe(config.defaultPolicy.session.idleTimeoutMinutes * 60);
  });

  test('OQ-AUTH-02: successful login is recorded in the audit trail', async () => {
    await ctx.agent.post('/auth/login').send({ username: 'monitor', password: PASSWORD });
    const ev = await AuditEvent.findOne({ action: 'login', whoUsername: 'monitor' });
    expect(ev).not.toBeNull();
  });

  test('OQ-AUTH-03: wrong password is rejected and audited as a failure', async () => {
    const res = await ctx.agent.post('/auth/login').send({ username: 'investigator', password: 'wrong-password' });
    expect(res.status).toBe(401);
    const ev = await AuditEvent.findOne({ action: 'login_failed', whoUsername: 'investigator' });
    expect(ev).not.toBeNull();
  });

  test('OQ-AUTH-04: account locks after the configured number of failures', async () => {
    // Create a dedicated user so we do not disturb the shared fixtures.
    const authService = require(path.join(SERVER_SRC, 'services', 'auth.service'));
    await User.create({ username: 'locktest', printedName: 'Lock Test', role: 'Investigator', passwordHash: await authService.hashPassword(PASSWORD) });
    const threshold = config.defaultPolicy.lockout.threshold;
    for (let i = 0; i < threshold; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await ctx.agent.post('/auth/login').send({ username: 'locktest', password: 'bad' });
    }
    // Even the CORRECT password is now refused because the account is locked.
    const res = await ctx.agent.post('/auth/login').send({ username: 'locktest', password: PASSWORD });
    expect(res.status).toBe(423);
    expect(res.body.error).toBe('account_locked');
    const ev = await AuditEvent.findOne({ action: 'account_locked', whoUsername: 'locktest' });
    expect(ev).not.toBeNull();
  });

  test('OQ-AUTH-05: password change rejects a weak password (policy enforced)', async () => {
    const token = await fx.login('DataManager');
    const res = await ctx.agent.post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('password_policy');
  });

  test('OQ-AUTH-06: password change rejects reuse of the current password', async () => {
    const token = await fx.login('Administrator');
    const res = await ctx.agent.post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('password_reuse');
  });

  test('OQ-AUTH-07: an expired session token is rejected', async () => {
    // Forge a token that expired one hour ago, signed with the real secret.
    const expired = jwt.sign({ sub: String(fx.users.Investigator._id), role: 'Investigator' }, config.jwtSecret, { expiresIn: '-1h' });
    const res = await ctx.agent.get('/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('session_expired');
  });

  test('OQ-AUTH-08: a request with no token is rejected', async () => {
    const res = await ctx.agent.get('/auth/me');
    expect(res.status).toBe(401);
  });
});
