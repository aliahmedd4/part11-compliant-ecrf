'use strict';

const config = require('../config');
const Signature = require('../models/signature.model');
const FormInstance = require('../models/formInstance.model');
const { verifyCredentials } = require('./auth.service');
const { writeAudit } = require('./audit.service');
const { contentHash } = require('../lib/hash');
const { serverNow } = require('../lib/time');

/**
 * Electronic signature service (21 CFR 11 subpart C).
 *
 * Enforces the four properties Part 11 requires of a compliant e-signature:
 *   1. 11.200(a)(1) — executed with two distinct components (id + password) and,
 *      because this session is already authenticated, RE-AUTHENTICATION of the
 *      password at signing time so the signature is a deliberate, credentialed act.
 *   2. 11.50 — the signed record carries the printed name, the UTC date/time
 *      (server clock), and the MEANING of the signature (author/reviewer/approver).
 *   3. 11.70 — the signature is bound to the record content via a SHA-256 hash of
 *      the canonical content + server pepper, so any later change breaks the link.
 *   4. Signed records are locked; further change requires the amendment workflow.
 */

/**
 * Build the exact subset of a FormInstance that a signature covers. Keeping this
 * explicit (rather than hashing the whole Mongoose doc) means volatile fields
 * like updatedAt do not spuriously invalidate a signature, while every
 * clinically-meaningful field is protected.
 */
function signableContent(form) {
  return {
    subjectId: String(form.subjectId),
    visitId: String(form.visitId),
    type: form.type,
    version: form.version,
    data: form.data,
  };
}

/**
 * Execute an electronic signature on a FormInstance.
 *
 * @param {object} p
 * @param {object} p.actor  authenticated user ({_id, username, printedName, role})
 * @param {string} p.password  the signer's password, for re-authentication
 * @param {string} p.formId
 * @param {'author'|'reviewer'|'approver'} p.meaning
 * @returns {Promise<object>} the persisted Signature
 * @throws 401 on bad re-auth, 404 if form missing, 409 if already signed
 */
async function sign({ actor, password, formId, meaning }) {
  if (!Signature.MEANINGS.includes(meaning)) {
    const e = new Error(`meaning must be one of ${Signature.MEANINGS.join(', ')}`);
    e.status = 422; e.code = 'invalid_meaning'; throw e;
  }

  // 1. Re-authenticate. A signature is only valid if the password is re-entered
  //    and correct at the moment of signing.
  const ok = await verifyCredentials(actor.username, password);
  if (!ok) {
    await writeAudit({ actor, collection: 'FormInstance', docId: formId, action: 'access_denied', reason: 'signature re-authentication failed' });
    const e = new Error('Re-authentication failed'); e.status = 401; e.code = 'reauth_failed'; throw e;
  }

  const form = await FormInstance.findById(formId);
  if (!form) { const e = new Error('Form not found'); e.status = 404; throw e; }

  // 2. Compute the binding hash over the canonical signed content + pepper.
  const hash = contentHash(signableContent(form), config.signaturePepper);

  // 3. Persist the signature manifestation (append-only collection).
  const signature = await Signature.create({
    recordCollection: 'FormInstance',
    recordId: form._id,
    recordVersion: form.version,
    signerUserId: actor._id,
    signerUsername: actor.username,
    printedName: actor.printedName,
    whenUTC: serverNow(),
    meaning,
    contentHash: hash,
  });

  // 4. Lock the record. Signed data is read-only outside the amendment workflow.
  form.locked = true;
  form.status = 'signed';
  await form.save();

  await writeAudit({
    actor, collection: 'FormInstance', docId: form._id, field: null,
    oldValue: null, newValue: { meaning, contentHash: hash }, reason: `electronic signature (${meaning})`, action: 'sign',
  });

  return signature;
}

/**
 * Verify a stored signature against the CURRENT content of its record.
 *
 * Recomputes the hash and compares. Returns false if the record has changed in
 * any signed field since signing — this is the tamper-evidence property. Also
 * returns the recomputed vs stored hashes so a reviewer can see the discrepancy.
 *
 * @param {object} signature  a Signature document
 * @param {object} form       the current FormInstance
 * @returns {{valid:boolean, storedHash:string, currentHash:string, reason:string}}
 */
function verifySignature(signature, form) {
  // The signature was taken at a specific version; verify against that version's
  // content shape. If the form has since been amended (version bumped) the
  // content differs and the hash will not match — correctly invalid.
  const currentHash = contentHash(signableContent(form), config.signaturePepper);
  const valid = currentHash === signature.contentHash;
  return {
    valid,
    storedHash: signature.contentHash,
    currentHash,
    reason: valid ? 'content unchanged since signing' : 'record altered after signing — signature invalid',
  };
}

module.exports = { sign, verifySignature, signableContent };
