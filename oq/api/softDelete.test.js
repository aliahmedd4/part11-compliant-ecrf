'use strict';

const path = require('path');
const { startTestServer, SERVER_SRC } = require('../setup/testServer');

const Study = require(path.join(SERVER_SRC, 'models', 'study.model'));

/**
 * OQ — Soft Delete Only (ALCOA+ Enduring/Complete, 21 CFR 11.10(c)).
 * Proves hard deletes are impossible and that a soft delete hides the record from
 * ordinary reads while retaining it for review.
 */
describe('Soft delete only — no hard deletes anywhere', () => {
  let ctx;
  beforeAll(async () => { ctx = await startTestServer(); });
  afterAll(async () => { await ctx.stop(); });

  test('OQ-SD-01: new documents default to not-deleted', async () => {
    const s = await Study.create({ name: 'S', protocolId: 'P1' });
    expect(s.deleted.isDeleted).toBe(false);
  });

  test('OQ-SD-02: hard delete pathways all throw', async () => {
    const s = await Study.create({ name: 'S', protocolId: 'P2' });
    await expect(Study.deleteOne({ _id: s._id })).rejects.toThrow(/hard delete/i);
    await expect(Study.deleteMany({})).rejects.toThrow(/hard delete/i);
    await expect(Study.findByIdAndDelete(s._id)).rejects.toThrow(/hard delete/i);
  });

  test('OQ-SD-03: softDelete sets metadata and hides from default reads', async () => {
    const s = await Study.create({ name: 'ToDelete', protocolId: 'P3' });
    await s.softDelete({ byUserId: undefined, reason: 'obsolete' });

    // Default read excludes it...
    const notFound = await Study.findOne({ _id: s._id });
    expect(notFound).toBeNull();

    // ...but it is retained and retrievable with an explicit opt-in.
    const found = await Study.findOne({ _id: s._id }).setOptions({ includeDeleted: true });
    expect(found).not.toBeNull();
    expect(found.deleted.isDeleted).toBe(true);
    expect(found.deleted.reason).toBe('obsolete');
    expect(found.deleted.atUTC).toBeInstanceOf(Date);
  });
});
