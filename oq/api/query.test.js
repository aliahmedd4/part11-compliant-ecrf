'use strict';

const path = require('path');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');
const { seedFixtures } = require('../setup/fixtures');

const AuditEvent = require(path.join(SERVER_SRC, 'models', 'auditEvent.model'));

/**
 * OQ — Query workflow (raise -> respond -> close) with history, audit, and
 * role-based separation of duties.
 */
describe('Query workflow', () => {
  let ctx; let fx; let formId;
  beforeAll(async () => {
    ctx = await startTestServer();
    fx = await seedFixtures(ctx.agent);
    const invToken = await fx.login('Investigator');
    const created = await ctx.agent.post('/forms').set('Authorization', `Bearer ${invToken}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    formId = created.body._id;
  });
  afterAll(async () => { await ctx.stop(); });

  test('OQ-QRY-01: a Monitor can raise a query (open + history + audit)', async () => {
    const token = await fx.login('Monitor');
    const res = await ctx.agent.post('/queries').set('Authorization', `Bearer ${token}`)
      .send({ formInstanceId: formId, field: 'data.systolic', text: 'Please confirm value against source' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    expect(res.body.history).toHaveLength(1);
    const ev = await AuditEvent.findOne({ action: 'query_raise', docId: res.body._id });
    expect(ev).not.toBeNull();
  });

  test('OQ-QRY-02: full lifecycle raise -> respond -> close with separation of duties', async () => {
    const monitor = await fx.login('Monitor');
    const investigator = await fx.login('Investigator');
    const dataManager = await fx.login('DataManager');

    const raised = await ctx.agent.post('/queries').set('Authorization', `Bearer ${monitor}`)
      .send({ formInstanceId: formId, field: 'data.heartRate', text: 'Confirm HR' });
    const qid = raised.body._id;

    const responded = await ctx.agent.post(`/queries/${qid}/respond`).set('Authorization', `Bearer ${investigator}`)
      .send({ text: 'Confirmed, HR is correct' });
    expect(responded.status).toBe(200);
    expect(responded.body.status).toBe('answered');

    const closed = await ctx.agent.post(`/queries/${qid}/close`).set('Authorization', `Bearer ${dataManager}`)
      .send({ text: 'Resolved' });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('closed');
    expect(closed.body.history.map((h) => h.action)).toEqual(['raise', 'respond', 'close']);
  });

  test('OQ-QRY-03: an Investigator cannot raise a query (403 — not their authority)', async () => {
    const token = await fx.login('Investigator');
    const res = await ctx.agent.post('/queries').set('Authorization', `Bearer ${token}`)
      .send({ formInstanceId: formId, field: 'data.systolic', text: 'x' });
    expect(res.status).toBe(403);
  });

  test('OQ-QRY-04: an Investigator cannot close a query (403 — separation of duties)', async () => {
    const monitor = await fx.login('Monitor');
    const investigator = await fx.login('Investigator');
    const raised = await ctx.agent.post('/queries').set('Authorization', `Bearer ${monitor}`)
      .send({ formInstanceId: formId, field: 'data.systolic', text: 'check' });
    const res = await ctx.agent.post(`/queries/${raised.body._id}/close`).set('Authorization', `Bearer ${investigator}`).send({ text: 'x' });
    expect(res.status).toBe(403);
  });

  test('OQ-QRY-05: an open query cannot be closed until it has been answered (409)', async () => {
    const monitor = await fx.login('Monitor');
    const dataManager = await fx.login('DataManager');
    const raised = await ctx.agent.post('/queries').set('Authorization', `Bearer ${monitor}`)
      .send({ formInstanceId: formId, field: 'data.diastolic', text: 'Confirm diastolic' });
    const res = await ctx.agent.post(`/queries/${raised.body._id}/close`).set('Authorization', `Bearer ${dataManager}`)
      .send({ text: 'closing early' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('invalid_transition');
  });
});
