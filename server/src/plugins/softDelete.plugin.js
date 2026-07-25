'use strict';

const { serverNow } = require('../lib/time');

/**
 * Mongoose plugin: SOFT DELETE ONLY.
 *
 * REGULATORY REASONING (ALCOA+ "Enduring/Complete", 21 CFR 11.10(c)&(e)):
 * Regulated records must be protected and retained for their full lifecycle. A
 * hard delete destroys the record and its history, which is unacceptable — you
 * could never reconstruct the study data or prove what happened. Instead, a
 * "delete" is a state change (deleted.isDeleted = true) that is itself recorded
 * in the audit trail, so the record endures and the deletion is attributable and
 * reversible for review.
 *
 * This plugin:
 *   1. adds the `deleted` sub-document to every model that uses it;
 *   2. removes the hard-delete pathways (they throw);
 *   3. adds a `softDelete()` document method;
 *   4. filters out soft-deleted docs from ordinary reads unless the caller
 *      explicitly opts in with `.setOptions({ includeDeleted: true })`.
 */
const HARD_DELETE_ERROR = () => new Error('Hard deletes are prohibited: use softDelete() instead');

const BLOCKED_QUERY_OPS = ['deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndRemove', 'remove'];

module.exports = function softDeletePlugin(schema) {
  schema.add({
    deleted: {
      isDeleted: { type: Boolean, default: false, index: true },
      atUTC: { type: Date, default: null },
      byUserId: { type: require('mongoose').Schema.Types.ObjectId, ref: 'User', default: null },
      reason: { type: String, default: null },
    },
  });

  // 2. Block hard-delete query operations.
  for (const op of BLOCKED_QUERY_OPS) {
    schema.pre(op, function blockHardDelete() {
      throw HARD_DELETE_ERROR();
    });
  }
  // Block document-level deleteOne/remove.
  schema.pre('deleteOne', { document: true, query: false }, function blockDocHardDelete(next) {
    return next(HARD_DELETE_ERROR());
  });

  // 3. Soft delete method. The audit entry is written by the calling service so
  // the actor and reason are captured consistently; here we only mutate state.
  schema.methods.softDelete = async function softDelete({ byUserId, reason }) {
    this.deleted = { isDeleted: true, atUTC: serverNow(), byUserId, reason: reason || null };
    return this.save();
  };

  // 4. Exclude soft-deleted documents from ordinary reads unless opted in.
  const READ_HOOKS = ['find', 'findOne', 'countDocuments', 'count', 'findOneAndUpdate'];
  for (const hook of READ_HOOKS) {
    schema.pre(hook, function excludeSoftDeleted() {
      if (this.getOptions && this.getOptions().includeDeleted) return;
      const filter = this.getFilter ? this.getFilter() : this._conditions;
      // Only inject if the caller hasn't already constrained deleted.isDeleted.
      if (filter && Object.prototype.hasOwnProperty.call(filter, 'deleted.isDeleted')) return;
      this.where({ 'deleted.isDeleted': false });
    });
  }
};
