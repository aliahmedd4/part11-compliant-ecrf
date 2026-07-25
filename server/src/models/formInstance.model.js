'use strict';

const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

/**
 * FormInstance — one completed form (CRF page) for a subject at a visit.
 *
 * `data` is a free-form map validated by the edit-check engine according to
 * `type`. `locked` becomes true once the record is electronically signed, after
 * which it is read-only and can only change through the amendment workflow, which
 * bumps `version`. This is the record whose content is cryptographically bound by
 * an electronic signature (21 CFR 11.70).
 */
const FORM_TYPES = ['demographics', 'vitals', 'adverse_event'];

const formInstanceSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true },
    type: { type: String, enum: FORM_TYPES, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['draft', 'complete', 'signed'], default: 'draft' },
    // Set true on signing; guards against edits outside the amendment workflow.
    locked: { type: Boolean, default: false },
    // Incremented by each amendment so a signature can be tied to a specific
    // version of the content.
    version: { type: Number, default: 1 },
  },
  { timestamps: true, minimize: false }
);

formInstanceSchema.plugin(softDeletePlugin);

formInstanceSchema.statics.FORM_TYPES = FORM_TYPES;

module.exports = mongoose.model('FormInstance', formInstanceSchema);
module.exports.FORM_TYPES = FORM_TYPES;
