'use strict';

const { can } = require('./permissions');
const { writeAudit } = require('../services/audit.service');

/**
 * Express middleware factory enforcing an authority check (11.10(g)).
 *
 * Placed AFTER `authenticate`, it reads the authenticated user's role (which was
 * re-read from the database, never trusted from the token) and consults the
 * permission matrix. A denied request is both blocked (403) AND recorded in the
 * audit trail as an 'access_denied' event, because attempted unauthorized access
 * is itself security-relevant information a reviewer must be able to see.
 *
 * @param {string} action e.g. 'write'
 * @param {string} resource e.g. 'form'
 */
function requirePermission(action, resource) {
  return async function permissionGate(req, res, next) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    if (can(user.role, action, resource)) {
      return next();
    }
    // Denied — log the attempt then reject.
    try {
      await writeAudit({
        actor: { _id: user._id, username: user.username },
        collection: resource,
        docId: undefined,
        field: null,
        oldValue: null,
        newValue: `${action}:${resource}`,
        reason: `Access denied for role ${user.role}`,
        action: 'access_denied',
      });
    } catch (_e) {
      // Never let audit failure mask the authorization decision.
    }
    return res.status(403).json({ error: 'forbidden', required: `${action}:${resource}`, role: user.role });
  };
}

module.exports = { requirePermission };
