'use strict';

/**
 * Mongoose plugin enforcing an APPEND-ONLY collection.
 *
 * REGULATORY REASONING (21 CFR 11.10(e)):
 * The audit trail must be "secure, computer-generated, time-stamped" and must
 * record changes WITHOUT obscuring previously recorded information. In practice
 * that means audit records can only ever be inserted — never updated, never
 * deleted. If an audit row could be edited, the trail would be worthless as
 * evidence because tampering could not be excluded.
 *
 * This plugin makes that guarantee structural rather than merely a convention:
 * every Mongoose mutation/removal pathway throws. The only permitted operation is
 * inserting a brand-new document. The OQ suite proves each pathway is blocked.
 */
const BLOCKED_ERROR = () => new Error('AuditEvent is append-only: updates and deletes are prohibited');

// Query-level mutation/removal operations to block.
const BLOCKED_QUERY_OPS = [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'findOneAndRemove',
  'deleteOne',
  'deleteMany',
  'remove',
];

module.exports = function appendOnlyPlugin(schema) {
  // Block query-based mutations/deletes (e.g. Model.updateOne, Model.deleteMany,
  // doc.updateOne, Query#findOneAndUpdate...).
  for (const op of BLOCKED_QUERY_OPS) {
    schema.pre(op, function blockQueryMutation() {
      throw BLOCKED_ERROR();
    });
  }

  // Block re-saving an existing document (allow only the initial insert).
  schema.pre('save', function blockUpdateViaSave(next) {
    if (!this.isNew) {
      return next(BLOCKED_ERROR());
    }
    return next();
  });

  // Block document-level remove/deleteOne.
  schema.pre('deleteOne', { document: true, query: false }, function blockDocDelete(next) {
    return next(BLOCKED_ERROR());
  });

  // Block bulkWrite update/delete operations at the model level.
  schema.statics.bulkWrite = function blockedBulkWrite() {
    throw BLOCKED_ERROR();
  };
};
