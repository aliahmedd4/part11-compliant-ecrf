# Code-Review Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 10 bugs found in the code review of the Part 11 eCRF (e-signature integrity, edit-check bypasses, query state machine, form concurrency, export determinism, secret hardening, and three React client defects).

**Architecture:** Server is Express + Mongoose; the OQ suite (Jest + supertest + `mongodb-memory-server`) exercises the *real* app via `createApp()`, so every server fix gets a Jest test that boots the true stack. Client is React (Vite); client fixes are proven by the Playwright OQ-UI suite. Each task is TDD: write the failing test, watch it fail, implement the minimal fix, watch it pass, commit.

**Tech Stack:** Node.js, Express, Mongoose, bcryptjs, jsonwebtoken, Jest 29, supertest, mongodb-memory-server 10, Playwright 1.49, React 18, Vite.

---

## Conventions for every task

- **Run API tests from the `oq/` directory.** Command shape: `npm --prefix oq run oq:api -- <testFilePattern>` or, equivalently, from inside `oq/`: `npx jest --config jest.config.js --runInBand <pattern>`. Examples below use the `oq/` cwd form.
- **Run one file:** `npx jest --config jest.config.js --runInBand api/signature.test.js`
- **Run one test:** add `-t "OQ-SIG-07"`.
- **Playwright (client tasks):** requires a seeded API + client dev server running (see `oq/ui/ecrf.spec.js` header). Command: `npm --prefix oq run oq:ui`.
- **Commit trailer:** end every commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Do the tasks in order; Task 8 (visits endpoint) must land before the client Task 10 Playwright run, because the UI form only renders once visits are available.

## File Structure (what changes and why)

**Server — source**
- `server/src/services/signature.service.js` — add "already signed" guard (Task 1).
- `server/src/models/signature.model.js` — add unique index preventing duplicate signatures (Task 1).
- `server/src/services/auth.service.js` — `verifyCredentials` must respect account `active` + `lockedUntil` (Task 2).
- `server/src/validation/editChecks.js` — reject non-numeric vitals; coerce `ongoing` (Task 3).
- `server/src/services/query.service.js` — `closeQuery` requires the `answered` state (Task 4).
- `server/src/models/formInstance.model.js` — enable optimistic concurrency (Task 5).
- `server/src/services/form.service.js` — translate `VersionError` → 409 in `updateForm`/`amendForm` (Task 5).
- `server/src/services/export.service.js` — deterministic `.sort({ _id: 1 })` on all export queries (Task 6).
- `server/src/config.js` — `assertSecretsConfigured()` fail-closed helper (Task 7).
- `server/src/index.js` — call the helper at startup (Task 7).
- `server/src/routes/subject.routes.js` — `GET /subjects/:id/visits` (Task 8).

**Client — source**
- `client/src/api.js` — `listVisits` method (Task 8).
- `client/src/Dashboard.jsx` — fetch visits, gate + wire VitalsForm on a real visit id (Task 8); race-safe `loadForms` (Task 9... see below).
- `client/src/VitalsForm.jsx` — blank field → omitted (not `0`) (Task 9).

**Tests — created/modified**
- `oq/api/signature.test.js` — OQ-SIG-07, OQ-SIG-08 (Tasks 1, 2).
- `oq/api/editChecks.test.js` — OQ-EC-08, OQ-EC-09 (Task 3).
- `oq/api/query.test.js` — OQ-QRY-05 (Task 4).
- `oq/api/form.test.js` — OQ-FORM-07 (Task 5), OQ-FORM-08 (Task 8).
- `oq/api/export.test.js` — OQ-EXP-05 (Task 6).
- `oq/api/config.test.js` — created; OQ-CFG-01/02 (Task 7).
- `oq/ui/ecrf.spec.js` — OQ-UI-05 (Task 9).

---

## Task 1: Prevent re-signing an already-signed record (finding S1)

**Files:**
- Modify: `server/src/services/signature.service.js:66-70`
- Modify: `server/src/models/signature.model.js:41`
- Test: `oq/api/signature.test.js` (append OQ-SIG-07)

- [ ] **Step 1: Write the failing test**

Append this test inside the `describe(...)` block in `oq/api/signature.test.js`, after OQ-SIG-06:

