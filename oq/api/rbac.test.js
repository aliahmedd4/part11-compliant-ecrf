'use strict';

const path = require('path');
const jwt = require('jsonwebtoken');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');
const { seedFixtures } = require('../setup/fixtures');

const AuditEvent = require(path.join(SERVER_SRC, 'models', 'auditEvent.model'));
const { can } = require(path.join(SERVER_SRC, 'security', 'permissions'));
const config = require(path.join(SERVER_SRC, 'config'));

/**
 * OQ — Role-Based Access Control (21 CFR 11.10(d)/(g)).
 * Includes SECURITY / NEGATIVE tests that attack the API directly, bypassing the
 * UI, to prove authority checks are enforced server-side.
 */
describe('RBAC authority checks (server-side enforcement)', () => {
  let ctx; let fx;
  beforeAll(async () => { ctx = await startTestServer(); fx = await seedFixtures(ctx.agent); });
  afterAll(async () => { await ctx.stop(); });

  test('OQ-RBAC-01: permission matrix returns expected authority decisions', () => {
    expect(can('Investigator', 'write', 'form')).toBe(true);
    expect(can('Monitor', 'write', 'form')).toBe(false);
    expect(can('Monitor', 'read', 'form')).toBe(true);
    expect(can('DataManager', 'export', 'dataset')).toBe(true);
    expect(can('Investigator', 'export', 'dataset')).toBe(false);
    expect(can('Administrator', 'anything', 'atall')).toBe(true);
  });

  test('OQ-RBAC-02: Investigator (authorized) can write form data', async () => {
    const token = await fx.login('Investigator');
    const res = await ctx.agent.post('/forms')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    expect(res.status).toBe(201);
  });

  test('OQ-RBAC-03: SECURITY — Monitor privilege escalation via direct API is blocked (403) and logged', async () => {
    const token = await fx.login('Monitor');
    const res = await ctx.agent.post('/forms')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
    // The denied attempt must appear in the audit trail.
    const ev = await AuditEvent.findOne({ action: 'access_denied', whoUsername: 'monitor' });
    expect(ev).not.toBeNull();
  });

  test('OQ-RBAC-04: SECURITY — a token with a tampered role does not grant access', async () => {
    // Forge a token claiming Administrator for the Monitor user id. The server
    // re-reads the real role from the DB, so the escalation fails.
    const forged = jwt.sign({ sub: String(fx.users.Monitor._id), role: 'Administrator' }, config.jwtSecret, { expiresIn: '15m' });
    const res = await ctx.agent.post('/forms')
      .set('Authorization', `Bearer ${forged}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    expect(res.status).toBe(403);
  });

  test('OQ-RBAC-05: a token signed with the wrong secret is rejected', async () => {
    const bad = jwt.sign({ sub: String(fx.users.Investigator._id), role: 'Investigator' }, 'attacker-secret', { expiresIn: '15m' });
    const res = await ctx.agent.get('/auth/me').set('Authorization', `Bearer ${bad}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });
});
