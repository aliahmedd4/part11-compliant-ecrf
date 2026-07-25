'use strict';

const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete.plugin');

/**
 * User account and its access-control state.
 *
 * Supports 21 CFR 11.10(d) "limiting system access to authorized individuals"
 * and 11.10(g) "authority checks". The role drives the server-side permission
 * matrix. Password material is stored only as a bcrypt hash; passwordHistory
 * holds prior hashes to enforce non-reuse. failedAttempts / lockedUntil implement
 * account lockout after repeated authentication failures.
 */
const ROLES = ['Investigator', 'DataManager', 'Monitor', 'Administrator'];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    // Printed name is captured on signatures (11.50(a)(1)); stored here as the
    // authoritative source of the signer's full name.
    printedName: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    passwordHash: { type: String, required: true },
    // Most-recent-first list of previous bcrypt hashes (non-reuse enforcement).
    passwordHistory: { type: [String], default: [] },
    failedAttempts: { type: Number, default: 0 },
    // Start of the current failure-counting window.
    failedWindowStartUTC: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    passwordChangedAtUTC: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.plugin(softDeletePlugin);

userSchema.statics.ROLES = ROLES;

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
