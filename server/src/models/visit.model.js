'use strict';

const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

/**
 * Visit — an entry in the study's visit schedule (e.g. Screening, Baseline,
 * Week 4). Ordered so the eCRF can present the schedule deterministically.
 */
const visitSchema = new mongoose.Schema(
  {
    studyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Study', required: true, index: true },
    name: { type: String, required: true },
    order: { type: Number, required: true },
    // Which form types are expected at this visit.
    expectedForms: {
      type: [String],
      enum: ['demographics', 'vitals', 'adverse_event'],
      default: [],
    },
  },
  { timestamps: true }
);

visitSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Visit', visitSchema);
