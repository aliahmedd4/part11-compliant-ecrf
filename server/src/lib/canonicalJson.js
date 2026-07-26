'use strict';

/**
 * Deterministic ("canonical") JSON serialization.
 *
 * REGULATORY REASONING (21 CFR 11.70 — signature/record binding):
 * To bind a signature to record content we hash that content. A hash is only
 * meaningful if the same logical content always produces the same bytes. Ordinary
 * JSON.stringify does not guarantee key order, so two identical records could
 * serialize differently and break verification. canonicalJson recursively sorts
 * object keys so the serialization — and therefore the hash — is stable and
 * reproducible. Any change to a value (or the set of fields) changes the output,
 * which is precisely what makes post-signing alteration detectable.
 *
 * @param {*} value any JSON-serializable value (objects, arrays, primitives, Date)
 * @returns {string} canonical JSON string
 */
function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}

function normalize(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    // Support Mongoose subdocuments / objects with toObject.
    const plain = typeof value.toObject === 'function' ? value.toObject() : value;
    const sortedKeys = Object.keys(plain).sort();
    const out = {};
    for (const k of sortedKeys) {
      out[k] = normalize(plain[k]);
    }
    return out;
  }
  return value; // string | number | boolean
}

module.exports = { canonicalJson };