```javascript
  test('OQ-SIG-07: an already-signed record cannot be signed again (409, no second signature)', async () => {
    const form = await newVitalsForm();
    const first = await ctx.agent.post(`/forms/${form._id}/sign`).set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD, meaning: 'author' });
    expect(first.status).toBe(201);

    const second = await ctx.agent.post(`/forms/${form._id}/sign`).set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD, meaning: 'reviewer' });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('already_signed');

    const count = await Signature.countDocuments({ recordId: form._id });
    expect(count).toBe(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/signature.test.js -t "OQ-SIG-07"`
Expected: FAIL — the second sign returns 201 and `count` is 2 (no guard exists yet).

- [ ] **Step 3: Add the guard in the service**

In `server/src/services/signature.service.js`, the current code (lines 66-70) reads:

```javascript
  const form = await FormInstance.findById(formId);
  if (!form) { const e = new Error('Form not found'); e.status = 404; throw e; }

  // 2. Compute the binding hash over the canonical signed content + pepper.
  const hash = contentHash(signableContent(form), config.signaturePepper);
```

Replace it with (adds the already-signed check between the 404 and the hash):

```javascript
  const form = await FormInstance.findById(formId);
  if (!form) { const e = new Error('Form not found'); e.status = 404; throw e; }

  // A signed/locked record is closed to further signatures; it must be amended
  // (which re-opens it under a new version) before it can be signed again.
  if (form.locked || form.status === 'signed') {
    await writeAudit({ actor, collection: 'FormInstance', docId: form._id, action: 'access_denied', reason: 'attempt to re-sign an already-signed record' });
    const e = new Error('Record is already signed'); e.status = 409; e.code = 'already_signed'; throw e;
  }

  // 2. Compute the binding hash over the canonical signed content + pepper.
  const hash = contentHash(signableContent(form), config.signaturePepper);
```

- [ ] **Step 4: Add the uniqueness constraint (defence in depth against a concurrent double-sign)**

In `server/src/models/signature.model.js`, immediately after the existing line 41 `signatureSchema.plugin(appendOnlyPlugin);`, add:

```javascript
// One signature per (record, version, meaning): blocks duplicate/concurrent signs
// of the same manifestation even if two requests race past the service guard.
signatureSchema.index({ recordId: 1, recordVersion: 1, meaning: 1 }, { unique: true });
```

- [ ] **Step 5: Run the test to verify it passes**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/signature.test.js`
Expected: PASS — all OQ-SIG cases including OQ-SIG-07 green.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/signature.service.js server/src/models/signature.model.js oq/api/signature.test.js
git commit -m "fix(signature): reject re-signing a locked record and enforce signature uniqueness"
```

---

## Task 2: Signature re-authentication must respect lockout and account state (finding A1)

**Files:**
- Modify: `server/src/services/auth.service.js:69-73`
- Test: `oq/api/signature.test.js` (append OQ-SIG-08)

- [ ] **Step 1: Write the failing test**

Add these requires at the top of `oq/api/signature.test.js` (the file already requires `Signature`; add `User` and `authService`). After the existing `const Signature = require(...)` line, add:

```javascript
const User = require(path.join(SERVER_SRC, 'models', 'user.model'));
const authService = require(path.join(SERVER_SRC, 'services', 'auth.service'));
```

Then append this test at the end of the `describe(...)` block:

