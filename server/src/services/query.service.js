'use strict';

const Query = require('../models/query.model');
const { writeAudit } = require('./audit.service');
const { serverNow } = require('../lib/time');

/**
 * Query (data-clarification) workflow service.
 *
 * A query moves through a small state machine: open -> answered -> closed
 * (with an optional reopen). Every transition appends to the query's own history
 * AND writes to the global audit trail, so the clarification process is itself
 * fully reconstructable (ALCOA+ Complete). Permissions are enforced at the route
 * layer via the RBAC matrix (raise/respond/close map to different roles).
 */

function historyEntry(action, actor, text) {
  return { action, byUserId: actor._id, byUsername: actor.username, text: text || null, whenUTC: serverNow() };
}

/** Raise a new query against a form field. */
async function raiseQuery({ actor, formInstanceId, field, text }) {
  if (!formInstanceId || !field) { const e = new Error('formInstanceId and field are required'); e.status = 400; throw e; }
  const query = await Query.create({
    formInstanceId,
    field,
    status: 'open',
    history: [historyEntry('raise', actor, text)],
  });
  await writeAudit({ actor, collection: 'Query', docId: query._id, field, oldValue: null, newValue: 'open', reason: text || 'query raised', action: 'query_raise' });
  return query;
}

/** Respond to an open query (site clarifies). */
async function respondQuery({ actor, queryId, text }) {
  const query = await Query.findById(queryId);
  if (!query) throw notFound();
  if (query.status === 'closed') throw invalidTransition('closed', 'respond');
  const prev = query.status;
  query.status = 'answered';
  query.history.push(historyEntry('respond', actor, text));
  await query.save();
  await writeAudit({ actor, collection: 'Query', docId: query._id, field: query.field, oldValue: prev, newValue: 'answered', reason: text || 'query answered', action: 'query_respond' });
  return query;
}

/** Close a query (resolution accepted). */
async function closeQuery({ actor, queryId, text }) {
  const query = await Query.findById(queryId);
  if (!query) throw notFound();
  if (query.status === 'closed') throw invalidTransition('closed', 'close');
  const prev = query.status;
  query.status = 'closed';
  query.history.push(historyEntry('close', actor, text));
  await query.save();
  await writeAudit({ actor, collection: 'Query', docId: query._id, field: query.field, oldValue: prev, newValue: 'closed', reason: text || 'query closed', action: 'query_close' });
  return query;
}

function notFound() { const e = new Error('Query not found'); e.status = 404; e.code = 'not_found'; return e; }
function invalidTransition(from, action) { const e = new Error(`Cannot ${action} a query in state '${from}'`); e.status = 409; e.code = 'invalid_transition'; return e; }

module.exports = { raiseQuery, respondQuery, closeQuery };
