'use strict';

const path = require('path');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');
const { seedFixtures, PASSWORD } = require('../setup/fixtures');

const AuditEvent = require(path.join(SERVER_SRC, 'models', 'auditEvent.model'));
const Signature = require(path.join(SERVER_SRC, 'models', 'signature.model'));

/**
 * OQ — Electronic Signatures (21 CFR 11 subpart C: 11.50, 11.70, 11.200).
 * Proves re-authentication, signature manifestation, content binding, record
 * locking, and that tampering invalidates the signature.
 */
describe('Electronic signatures — binding, locking, tamper-evidence', () => {
  let ctx; let fx; let token;
  beforeAll(async () => {
    ctx = await startTestServer();
    fx = await seedFixtures(ctx.agent);
    token = await fx.login('Investigator');
  });
  afterAll(async () => { await ctx.stop(); });

  async function newVitalsForm() {
    const res = await ctx.agent.post('/forms').set('Authorization', `Bearer ${token}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    expect(res.status).toBe(201);
    return res.body;
  }

  test('OQ-SIG-01: signing requires correct re-authentication (wrong password → 401, no signature)', async () => {
    const form = await newVitalsForm();
    const res = await ctx.agent.post(`/forms/${form._id}/sign`).set('Authorization', `Bearer ${token}`)
      .send({ password: 'wrong-password', meaning: 'author' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('reauth_failed');
    const count = await Signature.countDocuments({ recordId: form._id });
    expect(count).toBe(0);
  });

  test('OQ-SIG-02: a valid signature captures printed name, UTC time, meaning, and a content hash', async () => {
    const form = await newVitalsForm();
    const res = await ctx.agent.post(`/forms/${form._id}/sign`).set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD, meaning: 'author' });
    expect(res.status).toBe(201);
    expect(res.body.printedName).toBe('Investigator User');
    expect(res.body.meaning).toBe('author');
    expect(res.body.whenUTC).toBeDefined();
    expect(res.body.contentHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    const ev = await AuditEvent.findOne({ action: 'sign', docId: form._id });
    expect(ev).not.toBeNull();
  });

  test('OQ-SIG-03: signing locks the record (status signed, locked=true)', async () => {
    const form = await newVitalsForm();
    await ctx.agent.post(`/forms/${form._id}/sign`).set('Authorization', `Bearer ${token}`).send({ password: PASSWORD, meaning: 'author' });
    const res = await ctx.agent.get(`/forms/${form._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.body.locked).toBe(true);
    expect(res.body.status).toBe('signed');
  });

  test('OQ-SIG-04: signature verifies as VALID immediately after signing', async () => {
    const form = await newVitalsForm();
    await ctx.agent.post(`/forms/${form._id}/sign`).set('Authorization', `Bearer ${token}`).send({ password: PASSWORD, meaning: 'author' });
    const res = await ctx.agent.get(`/forms/${form._id}/signatures`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].verification.valid).toBe(true);
  });

  test('OQ-SIG-05: invalid meaning is rejected', async () => {
    const form = await newVitalsForm();
    const res = await ctx.agent.post(`/forms/${form._id}/sign`).set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD, meaning: 'nonsense' });
    expect(res.status).toBe(422);
  });

  test('OQ-SIG-06: the Signature collection is append-only (cannot be altered or deleted)', async () => {
    const form = await newVitalsForm();
    await ctx.agent.post(`/forms/${form._id}/sign`).set('Authorization', `Bearer ${token}`).send({ password: PASSWORD, meaning: 'author' });
    const sig = await Signature.findOne({ recordId: form._id });
    await expect(Signature.updateOne({ _id: sig._id }, { meaning: 'approver' })).rejects.toThrow(/append-only/i);
    await expect(Signature.deleteOne({ _id: sig._id })).rejects.toThrow(/append-only/i);
  });
});
