'use strict';

const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

/**
 * Query — a data-clarification query raised against a form field, with its full
 * lifecycle history. Queries are how a Monitor or Data Manager flags a value for
 * the site to clarify; keeping the complete history satisfies the ALCOA+
 * "Complete" attribute for the query process itself.
 */
const historyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['raise', 'respond', 'close', 'reopen'], required: true },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    byUsername: { type: String, required: true },
    text: { type: String, default: null },
    whenUTC: { type: Date, required: true },
  },
  { _id: false }
);

const querySchema = new mongoose.Schema(
  {
    formInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormInstance', required: true, index: true },
    field: { type: String, required: true },
    status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open' },
    history: { type: [historyEntrySchema], default: [] },
  },
  { timestamps: true }
);

querySchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Query', querySchema);
