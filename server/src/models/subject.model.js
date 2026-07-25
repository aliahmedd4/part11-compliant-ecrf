'use strict';

const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

/**
 * Subject — an enrolled study participant, identified by a study-unique code
 * (never by directly identifying data, supporting privacy). enrolledAtUTC is
 * always set from the server clock at enrolment.
 */
const subjectSchema = new mongoose.Schema(
  {
    studyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Study', required: true, index: true },
    subjectCode: { type: String, required: true },
    status: {
      type: String,
      enum: ['screening', 'enrolled', 'withdrawn', 'completed'],
      default: 'enrolled',
    },
    enrolledAtUTC: { type: Date, required: true },
  },
  { timestamps: true }
);

subjectSchema.index({ studyId: 1, subjectCode: 1 }, { unique: true });
subjectSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Subject', subjectSchema);
