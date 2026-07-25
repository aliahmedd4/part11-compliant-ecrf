'use strict';

const mongoose = require('mongoose');
const appendOnlyPlugin = require('../plugins/appendOnly.plugin');

/**
 * Signature — an executed electronic signature (21 CFR 11 subpart C).
 *
 * A signature is a permanent, non-repudiable event, so this collection is also
 * append-only: signatures are never edited or deleted. If a signed record is
 * later amended, we do NOT remove the old signature — it remains on file and
 * simply fails verification against the new content, which is exactly the
 * tamper-evidence Part 11 requires.
 *
 * Fields:
 *   printedName  -> 11.50(a)(1) printed name of the signer
 *   whenUTC      -> 11.50(a)(2) date and time (server clock)
 *   meaning      -> 11.50(a)(3) meaning associated with the signature
 *   contentHash  -> 11.70 signature/record linking: SHA-256 over the canonical
 *                   serialization of the signed content + a server pepper, so any
 *                   later change to the record invalidates the signature.
 */
const MEANINGS = ['author', 'reviewer', 'approver'];

const signatureSchema = new mongoose.Schema(
  {
    recordCollection: { type: String, required: true }, // e.g. 'FormInstance'
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    // The record version that was signed, so verification uses the right content.
    recordVersion: { type: Number, required: true },
    signerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    signerUsername: { type: String, required: true },
    printedName: { type: String, required: true },
    whenUTC: { type: Date, required: true },
    meaning: { type: String, enum: MEANINGS, required: true },
    contentHash: { type: String, required: true },
  },
  { timestamps: false }
);

signatureSchema.plugin(appendOnlyPlugin);
signatureSchema.statics.MEANINGS = MEANINGS;

module.exports = mongoose.model('Signature', signatureSchema);
module.exports.MEANINGS = MEANINGS;
