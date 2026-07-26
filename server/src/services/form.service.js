'use strict';

const Subject = require('../models/subject.model');
const FormInstance = require('../models/formInstance.model');
const { checkForm } = require('../validation/editChecks');
const { writeAudit, diffAndAudit } = require('./audit.service');
const { serverNow } = require('../lib/time');

/**
 * Clinical data service — the ONLY writer of subjects and form data.
 *
 * Every mutation here (a) runs edit checks, (b) stamps server time, (c) records
 * the change in the audit trail, and (d) refuses to touch a signed/locked record
 * except through the explicit amendment workflow. Concentrating these rules in one
 * module is what lets us assert, and test, that "every data change is validated,
 * time-stamped by the server, and audited".
 */

/**
 * Enrol a subject. enrolledAtUTC is always the server clock, never client input.
 */
async function enrolSubject({ actor, studyId, subjectCode, status }) {
  const subject = await Subject.create({
    studyId,
    subjectCode,
    status: status || 'enrolled',
    enrolledAtUTC: serverNow(),
  });
  await writeAudit({
    actor, collection: 'Subject', docId: subject._id, field: null,
    oldValue: null, newValue: { subjectCode, status: subject.status }, reason: 'subject enrolment', action: 'create',
  });
  return subject;
}

/**
 * Create a form instance after edit checks pass.
 * @throws 422 with { errors } when edit checks fail (nothing is written)
 */
async function createForm({ actor, subjectId, visitId, type, data }) {
  const errors = checkForm(type, data);
  if (errors.length) throw editCheckError(errors);

  const form = await FormInstance.create({
    subjectId, visitId, type, data: data || {}, status: 'complete', version: 1,
  });
  await writeAudit({
    actor, collection: 'FormInstance', docId: form._id, field: null,
    oldValue: null, newValue: { type, data: form.data }, reason: 'form created', action: 'create',
  });
  return form;
}

/**
 * Update an UNSIGNED form. Requires a reason for change (Part 11 11.10(e)).
 * A signed/locked record is rejected here — it must go through amendForm().
 * @throws 409 if the record is locked; 422 on edit-check failure
 */
async function updateForm({ actor, formId, data, reason }) {
  const form = await FormInstance.findById(formId);
  if (!form) throw notFound();
  if (form.locked) throw lockedError();
  if (!reason) throw reasonRequired();

  const merged = { ...toPlain(form.data), ...data };
  const errors = checkForm(form.type, merged);
  if (errors.length) throw editCheckError(errors);

  const before = toPlain(form.data);
  form.data = merged;
  await form.save();
  await diffAndAudit({
    before, after: merged, actor, collection: 'FormInstance', docId: form._id, reason, action: 'update', prefix: 'data',
  });
  return form;
}

/**
 * AMENDMENT WORKFLOW — the only sanctioned way to change a signed record.
 *
 * REGULATORY REASONING (11.10(e), 11.70):
 * A signed record is a controlled record; it cannot simply be edited. An amendment
 * is a deliberate, reason-bearing act that: bumps the version, applies the change,
 * audits every field with the reason, and re-opens the record for a fresh
 * signature. Crucially we do NOT delete the prior signature — it stays on file and
 * now fails verification against the new content, which is the tamper-evidence the
 * regulation demands.
 *
 * @throws 409 if the record is not locked (use updateForm instead); 422 on checks
 */
async function amendForm({ actor, formId, data, reason }) {
  const form = await FormInstance.findById(formId);
  if (!form) throw notFound();
  if (!form.locked) {
    const e = new Error('Record is not signed; use a normal update'); e.status = 409; e.code = 'not_locked'; throw e;
  }
  if (!reason) throw reasonRequired();

  const merged = { ...toPlain(form.data), ...data };
  const errors = checkForm(form.type, merged);
  if (errors.length) throw editCheckError(errors);

  const before = toPlain(form.data);
  const oldVersion = form.version;
  form.data = merged;
  form.version = oldVersion + 1; // ties any prior signature to the superseded version
  form.locked = false; // re-opened; a new signature is required
  form.status = 'complete';
  await form.save();

  await diffAndAudit({
    before, after: merged, actor, collection: 'FormInstance', docId: form._id,
    reason: `amendment: ${reason}`, action: 'amend', prefix: 'data',
  });
  await writeAudit({
    actor, collection: 'FormInstance', docId: form._id, field: 'version',
    oldValue: oldVersion, newValue: form.version, reason: `amendment: ${reason}`, action: 'amend',
  });
  return form;
}

/** Soft-delete a form (records the deletion in the audit trail). */
async function deleteForm({ actor, formId, reason }) {
  const form = await FormInstance.findById(formId);
  if (!form) throw notFound();
  await form.softDelete({ byUserId: actor._id, reason });
  await writeAudit({
    actor, collection: 'FormInstance', docId: form._id, field: 'deleted.isDeleted',
    oldValue: false, newValue: true, reason: reason || 'soft delete', action: 'soft_delete',
  });
  return form;
}

// --- helpers / typed errors ---
function toPlain(v) {
  if (v && typeof v.toObject === 'function') return v.toObject();
  return { ...(v || {}) };
}
function editCheckError(errors) {
  const e = new Error('Edit checks failed'); e.status = 422; e.code = 'edit_check_failed'; e.errors = errors; return e;
}
function lockedError() {
  const e = new Error('Record is signed and locked; an amendment is required to change it'); e.status = 409; e.code = 'record_locked'; return e;
}
function reasonRequired() {
  const e = new Error('A reason for change is required'); e.status = 422; e.code = 'reason_required'; return e;
}
function notFound() {
  const e = new Error('Form not found'); e.status = 404; e.code = 'not_found'; return e;
}

module.exports = { enrolSubject, createForm, updateForm, amendForm, deleteForm };
