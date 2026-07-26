'use strict';

const path = require('path');
const { SERVER_SRC } = require('./testServer');

const User = require(path.join(SERVER_SRC, 'models', 'user.model'));
const Study = require(path.join(SERVER_SRC, 'models', 'study.model'));
const Visit = require(path.join(SERVER_SRC, 'models', 'visit.model'));
const Subject = require(path.join(SERVER_SRC, 'models', 'subject.model'));
const authService = require(path.join(SERVER_SRC, 'services', 'auth.service'));
const { serverNow } = require(path.join(SERVER_SRC, 'lib', 'time'));

/**
 * Seed a realistic minimal environment for OQ tests: one user per role (with a
 * policy-compliant password), one study, one visit, one subject. Returns handles
 * plus a login() helper that authenticates through the real /auth/login route so
 * tests exercise the production auth path.
 */
const PASSWORD = 'Str0ng-Passw0rd!'; // meets default policy (>=12 chars, 4 classes)

async function seedFixtures(agent) {
  const roles = ['Investigator', 'DataManager', 'Monitor', 'Administrator'];
  const users = {};
  for (const role of roles) {
    // eslint-disable-next-line no-await-in-loop
    const passwordHash = await authService.hashPassword(PASSWORD);
    // eslint-disable-next-line no-await-in-loop
    users[role] = await User.create({
      username: role.toLowerCase(),
      printedName: `${role} User`,
      role,
      passwordHash,
      passwordChangedAtUTC: serverNow(),
    });
  }

  const study = await Study.create({ name: 'Demo Study', protocolId: 'PROTO-001', sponsor: 'Acme' });
  const visit = await Visit.create({ studyId: study._id, name: 'Baseline', order: 1, expectedForms: ['demographics', 'vitals', 'adverse_event'] });
  const subject = await Subject.create({ studyId: study._id, subjectCode: 'S-001', enrolledAtUTC: serverNow() });

  async function login(role) {
    const res = await agent.post('/auth/login').send({ username: role.toLowerCase(), password: PASSWORD });
    if (res.status !== 200) throw new Error(`login failed for ${role}: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.token;
  }

  return { users, study, visit, subject, login, PASSWORD };
}

module.exports = { seedFixtures, PASSWORD };
