'use strict';

const path = require('path');
const crypto = require('crypto');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');
const { seedFixtures } = require('../setup/fixtures');

const AuditEvent = require(path.join(SERVER_SRC, 'models', 'auditEvent.model'));

/**
 * OQ — Dataset export with an integrity checksum, and export authority.
 */
describe('Dataset export with integrity checksum', () => {
  let ctx; let fx;
  beforeAll(async () => {
    ctx = await startTestServer();
    fx = await seedFixtures(ctx.agent);
    const inv = await fx.login('Investigator');
    await ctx.agent.post('/forms').set('Authorization', `Bearer ${inv}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 118, diastolic: 76, heartRate: 66 } });
  });
  afterAll(async () => { await ctx.stop(); });

  test('OQ-EXP-01: DataManager can export; files + checksum manifest returned', async () => {
    const token = await fx.login('DataManager');
    const res = await ctx.agent.get('/export/dataset').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.files['dataset.json']).toBeDefined();
    expect(res.body.files['forms.csv']).toBeDefined();
    expect(res.body.files['checksums.txt']).toBeDefined();
    expect(res.body.manifest.algorithm).toBe('SHA-256');
  });

  test('OQ-EXP-02: recomputing the checksum of the exported file matches the manifest', async () => {
    const token = await fx.login('DataManager');
    const res = await ctx.agent.get('/export/dataset').set('Authorization', `Bearer ${token}`);
    const jsonContent = res.body.files['dataset.json'];
    const recomputed = crypto.createHash('sha256').update(jsonContent).digest('hex');
    expect(recomputed).toBe(res.body.manifest.checksums['dataset.json']);
  });

  test('OQ-EXP-03: an export is recorded in the audit trail', async () => {
    const token = await fx.login('DataManager');
    await ctx.agent.get('/export/dataset').set('Authorization', `Bearer ${token}`);
    const ev = await AuditEvent.findOne({ action: 'export', whoUsername: 'datamanager' });
    expect(ev).not.toBeNull();
  });

  test('OQ-EXP-04: SECURITY — an Investigator cannot export the dataset (403 + logged)', async () => {
    const token = await fx.login('Investigator');
    const res = await ctx.agent.get('/export/dataset').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    const ev = await AuditEvent.findOne({ action: 'access_denied', whoUsername: 'investigator', targetModel: 'dataset' });
    expect(ev).not.toBeNull();
  });

  test('OQ-EXP-05: forms.csv rows are ordered deterministically by _id', async () => {
    const inv = await fx.login('Investigator');
    // Add a couple more forms so ordering is observable.
    for (const hr of [61, 62, 63]) {
      // eslint-disable-next-line no-await-in-loop
      await ctx.agent.post('/forms').set('Authorization', `Bearer ${inv}`)
        .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: hr } });
    }
    const token = await fx.login('DataManager');
    const res = await ctx.agent.get('/export/dataset').set('Authorization', `Bearer ${token}`);
    const lines = res.body.files['forms.csv'].split('\n').slice(1); // drop header row
    const ids = lines.map((l) => l.split(',')[0].replace(/"/g, ''));
    expect(ids).toEqual([...ids].sort());
  });
});
