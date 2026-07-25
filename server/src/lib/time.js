'use strict';

/**
 * Single source of server time.
 *
 * REGULATORY REASONING (21 CFR 11.10(e), ALCOA+ "Contemporaneous"):
 * All timestamps written to records, audit entries and signatures MUST originate
 * from the server clock. A client-supplied time is untrustworthy — a user could
 * back-date a record to hide a late entry, defeating the "contemporaneous"
 * property of the audit trail. By routing every timestamp through serverNow(),
 * we guarantee one authoritative, non-repudiable time source and make it trivial
 * to prove (and test) that client-supplied timestamps are never persisted.
 *
 * Always returns UTC (JavaScript Date is epoch-based; serialize with toISOString).
 *
 * @returns {Date} current server time
 */
function serverNow() {
  return new Date();
}

module.exports = { serverNow };