```javascript
  test('OQ-SIG-08: a locked-out signer is refused signing even with the correct password', async () => {
    // Dedicated Investigator so we do not disturb the shared fixture token.
    const passwordHash = await authService.hashPassword(PASSWORD);
    await User.create({ username: 'siglock', printedName: 'Sig Lock', role: 'Investigator', passwordHash, passwordChangedAtUTC: new Date() });
    const lockToken = await fx.login('Investigator') && (await ctx.agent.post('/auth/login').send({ username: 'siglock', password: PASSWORD })).body.token;

    const created = await ctx.agent.post('/forms').set('Authorization', `Bearer ${lockToken}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    const formId = created.body._id;

    // Lock the account (as the failed-login path would).
    await User.updateOne({ username: 'siglock' }, { lockedUntil: new Date(Date.now() + 3600000) });

    const res = await ctx.agent.post(`/forms/${formId}/sign`).set('Authorization', `Bearer ${lockToken}`)
      .send({ password: PASSWORD, meaning: 'author' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('reauth_failed');
    const count = await Signature.countDocuments({ recordId: formId });
    expect(count).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/signature.test.js -t "OQ-SIG-08"`
Expected: FAIL — signing currently succeeds (201) because `verifyCredentials` ignores `lockedUntil`.

- [ ] **Step 3: Harden `verifyCredentials`**

In `server/src/services/auth.service.js`, replace the whole `verifyCredentials` function (lines 64-73) with:

```javascript
/**
 * Verify a raw username/password against the stored hash. Used for signing
 * re-authentication (11.200(a)(1)). A signature is a controlled act, so a
 * deactivated or currently locked-out account is refused here just as it is at
 * login — otherwise the signing path would bypass the lockout / revocation
 * controls. Does NOT mutate lockout state.
 * @returns {Promise<boolean>}
 */
async function verifyCredentials(username, password) {
  const user = await User.findOne({ username });
  if (!user || !user.active) return false;
  if (user.lockedUntil && user.lockedUntil > serverNow()) return false;
  return bcrypt.compare(password, user.passwordHash);
}
```

(`serverNow` and `User` are already imported at the top of this file — no new imports needed.)

- [ ] **Step 4: Run the test to verify it passes**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/signature.test.js`
Expected: PASS — OQ-SIG-08 green and OQ-SIG-01..07 still green.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/auth.service.js oq/api/signature.test.js
git commit -m "fix(auth): signature re-authentication respects account lockout and active state"
```

---

## Task 3: Close edit-check bypasses for non-numeric and coerced inputs (findings D2, D6)

**Files:**
- Modify: `server/src/validation/editChecks.js:54-88,90-105`
- Test: `oq/api/editChecks.test.js` (append OQ-EC-08, OQ-EC-09)

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('Edit-check engine', ...)` block in `oq/api/editChecks.test.js`:

```javascript
  test('OQ-EC-08: numeric vitals sent as strings are rejected (no silent range bypass)', () => {
    const errors = checkForm('vitals', { systolic: '500', diastolic: '80', heartRate: '70' });
    expect(errors.find((e) => e.field === 'systolic' && e.rule === 'numeric')).toBeDefined();
  });

  test('OQ-EC-09: an ongoing AE flagged with string "true" still cannot have an end date', () => {
    const errors = checkForm('adverse_event', { term: 'Rash', severity: 'mild', startDate: '2026-02-01', ongoing: 'true', endDate: '2026-03-01' });
    expect(errors.find((e) => e.field === 'endDate' && e.rule === 'cross_field')).toBeDefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/editChecks.test.js -t "OQ-EC-08|OQ-EC-09"`
Expected: FAIL — OQ-EC-08 finds no `numeric` violation (string skips checks); OQ-EC-09 finds no cross-field error (`'true' === true` is false).

- [ ] **Step 3: Add a numeric-type check to vitals**

In `server/src/validation/editChecks.js`, replace `checkVitals` (lines 54-67) with:

```javascript
function checkVitals(d) {
  const errors = [];
  required(errors, d, 'systolic', 'Systolic blood pressure is required');
  required(errors, d, 'diastolic', 'Diastolic blood pressure is required');
  required(errors, d, 'heartRate', 'Heart rate is required');
  // A present-but-non-numeric value (e.g. the string "500") must not slip past
  // the range/cross-field checks, which only run on real numbers.
  numeric(errors, d, 'systolic');
  numeric(errors, d, 'diastolic');
  numeric(errors, d, 'heartRate');
  range(errors, d, 'systolic', 60, 300);
  range(errors, d, 'diastolic', 30, 200);
  range(errors, d, 'heartRate', 20, 250);
  // Cross-field: systolic must exceed diastolic.
  if (isNum(d.systolic) && isNum(d.diastolic) && d.systolic <= d.diastolic) {
    errors.push({ field: 'systolic', rule: 'cross_field', message: 'Systolic must be greater than diastolic' });
  }
  return errors;
}
```

- [ ] **Step 4: Coerce the `ongoing` flag in the adverse-event check**

In the same file, replace the ongoing block in `checkAdverseEvent` (lines 83-86) with:

```javascript
  // Cross-field: an ongoing event cannot also have an end date. Accept common
  // truthy encodings (boolean true, "true", 1) so a lenient client cannot bypass it.
  const ongoing = d.ongoing === true || d.ongoing === 'true' || d.ongoing === 1;
  if (ongoing && d.endDate) {
    errors.push({ field: 'endDate', rule: 'cross_field', message: 'An ongoing event cannot have an end date' });
  }
```

- [ ] **Step 5: Add the `numeric` helper**

In the same file, in the `// --- helpers ---` section, add this helper immediately after the `range(...)` function (after line 102):

```javascript
function numeric(errors, d, field) {
  const v = d[field];
  if (v === undefined || v === null || v === '') return; // completeness handled by required()
  if (typeof v !== 'number' || Number.isNaN(v)) {
    errors.push({ field, rule: 'numeric', message: `${field} must be a number` });
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/editChecks.test.js`
Expected: PASS — OQ-EC-01..09 all green.

- [ ] **Step 7: Commit**

```bash
git add server/src/validation/editChecks.js oq/api/editChecks.test.js
git commit -m "fix(editchecks): reject non-numeric vitals and coerce the ongoing AE flag"
```

---

## Task 4: Enforce the query state machine on close (finding D1)

**Files:**
- Modify: `server/src/services/query.service.js:48-58`
- Test: `oq/api/query.test.js` (append OQ-QRY-05)

- [ ] **Step 1: Write the failing test**

Append inside the `describe('Query workflow', ...)` block in `oq/api/query.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/query.test.js -t "OQ-QRY-05"`
Expected: FAIL — closing an open query currently returns 200 (only `closed` is rejected today).

- [ ] **Step 3: Tighten the transition guard**

In `server/src/services/query.service.js`, in `closeQuery` replace line 51:

```javascript
  if (query.status === 'closed') throw invalidTransition('closed', 'close');
```

with:

```javascript
  // A query may only be closed from the 'answered' state (open -> answered -> closed).
  if (query.status !== 'answered') throw invalidTransition(query.status, 'close');
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/query.test.js`
Expected: PASS — OQ-QRY-05 green and OQ-QRY-02 (raise→respond→close) still green (it answers before closing).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/query.service.js oq/api/query.test.js
git commit -m "fix(query): only allow closing an answered query (enforce state machine)"
```

---

## Task 5: Add optimistic concurrency to form updates (finding D4)

**Files:**
- Modify: `server/src/models/formInstance.model.js:30`
- Modify: `server/src/services/form.service.js:69-76,105-109`
- Test: `oq/api/form.test.js` (append OQ-FORM-07)

- [ ] **Step 1: Write the failing test**

At the top of `oq/api/form.test.js`, after the existing `const Subject = require(...)` line, add:

```javascript
const FormInstance = require(path.join(SERVER_SRC, 'models', 'formInstance.model'));
```

Append inside the `describe('Subject enrolment and form data entry', ...)` block:

```javascript
  test('OQ-FORM-07: a stale concurrent save is rejected (optimistic concurrency)', async () => {
    const created = await ctx.agent.post('/forms').set('Authorization', `Bearer ${token}`)
      .send({ subjectId: fx.subject._id, visitId: fx.visit._id, type: 'vitals', data: { systolic: 120, diastolic: 80, heartRate: 70 } });
    const id = created.body._id;

    const a = await FormInstance.findById(id);
    const b = await FormInstance.findById(id);
    a.data = { ...a.toObject().data, systolic: 121 };
    await a.save();
    b.data = { ...b.toObject().data, systolic: 122 };
    await expect(b.save()).rejects.toThrow(/version/i);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/form.test.js -t "OQ-FORM-07"`
Expected: FAIL — `b.save()` resolves (last-write-wins) because optimistic concurrency is not enabled.

- [ ] **Step 3: Enable optimistic concurrency on the schema**

In `server/src/models/formInstance.model.js`, change the schema options (line 30) from:

```javascript
  { timestamps: true, minimize: false }
```

to:

```javascript
  { timestamps: true, minimize: false, optimisticConcurrency: true }
```

- [ ] **Step 4: Translate the version conflict to a 409 in the service**

In `server/src/services/form.service.js`, in `updateForm` replace the save + audit block (lines 69-75):

```javascript
  const before = toPlain(form.data);
  form.data = merged;
  await form.save();
  await diffAndAudit({
    before, after: merged, actor, collection: 'FormInstance', docId: form._id, reason, action: 'update', prefix: 'data',
  });
  return form;
```

with:

```javascript
  const before = toPlain(form.data);
  form.data = merged;
  await saveWithConcurrencyGuard(form);
  await diffAndAudit({
    before, after: merged, actor, collection: 'FormInstance', docId: form._id, reason, action: 'update', prefix: 'data',
  });
  return form;
```

In `amendForm`, replace line 109 `await form.save();` with:

```javascript
  await saveWithConcurrencyGuard(form);
```

Then add this helper in the `// --- helpers / typed errors ---` section (after `toPlain`, around line 138):

```javascript
async function saveWithConcurrencyGuard(doc) {
  try {
    await doc.save();
  } catch (err) {
    if (err && err.name === 'VersionError') {
      const e = new Error('The record was modified concurrently; reload and retry');
      e.status = 409; e.code = 'version_conflict'; throw e;
    }
    throw err;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/form.test.js`
Expected: PASS — OQ-FORM-07 green and OQ-FORM-01..06 (including the normal update OQ-FORM-04) still green.

- [ ] **Step 6: Run the signature suite too (sign() also saves the form)**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/signature.test.js`
Expected: PASS — confirms enabling optimistic concurrency did not regress signing/locking.

- [ ] **Step 7: Commit**

```bash
git add server/src/models/formInstance.model.js server/src/services/form.service.js oq/api/form.test.js
git commit -m "fix(form): guard form updates with optimistic concurrency (no silent lost update)"
```

---

## Task 6: Deterministic export ordering (finding E2)

**Files:**
- Modify: `server/src/services/export.service.js:23-25`
- Test: `oq/api/export.test.js` (append OQ-EXP-05)

- [ ] **Step 1: Write the failing test**

Append inside the `describe('Dataset export with integrity checksum', ...)` block in `oq/api/export.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails (or is non-deterministic)**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/export.test.js -t "OQ-EXP-05"`
Expected: FAIL — rows are returned in unsorted natural order, so `ids` is not equal to its sorted copy.

- [ ] **Step 3: Sort every export query by `_id`**

In `server/src/services/export.service.js`, replace lines 23-25:

```javascript
  const subjects = await Subject.find({}).lean();
  const forms = await FormInstance.find({}).lean();
  const signatures = await Signature.find({}).lean();
```

with:

```javascript
  // Deterministic order (by _id) so identical data always serializes to identical
  // bytes — the checksum manifest is only meaningful if the export is reproducible.
  const subjects = await Subject.find({}).sort({ _id: 1 }).lean();
  const forms = await FormInstance.find({}).sort({ _id: 1 }).lean();
  const signatures = await Signature.find({}).sort({ _id: 1 }).lean();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/export.test.js`
Expected: PASS — OQ-EXP-05 green and OQ-EXP-01..04 still green.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/export.service.js oq/api/export.test.js
git commit -m "fix(export): sort export queries by _id for reproducible checksums"
```

---

## Task 7: Fail closed on default secrets in production (finding A3)

**Files:**
- Modify: `server/src/config.js:14-52`
- Modify: `server/src/index.js:12-16`
- Test: `oq/api/config.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `oq/api/config.test.js`:

```javascript
'use strict';

const path = require('path');
const { SERVER_SRC } = require('../setup/testServer');
const config = require(path.join(SERVER_SRC, 'config'));

/**
 * OQ — Configuration fail-closed guard (21 CFR 11.10(d)/(g)): the app must refuse
 * to start in production with the well-known development secrets.
 */
describe('Config secret guard', () => {
  test('OQ-CFG-01: refuses to start in production with default secrets', () => {
    expect(() => config.assertSecretsConfigured({ nodeEnv: 'production' })).toThrow(/default secret/i);
  });

  test('OQ-CFG-02: allows default secrets outside production (dev/test/OQ)', () => {
    expect(() => config.assertSecretsConfigured({ nodeEnv: 'test' })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/config.test.js`
Expected: FAIL — `config.assertSecretsConfigured` is not a function yet.

- [ ] **Step 3: Add named defaults + the guard to config.js**

In `server/src/config.js`, replace the two secret lines (16 and 20) so the defaults are named constants. Change:

```javascript
  // JWT signing secret for session tokens.
  jwtSecret: process.env.JWT_SECRET || 'dev-only-jwt-secret-change-me',

  // Server-side pepper mixed into every electronic-signature content hash.
  // Kept server-side so a signature cannot be forged from record content alone.
  signaturePepper: process.env.SIGNATURE_PEPPER || 'dev-only-signature-pepper-change-me',
```

to:

```javascript
  // JWT signing secret for session tokens.
  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,

  // Server-side pepper mixed into every electronic-signature content hash.
  // Kept server-side so a signature cannot be forged from record content alone.
  signaturePepper: process.env.SIGNATURE_PEPPER || DEFAULT_SIGNATURE_PEPPER,
```

Then, immediately above the `const config = {` line (line 14), add the constants:

```javascript
const DEFAULT_JWT_SECRET = 'dev-only-jwt-secret-change-me';
const DEFAULT_SIGNATURE_PEPPER = 'dev-only-signature-pepper-change-me';

```

Finally, replace the bottom of the file (line 52 `module.exports = config;`) with:

```javascript
/**
 * Fail closed: refuse to boot a production deployment that is still using the
 * well-known development secrets. Called from the production entrypoint (index.js).
 * The OQ harness runs with NODE_ENV=test and is unaffected.
 * @param {{nodeEnv?: string}} [opts]
 */
function assertSecretsConfigured({ nodeEnv = process.env.NODE_ENV } = {}) {
  if (nodeEnv !== 'production') return;
  const problems = [];
  if (config.jwtSecret === DEFAULT_JWT_SECRET) problems.push('JWT_SECRET');
  if (config.signaturePepper === DEFAULT_SIGNATURE_PEPPER) problems.push('SIGNATURE_PEPPER');
  if (problems.length) {
    throw new Error(`Refusing to start in production with default secret(s): ${problems.join(', ')}. Set them via environment.`);
  }
}

config.assertSecretsConfigured = assertSecretsConfigured;

module.exports = config;
```

- [ ] **Step 4: Call the guard at startup**

In `server/src/index.js`, in `main()` add the guard right after reading the URI. Change lines 13-15:

```javascript
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is required');
  await connect(uri);
```

to:

```javascript
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is required');
  config.assertSecretsConfigured();
  await connect(uri);
```

(`config` is already required at the top of `index.js`.)

- [ ] **Step 5: Run the test to verify it passes**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/config.test.js`
Expected: PASS — OQ-CFG-01 and OQ-CFG-02 green.

- [ ] **Step 6: Sanity-check nothing else broke (the auth suite reads config.jwtSecret)**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/auth.test.js`
Expected: PASS — the default secret is unchanged in value, only refactored into a constant.

- [ ] **Step 7: Commit**

```bash
git add server/src/config.js server/src/index.js oq/api/config.test.js
git commit -m "fix(config): fail closed when production still uses default JWT/signature secrets"
```

---

## Task 8: Make vitals entry reachable — visits endpoint + client wiring (finding C6)

**Files:**
- Modify: `server/src/routes/subject.routes.js:3-31`
- Modify: `client/src/api.js:28-41`
- Modify: `client/src/Dashboard.jsx:12-33,106-116`
- Test: `oq/api/form.test.js` (append OQ-FORM-08)

- [ ] **Step 1: Write the failing test (server endpoint)**

Append inside the `describe('Subject enrolment and form data entry', ...)` block in `oq/api/form.test.js`:

```javascript
  test('OQ-FORM-08: a subject exposes its study visit schedule (enables form entry)', async () => {
    const res = await ctx.agent.get(`/subjects/${fx.subject._id}/visits`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].studyId).toBe(String(fx.study._id));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/form.test.js -t "OQ-FORM-08"`
Expected: FAIL — `GET /subjects/:id/visits` is unrouted, so the 404 handler returns 404.

- [ ] **Step 3: Add the visits route**

In `server/src/routes/subject.routes.js`, add the `Visit` model require after line 4 (`const Subject = require('../models/subject.model');`):

```javascript
const Visit = require('../models/visit.model');
```

Then add this route just before `module.exports = router;` (after line 29):

```javascript
// The visit schedule for a subject's study. The data-entry UI needs a visit id to
// create a form; without this endpoint the entry form has no visit to attach to.
router.get('/:id/visits', authenticate, requirePermission('read', 'subject'), async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: 'not_found' });
    const visits = await Visit.find({ studyId: subject.studyId }).sort({ order: 1 });
    res.json(visits);
  } catch (e) { next(e); }
});
```

- [ ] **Step 4: Run the server test to verify it passes**

Run (cwd `oq/`): `npx jest --config jest.config.js --runInBand api/form.test.js -t "OQ-FORM-08"`
Expected: PASS.

- [ ] **Step 5: Add the client API method**

In `client/src/api.js`, add a `listVisits` method to the `api` object, right after the `enrolSubject` line (line 29):

```javascript
  listVisits: (subjectId) => request('GET', `/subjects/${subjectId}/visits`),
```

- [ ] **Step 6: Fetch visits and gate the vitals form on a real visit id**

In `client/src/Dashboard.jsx`:

(a) Add a `visits` state next to the others. After line 16 (`const [forms, setForms] = useState([]);`) add:

```javascript
  const [visits, setVisits] = useState([]);
```

(b) Add a loader and load it when a subject is selected. After the `loadForms` definition (line 30) add:

```javascript
  const loadVisits = useCallback(async (subjectId) => {
    try { setVisits(await api.listVisits(subjectId)); } catch (e) { setMessage(e.message); }
  }, []);
```

and change the selection effect (line 33) from:

```javascript
  useEffect(() => { if (selected) loadForms(selected._id); }, [selected, loadForms]);
```

to:

```javascript
  useEffect(() => {
    if (!selected) return;
    loadForms(selected._id);
    loadVisits(selected._id);
  }, [selected, loadForms, loadVisits]);
```

(c) Replace the vitals-entry block (lines 106-116) with a version gated on an actual visit:

```javascript
          {canWriteForm && visits.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4>Enter vital signs</h4>
              <VitalsForm
                subjectId={selected._id}
                visitId={visits[0]._id}
                onCreated={() => loadForms(selected._id)}
              />
            </div>
          )}
```

- [ ] **Step 7: Verify the client end-to-end via the existing UI OQ**

Start the seeded API and client dev server per `oq/ui/ecrf.spec.js` header, then run:
`npm --prefix oq run oq:ui`
Expected: OQ-UI-03 and OQ-UI-04 PASS — the vitals form now renders after "Open", so the tests can fill `#systolic`/etc. (These tests fail before this fix because the form never rendered.)

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/subject.routes.js client/src/api.js client/src/Dashboard.jsx oq/api/form.test.js
git commit -m "fix(ecrf): expose study visits and wire vitals entry to a real visit id"
```

---

## Task 9: Blank vitals fields must not be sent as 0 (finding C3)

**Files:**
- Modify: `client/src/VitalsForm.jsx:22-26`
- Test: `oq/ui/ecrf.spec.js` (append OQ-UI-05)

- [ ] **Step 1: Write the failing test (Playwright)**

Append to `oq/ui/ecrf.spec.js`:

```javascript
test('OQ-UI-05: a blank vital field is reported as required, not silently sent as 0', async ({ page }) => {
  await login(page, 'investigator', PASSWORD);
  await page.click('text=Open');
  await page.fill('#systolic', '120');
  await page.fill('#diastolic', '80');
  // Leave heartRate blank on purpose.
  await page.click('text=Save vital signs');
  await expect(page.locator('.field-error')).toContainText(/heart rate is required/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Start the seeded API + client dev server, then (cwd `oq/`): `npm run oq:ui -- -g "OQ-UI-05"`
Expected: FAIL — `Number('')` sends `heartRate: 0`, which fails the *range* check ("between 20 and 250"), so the `required` message never appears.

- [ ] **Step 3: Omit blank fields instead of coercing to 0**

In `client/src/VitalsForm.jsx`, replace the data construction in `submit` (lines 22-26):

```javascript
      const data = {
        systolic: Number(values.systolic),
        diastolic: Number(values.diastolic),
        heartRate: Number(values.heartRate),
      };
```

with:

```javascript
      // A blank field must stay ABSENT (so the server reports it as required),
      // never Number('') === 0 which would be a real, wrong measurement.
      const toNum = (v) => (v === '' ? undefined : Number(v));
      const data = {
        systolic: toNum(values.systolic),
        diastolic: toNum(values.diastolic),
        heartRate: toNum(values.heartRate),
      };
```

(JSON.stringify drops `undefined` keys, so the server sees the field as missing and returns the `required` violation.)

- [ ] **Step 4: Run to verify it passes**

Start the seeded API + client dev server, then (cwd `oq/`): `npm run oq:ui -- -g "OQ-UI-05"`
Expected: PASS — the inline error now reads "Heart rate is required". Also re-run OQ-UI-03/04 to confirm no regression: `npm run oq:ui`.

- [ ] **Step 5: Commit**

```bash
git add client/src/VitalsForm.jsx oq/ui/ecrf.spec.js
git commit -m "fix(client): omit blank vitals fields instead of submitting 0"
```

---

## Task 10: Race-safe form loading when switching subjects (finding C1)

**Files:**
- Modify: `client/src/Dashboard.jsx:1,28-30`

This is a client-only race with no unit-test harness (Jest `roots` is `oq/api` only, and the race is timing-dependent). Fix it with a monotonic request token and verify by code review plus a non-regression run of the UI OQ.

- [ ] **Step 1: Import `useRef`**

In `client/src/Dashboard.jsx`, change the React import (line 1):

```javascript
import React, { useEffect, useState, useCallback } from 'react';
```

to:

```javascript
import React, { useEffect, useState, useCallback, useRef } from 'react';
```

- [ ] **Step 2: Make `loadForms` ignore stale responses**

Replace the `loadForms` definition (lines 28-30):

```javascript
  const loadForms = useCallback(async (subjectId) => {
    try { setForms(await api.listForms(subjectId)); } catch (e) { setMessage(e.message); }
  }, []);
```

with:

```javascript
  const formsReqSeq = useRef(0);
  const loadForms = useCallback(async (subjectId) => {
    const seq = formsReqSeq.current + 1;
    formsReqSeq.current = seq;
    try {
      const data = await api.listForms(subjectId);
      if (seq === formsReqSeq.current) setForms(data); // ignore out-of-order responses
    } catch (e) {
      if (seq === formsReqSeq.current) setMessage(e.message);
    }
  }, []);
```

- [ ] **Step 3: Verify by review and a non-regression UI run**

Confirm: rapidly selecting subject A then B issues two `loadForms` calls; only the response whose `seq` still equals `formsReqSeq.current` (the latest, B) is applied. A late-arriving A response is dropped.

Start the seeded API + client dev server, then (cwd `oq/`): `npm run oq:ui`
Expected: PASS — OQ-UI-01..05 still green (the guard does not change single-subject behavior).

- [ ] **Step 4: Commit**

```bash
git add client/src/Dashboard.jsx
git commit -m "fix(client): ignore out-of-order form fetches when switching subjects"
```

---

## Final verification

- [ ] **Run the entire API OQ suite**

Run (cwd `oq/`): `npm run oq:api`
Expected: all API suites PASS (auth, signature, editChecks, query, form, export, config, plus the untouched rbac/amendment/audit.integrity/models/softDelete suites).

- [ ] **Run the UI OQ suite** (seeded API + client dev server running)

Run (cwd `oq/`): `npm run oq:ui`
Expected: OQ-UI-01..05 PASS.

- [ ] **Refresh committed evidence if the project tracks it**

The `evidence/` directory holds committed OQ output (`audit-trail-latest.json`, `oq-results-latest.json`). If these are meant to reflect the latest run, regenerate and commit them:

```bash
git add evidence/
git commit -m "chore(evidence): refresh OQ evidence after bug-fix suite"
```

---

## Self-Review notes (already applied)

- **Coverage:** every one of the 10 findings maps to a task — S1→T1, A1→T2, D2/D6→T3, D1→T4, D4→T5, E2→T6, A3→T7, C6→T8, C3→T9, C1→T10.
- **No new-secret regressions:** Task 7 keeps the default secret *value* identical (only names it), so `auth.test.js` (which verifies tokens with `config.jwtSecret`) is unaffected.
- **State-machine change is compatible:** Task 4's stricter close is safe because the only existing close test (OQ-QRY-02) answers the query first.
- **Optimistic concurrency is compatible:** Task 5 leaves single-writer paths (create/update/amend/sign) working; only genuinely stale saves now throw. The signature suite is re-run in T5 Step 6 to confirm.
- **Ordering dependency:** Task 8 (visits) must precede the Task 9/10 UI runs, since the vitals form only renders once visits load.
- **Type consistency:** service error codes used in tests (`already_signed`, `reauth_failed`, `invalid_transition`, `version_conflict`, `numeric`) match the strings thrown in the corresponding service/validation code.
