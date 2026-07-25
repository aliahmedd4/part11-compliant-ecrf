'use strict';

const mongoose = require('mongoose');
const appendOnlyPlugin = require('../plugins/appendOnly.plugin');

/**
 * AuditEvent — the immutable audit trail (21 CFR 11.10(e), ALCOA+).
 *
 * One document is written per changed field, capturing WHO, WHEN (server UTC),
 * WHAT record/field, the OLD and NEW values, the REASON for change, and the
 * ACTION. The collection is append-only (see appendOnly.plugin) so the trail
 * cannot be altered after the fact.
 *
 * Field ↔ ALCOA+ mapping:
 *   whoUserId / whoUsername   -> Attributable
 *   whenUTC (server clock)    -> Contemporaneous
 *   oldValue / newValue       -> Original & Accurate (before/after preserved)
 *   append-only storage       -> Enduring, Complete, Consistent, Available
 */
const auditEventSchema = new mongoose.Schema(
  {
    whoUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    whoUsername: { type: String, required: true },
    // The collection/model the change applies to, e.g. 'Subject', 'FormInstance'.
    // Named targetModel because `collection` is a reserved Mongoose schema path.
    targetModel: { type: String, required: true },
    docId: { type: mongoose.Schema.Types.ObjectId, required: false },
    // Dotted field path within the record, e.g. 'data.systolic'. Null for
    // whole-record actions like 'create' or 'sign'.
    field: { type: String, default: null },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, default: null },
    // create | update | soft_delete | sign | amend | login | login_failed |
    // account_locked | password_change | query_raise | query_respond |
    // query_close | export | access_denied
    action: { type: String, required: true },
    whenUTC: { type: Date, required: true },
  },
  {
    // We never want auto-managed timestamps here; whenUTC is set explicitly from
    // serverNow() so there is a single, testable time source.
    timestamps: false,
    // Deep-freeze the collection semantics via the plugin below.
    minimize: false,
  }
);

auditEventSchema.plugin(appendOnlyPlugin);

// Helpful index for reviewing a record's history in chronological order.
auditEventSchema.index({ targetModel: 1, docId: 1, whenUTC: 1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
