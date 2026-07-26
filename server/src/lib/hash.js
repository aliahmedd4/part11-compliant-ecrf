'use strict';

const crypto = require('crypto');
const { canonicalJson } = require('./canonicalJson');

/**
 * Compute the content hash that binds an electronic signature to a record
 * (21 CFR 11.70).
 *
 * hash = SHA-256( canonicalJson(signedContent) + serverPepper )
 *
 * The server-side pepper is mixed in so that a signature cannot be forged or
 * independently recomputed by a party who only knows the record content — it also
 * requires the server secret. (Trade-off documented in DS-001: this strengthens
 * non-repudiation at the cost of the hash not being verifiable from content
 * alone; verification therefore always runs server-side.)
 *
 * @param {object} signedContent the exact fields covered by the signature
 * @param {string} pepper server-side secret (config.signaturePepper)
 * @returns {string} lowercase hex SHA-256 digest
 */
function contentHash(signedContent, pepper) {
  if (typeof pepper !== 'string' || pepper.length === 0) {
    throw new Error('contentHash: a non-empty server pepper is required');
  }
  return crypto
    .createHash('sha256')
    .update(canonicalJson(signedContent) + pepper)
    .digest('hex');
}

/** SHA-256 hex digest of an arbitrary buffer/string (used for export checksums). */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = { contentHash, sha256 };
