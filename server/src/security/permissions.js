'use strict';

/**
 * ROLE-BASED ACCESS CONTROL MATRIX — the single source of truth for authority
 * checks (21 CFR 11.10(d) "limit system access to authorized individuals" and
 * 11.10(g) "use of authority checks to ensure only authorized individuals can
 * use the system, ... alter a record, or perform the operation at hand").
 *
 * REGULATORY REASONING:
 * Part 11 authority checks must be enforced by the system, not merely implied by
 * a hidden menu item. Hiding a button in the UI is cosmetic — a user can still
 * call the API directly. Therefore this matrix is consulted by server-side
 * middleware on every protected route, and the OQ suite proves enforcement by
 * attacking the API directly (privilege-escalation tests).
 *
 * Permission keys are "action:resource". '*:*' grants everything (Administrator).
 *
 * Role intent:
 *   Investigator  — site staff: enrol subjects, enter/sign form data, respond to
 *                   queries about their data.
 *   DataManager   — central data management: review data, raise & close queries,
 *                   export datasets, and sign as reviewer.
 *   Monitor       — oversight (e.g. CRA): READ ONLY access plus the ability to
 *                   raise queries. Explicitly cannot enter or alter clinical data.
 *   Administrator — system administration: user management + everything.
 */
const MATRIX = {
  Administrator: {
    '*:*': true,
  },
  Investigator: {
    'read:subject': true,
    'write:subject': true,
    'read:form': true,
    'write:form': true,
    'sign:form': true,
    'respond:query': true,
    'read:query': true,
  },
  DataManager: {
    'read:subject': true,
    'read:form': true,
    'write:form': true,
    'sign:form': true,
    'read:query': true,
    'raise:query': true,
    'close:query': true,
    'export:dataset': true,
    'read:audit': true,
  },
  Monitor: {
    'read:subject': true,
    'read:form': true,
    'read:query': true,
    'raise:query': true,
    'read:audit': true,
  },
};

/**
 * Authority check.
 * @param {string} role   one of the four roles
 * @param {string} action e.g. 'write'
 * @param {string} resource e.g. 'form'
 * @returns {boolean} whether the role may perform action on resource
 */
function can(role, action, resource) {
  const grants = MATRIX[role];
  if (!grants) return false;
  if (grants['*:*']) return true;
  return grants[`${action}:${resource}`] === true;
}

module.exports = { MATRIX, can };
