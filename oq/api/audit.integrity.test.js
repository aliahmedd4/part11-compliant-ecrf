'use strict';

const path = require('path');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');

const AuditEvent = require(path.join(SERVER_SRC, 'models', 'auditEvent.model'));
const { writeAudit, diffAndAudit } = require(path.join(SERVER_SRC, 'services', 'audit.service'));

/**
 * OQ — Audit Trail Integrity (21 CFR 11.10(e), ALCOA+).
 * Proves the audit collection is append-only and that changes are captured
 * field-by-field with a server timestamp.
 */
describe('Audit trail is append-only and complete', () => {
  let ctx;
  const actor = { username: 'tester', _id: undefined };

  beforeAll(async () => {
    ctx = await startTestServer();
  });
  afterAll(async () => {
    await ctx.stop();
  });

  test('OQ-AUD-01: writeAudit persists an event with a server timestamp', async () => {
    const before = Date.now();
    const ev = await writeAudit({
      actor,
      collection: 'Subject',
      docId: undefined,
      field: 'status',
      oldValue: 'screening',
      newValue: 'enrolled',
      reason: 'enrolment',
      action: 'update',
    });
    expect(ev.whoUsername).toBe('tester');
    expect(ev.whenUTC).toBeInstanceOf(Date);
    // Timestamp came from the server clock, close to "now".
    expect(ev.whenUTC.getTime()).toBeGreaterThanOrEqual(before);
    expect(ev.whenUTC.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  test('OQ-AUD-02: AuditEvent cannot be updated via any pathway', async () => {
    const ev = await AuditEvent.create({
      whoUsername: 'x', targetModel: 'Subject', field: 'f', oldValue: 'a', newValue: 'b',
      reason: 'r', action: 'update', whenUTC: new Date(),
    });
    await expect(AuditEvent.updateOne({ _id: ev._id }, { newValue: 'hacked' })).rejects.toThrow(/append-only/i);
    await expect(AuditEvent.updateMany({}, { newValue: 'hacked' })).rejects.toThrow(/append-only/i);
    await expect(AuditEvent.findByIdAndUpdate(ev._id, { newValue: 'hacked' })).rejects.toThrow(/append-only/i);
    // Re-saving an existing (loaded) document is also blocked.
    const loaded = await AuditEvent.findById(ev._id);
    loaded.newValue = 'hacked';
    await expect(loaded.save()).rejects.toThrow(/append-only/i);
    // Confirm the stored value never changed.
    const fresh = await AuditEvent.findById(ev._id);
    expect(fresh.newValue).toBe('b');
  });

  test('OQ-AUD-03: AuditEvent cannot be deleted via any pathway', async () => {
    const ev = await AuditEvent.create({
      whoUsername: 'x', targetModel: 'Subject', field: 'f', oldValue: 'a', newValue: 'b',
      reason: 'r', action: 'update', whenUTC: new Date(),
    });
    await expect(AuditEvent.deleteOne({ _id: ev._id })).rejects.toThrow(/append-only/i);
    await expect(AuditEvent.deleteMany({})).rejects.toThrow(/append-only/i);
    await expect(AuditEvent.findByIdAndDelete(ev._id)).rejects.toThrow(/append-only/i);
    const stillThere = await AuditEvent.findById(ev._id);
    expect(stillThere).not.toBeNull();
  });

  test('OQ-AUD-04: diffAndAudit writes one event per changed field only', async () => {
    const before = { status: 'screening', code: 'S-001' };
    const after = { status: 'enrolled', code: 'S-001' }; // only status changed
    const events = await diffAndAudit({
      before, after, actor, collection: 'Subject', docId: undefined, reason: 'test',
    });
    expect(events).toHaveLength(1);
    expect(events[0].field).toBe('status');
    expect(events[0].oldValue).toBe('screening');
    expect(events[0].newValue).toBe('enrolled');
  });
});
