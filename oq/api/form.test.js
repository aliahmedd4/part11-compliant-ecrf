'use strict';

const path = require('path');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');
const { seedFixtures } = require('../setup/fixtures');

const AuditEvent = require(path.join(SERVER_SRC, 'models', 'auditEvent.model'));
const Subject = require(path.join(SERVER_SRC, 'models', 'subject.model'));

/**
 * OQ — Subject enrolment and form data entry with edit checks, audit, and
 * server-only timestamps.
 */
describe('Subject enrolment and form data entry', () => {
  let ctx; let fx; let token;
  beforeAll(async () => {
    ctx = await startTestServer();
    fx = await seedFixtures(ctx.agent);
    token = await fx.login('Investigator');
  });
  afterAll(async () => { await ctx.stop(); });

  test('OQ-FORM-01: enrolment sets a server timestamp and is audited', async () => {
    const res = await ctx.agent.post('/subjects').set('Authorization', `Bearer ${token}`)
      .send({ studyId: fx.study._id, subjectCode: 'S-100' });
    expect(res.status).toBe(201);
    expect(res.body.enrolledAtUTC).toBeDefined();
    const ev = await AuditEvent.findOne({ action: 'create', targetModel: 'Subject', docId: res.body._id });
    expect(ev).not.toBeNull();
  });

  test('OQ-FORM-02: SECURITY — a client-supplied timestamp is ignored (server time wins)', async () => {
    // Attempt to back-date the enrolment via the request body.
    const backdated = '2000-01-01T00:00:00.000Z';
    const res = await ctx.agent.post('/subjects').set('Authorization', `Bearer ${token}`)
      .send({ studyId: fx.study._id, subjectCode: 'S-101', enrolledAtUTC: backdated });
    expect(res.status).toBe(201);
    const stored = await Subject.findById(res.body._id);
    expect(new Date(stored.enrolledAtUTC).getFullYear()).toBe(new Date().getFullYear());
    expect(stored.enrolledAtUTC.toISOString()).not.toBe(backdated);
  });

  test('OQ-FORM-03: invalid form data is rejected (422) and nothing is written', async () => {
    const before = await AuditEvent.countDocuments({ targetModel: 'FormInstance', action: 'create' });
    const res = await ctx.agent.post('/forms').set('Authorization', `Bearer ${token}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 400, diastolic: 80, heartRate: 70 } });
    expect(res.status).toBe(422);
    expect(res.body.errors.find((e) => e.field === 'systolic')).toBeDefined();
    const after = await AuditEvent.countDocuments({ targetModel: 'FormInstance', action: 'create' });
    expect(after).toBe(before); // no audit event => no write happened
  });

  test('OQ-FORM-04: valid update diff-audits only changed fields with a reason', async () => {
    const created = await ctx.agent.post('/forms').set('Authorization', `Bearer ${token}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    const id = created.body._id;
    const res = await ctx.agent.patch(`/forms/${id}`).set('Authorization', `Bearer ${token}`)
      .send({ data: { systolic: 125 }, reason: 'source correction' });
    expect(res.status).toBe(200);
    const events = await AuditEvent.find({ action: 'update', docId: id });
    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('data.systolic');
    expect(events[0].oldValue).toBe(120);
    expect(events[0].newValue).toBe(125);
    expect(events[0].reason).toBe('source correction');
  });

  test('OQ-FORM-05: an update without a reason for change is rejected (422)', async () => {
    const created = await ctx.agent.post('/forms').set('Authorization', `Bearer ${token}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    const res = await ctx.agent.patch(`/forms/${created.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ data: { systolic: 130 } });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('reason_required');
  });

  test('OQ-FORM-06: SECURITY — there is no API path to modify an audit entry', async () => {
    // The audit trail is exposed read-only; any write verb is unroutable.
    const ev = await AuditEvent.findOne({});
    const adminToken = await fx.login('Administrator');
    // No PUT/PATCH/DELETE route exists for /admin/audit.
    const patch = await ctx.agent.patch(`/admin/audit/${ev._id}`).set('Authorization', `Bearer ${adminToken}`).send({ newValue: 'hacked' });
    const del = await ctx.agent.delete(`/admin/audit/${ev._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
    // And the model layer itself refuses mutation (defence in depth).
    await expect(AuditEvent.updateOne({ _id: ev._id }, { newValue: 'hacked' })).rejects.toThrow(/append-only/i);
  });
});
