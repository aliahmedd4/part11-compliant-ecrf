'use strict';

/**
 * Seed script — provisions a minimal but realistic environment so the running
 * application (and the PQ mock study) has a study, a visit schedule, one user per
 * role, and a couple of enrolled subjects.
 *
 * Run with:  MONGODB_URI=... node src/seed.js
 * Passwords are policy-compliant; change them immediately in any real use.
 */
const config = require('./config');
const { connect, disconnect } = require('./db');
const User = require('./models/user.model');
const Study = require('./models/study.model');
const Visit = require('./models/visit.model');
const Subject = require('./models/subject.model');
const authService = require('./services/auth.service');
const { serverNow } = require('./lib/time');

const DEFAULT_PASSWORD = 'Str0ng-Passw0rd!';

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required to seed');
  await connect(uri);

  const roles = ['Investigator', 'DataManager', 'Monitor', 'Administrator'];
  for (const role of roles) {
    const username = role.toLowerCase();
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.findOne({ username });
    if (exists) continue;
    // eslint-disable-next-line no-await-in-loop
    const passwordHash = await authService.hashPassword(DEFAULT_PASSWORD);
    // eslint-disable-next-line no-await-in-loop
    await User.create({ username, printedName: `${role} User`, role, passwordHash, passwordChangedAtUTC: serverNow() });
  }

  let study = await Study.findOne({ protocolId: 'PROTO-001' });
  if (!study) study = await Study.create({ name: 'Demonstration Study', protocolId: 'PROTO-001', sponsor: 'Acme Pharma' });

  const visitNames = [
    { name: 'Screening', order: 1 },
    { name: 'Baseline', order: 2 },
    { name: 'Week 4', order: 3 },
  ];
  for (const v of visitNames) {
    // eslint-disable-next-line no-await-in-loop
    const found = await Visit.findOne({ studyId: study._id, name: v.name });
    if (!found) {
      // eslint-disable-next-line no-await-in-loop
      await Visit.create({ studyId: study._id, name: v.name, order: v.order, expectedForms: ['demographics', 'vitals', 'adverse_event'] });
    }
  }

  for (const code of ['S-001', 'S-002']) {
    // eslint-disable-next-line no-await-in-loop
    const found = await Subject.findOne({ studyId: study._id, subjectCode: code });
    if (!found) {
      // eslint-disable-next-line no-await-in-loop
      await Subject.create({ studyId: study._id, subjectCode: code, enrolledAtUTC: serverNow() });
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Users:', roles.map((r) => r.toLowerCase()).join(', '), '| password:', DEFAULT_PASSWORD);
  await disconnect();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
