'use strict';

const fs = require('fs');
const path = require('path');
const { startTestServer, SERVER_SRC } = require('./setup/testServer');
const { seedFixtures, PASSWORD } = require('./setup/fixtures');

const AuditEvent = require(path.join(SERVER_SRC, 'models', 'auditEvent.model'));

/**
 * Generate an AUDIT-TRAIL EVIDENCE dump.
 *
 * This script runs a representative end-to-end scenario (enrol, enter data, raise
 * and resolve a query, sign, attempt an illegal edit, amend) against an in-memory
 * database and then exports the resulting AuditEvent collection to /evidence.
 *
 * The dumped audit trail is objective OQ/PQ evidence: it shows, as machine-
 * generated records, exactly who did what and when — the ALCOA+ story — without a
 * single screenshot. This is the Computer Software Assurance philosophy in action.
 */
async function main() {
  const ctx = await startTestServer();
  try {
    const fx = await seedFixtures(ctx.agent);
    const inv = await fx.login('Investigator');
    const monitor = await fx.login('Monitor');
    const dm = await fx.login('DataManager');
    const auth = (t) => ({ Authorization: `Bearer ${t}` });

    // Enter vitals, raise+resolve a query, sign, illegal edit attempt, amend.
    const form = (await ctx.agent.post('/forms').set(auth(inv))
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } })).body;
    const q = (await ctx.agent.post('/queries').set(auth(monitor))
      .send({ formInstanceId: form._id, field: 'data.systolic', text: 'Confirm against source' })).body;
    await ctx.agent.post(`/queries/${q._id}/respond`).set(auth(inv)).send({ text: 'Confirmed' });
    await ctx.agent.post(`/queries/${q._id}/close`).set(auth(dm)).send({ text: 'Resolved' });
    await ctx.agent.post(`/forms/${form._id}/sign`).set(auth(inv)).send({ password: PASSWORD, meaning: 'author' });
    // Illegal edit after signing (blocked + logged), then a proper amendment.
    await ctx.agent.patch(`/forms/${form._id}`).set(auth(inv)).send({ data: { systolic: 200 }, reason: 'illegal' });
    await ctx.agent.post(`/forms/${form._id}/amend`).set(auth(inv)).send({ data: { systolic: 122 }, reason: 'source verification correction' });
    // A privilege-escalation attempt for good measure.
    await ctx.agent.post('/forms').set(auth(monitor))
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });

    const events = await AuditEvent.find({}).sort({ whenUTC: 1 }).lean();
    const outDir = path.join(__dirname, '..', 'evidence');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const payload = {
      artefact: 'Audit Trail Evidence Dump',
      generatedUTC: new Date().toISOString(),
      scenario: 'enrol → enter vitals → query raise/respond/close → sign → blocked illegal edit → amend → blocked privilege escalation',
      totalEvents: events.length,
      events,
    };
    const file = path.join(outDir, `audit-trail-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(outDir, 'audit-trail-latest.json'), JSON.stringify(payload, null, 2));
    // eslint-disable-next-line no-console
    console.log(`[audit evidence] ${events.length} events written to ${file}`);
  } finally {
    await ctx.stop();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
