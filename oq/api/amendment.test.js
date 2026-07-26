'use strict';

const path = require('path');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');
const { seedFixtures, PASSWORD } = require('../setup/fixtures');

const AuditEvent = require(path.join(SERVER_SRC, 'models', 'auditEvent.model'));

/**
 * OQ — Amendment workflow for signed records (21 CFR 11.10(e), 11.70).
 * Proves a signed record cannot be edited directly, that amending requires a
 * reason, bumps the version, is audited, and invalidates the prior signature.
 */
describe('Amendment workflow on signed records', () => {
  let ctx; let fx; let token;
  beforeAll(async () => {
    ctx = await startTestServer();
    fx = await seedFixtures(ctx.agent);
    token = await fx.login('Investigator');
  });
  afterAll(async () => { await ctx.stop(); });

  async function signedForm() {
    const created = await ctx.agent.post('/forms').set('Authorization', `Bearer ${token}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    await ctx.agent.post(`/forms/${created.body._id}/sign`).set('Authorization', `Bearer ${token}`).send({ password: PASSWORD, meaning: 'author' });
    return created.body._id;
  }

  test('OQ-AMD-01: SECURITY — editing a signed record via normal update is blocked (409)', async () => {
    const id = await signedForm();
    const res = await ctx.agent.patch(`/forms/${id}`).set('Authorization', `Bearer ${token}`)
      .send({ data: { systolic: 130 }, reason: 'trying to edit' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('record_locked');
  });

  test('OQ-AMD-02: amending requires a reason for change', async () => {
    const id = await signedForm();
    const res = await ctx.agent.post(`/forms/${id}/amend`).set('Authorization', `Bearer ${token}`)
      .send({ data: { systolic: 130 } });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('reason_required');
  });

  test('OQ-AMD-03: a valid amendment bumps version, re-opens the record, and is audited', async () => {
    const id = await signedForm();
    const res = await ctx.agent.post(`/forms/${id}/amend`).set('Authorization', `Bearer ${token}`)
      .send({ data: { systolic: 130 }, reason: 'transcription correction per source' });
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.locked).toBe(false); // re-opened; needs a fresh signature
    const amendEvents = await AuditEvent.find({ action: 'amend', docId: id });
    expect(amendEvents.length).toBeGreaterThanOrEqual(2); // data.systolic + version
    const reasoned = amendEvents.find((e) => /transcription correction/.test(e.reason || ''));
    expect(reasoned).toBeDefined();
  });

  test('OQ-AMD-04: after amendment the prior signature no longer verifies (tamper-evident)', async () => {
    const id = await signedForm();
    // Confirm valid first.
    let sigs = await ctx.agent.get(`/forms/${id}/signatures`).set('Authorization', `Bearer ${token}`);
    expect(sigs.body[0].verification.valid).toBe(true);
    // Amend, then the original signature must be invalid against the new content.
    await ctx.agent.post(`/forms/${id}/amend`).set('Authorization', `Bearer ${token}`).send({ data: { systolic: 145 }, reason: 'correction' });
    sigs = await ctx.agent.get(`/forms/${id}/signatures`).set('Authorization', `Bearer ${token}`);
    expect(sigs.body[0].verification.valid).toBe(false);
    expect(sigs.body[0].verification.reason).toMatch(/altered after signing/i);
  });
});
