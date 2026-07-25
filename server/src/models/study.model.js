'use strict';

const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

/**
 * Study — the single clinical study this eCRF supports (scope is deliberately
 * one study). Holds identifying protocol metadata that subjects and forms hang
 * off of.
 */
const studySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    protocolId: { type: String, required: true },
    sponsor: { type: String, default: null },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
  },
  { timestamps: true }
);

studySchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Study', studySchema);
