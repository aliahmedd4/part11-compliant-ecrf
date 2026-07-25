'use strict';

const AuditEvent = require('../models/auditEvent.model');
const { serverNow } = require('../lib/time');

/**
 * Audit service — the ONLY sanctioned way to write the audit trail.
 *
 * Centralising audit writes here means the timestamp always comes from
 * serverNow() and every mutation elsewhere in the system funnels through a single
 * choke point, which is what makes "every data change is audited" auditable.
 */

/**
 * Write a single audit event.
 *
 * @param {object} p
 * @param {{_id?: any, username: string}} p.actor  who performed the action
 * @param {string} p.collection  model name the change applies to
 * @param {any} [p.docId]        id of the affected record
 * @param {string|null} [p.field] dotted field path, or null for whole-record acts
 * @param {any} [p.oldValue]
 * @param {any} [p.newValue]
 * @param {string|null} [p.reason]
 * @param {string} p.action      one of the documented action verbs
 * @returns {Promise<object>} the persisted AuditEvent
 */
async function writeAudit({ actor, collection, docId, field = null, oldValue = null, newValue = null, reason = null, action }) {
  if (!actor || !actor.username) throw new Error('writeAudit: actor with username is required');
  if (!collection) throw new Error('writeAudit: collection is required');
  if (!action) throw new Error('writeAudit: action is required');

  return AuditEvent.create({
    whoUserId: actor._id,
    whoUsername: actor.username,
    targetModel: collection,
    docId,
    field,
    oldValue,
    newValue,
    reason,
    action,
    whenUTC: serverNow(), // server clock only — never client-supplied
  });
}

/**
 * Compare two plain objects and write one audit event per changed leaf field.
 * Used by the service layer on every record update.
 *
 * @param {object} p
 * @param {object} p.before  record state before the change (plain values map)
 * @param {object} p.after   record state after the change
 * @param {{_id?: any, username: string}} p.actor
 * @param {string} p.collection
 * @param {any} p.docId
 * @param {string} p.reason   required for updates (Part 11 "reason for change")
 * @param {string} [p.action] defaults to 'update'
 * @param {string} [p.prefix] dotted prefix for nested diffs (e.g. 'data')
 * @returns {Promise<object[]>} the persisted AuditEvents (may be empty)
 */
async function diffAndAudit({ before, after, actor, collection, docId, reason, action = 'update', prefix = '' }) {
  const events = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of keys) {
    const oldV = before ? before[key] : undefined;
    const newV = after ? after[key] : undefined;
    if (serialize(oldV) === serialize(newV)) continue; // unchanged
    const field = prefix ? `${prefix}.${key}` : key;
    // eslint-disable-next-line no-await-in-loop
    const ev = await writeAudit({
      actor,
      collection,
      docId,
      field,
      oldValue: oldV === undefined ? null : oldV,
      newValue: newV === undefined ? null : newV,
      reason,
      action,
    });
    events.push(ev);
  }
  return events;
}

// Stable comparison for mixed values (handles Date, numbers, nested objects).
function serialize(v) {
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v === undefined ? null : v);
}

module.exports = { writeAudit, diffAndAudit };
