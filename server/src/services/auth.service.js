'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/user.model');
const { getConfig } = require('../models/config.model');
const { writeAudit } = require('./audit.service');
const { serverNow } = require('../lib/time');

/**
 * Authentication & credential-management service.
 *
 * Implements the Part 11 access controls that are the shared responsibility of
 * 11.10(d) (authorized access), 11.10(g) (authority checks) and 11.300
 * (identification-code / password controls): password policy, non-reuse history,
 * account lockout after repeated failures, and session issuance with a
 * configurable timeout. All security-relevant events are written to the audit
 * trail.
 */
const BCRYPT_ROUNDS = 10;

/**
 * Validate a candidate password against the configured policy and history.
 * @returns {Promise<void>} resolves if OK, throws with .status/.code otherwise
 */
async function assertPasswordMeetsPolicy(candidate, user) {
  const cfg = await getConfig(config.defaultPolicy);
  const p = cfg.passwordPolicy;
  const problems = [];
  if (!candidate || candidate.length < p.minLength) {
    problems.push(`must be at least ${p.minLength} characters`);
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(candidate || '')).length;
  if (classes < p.requiredClasses) {
    problems.push(`must contain at least ${p.requiredClasses} of: lowercase, uppercase, digit, symbol`);
  }
  if (problems.length) {
    const err = new Error(`Password policy not met: ${problems.join('; ')}`);
    err.status = 422;
    err.code = 'password_policy';
    throw err;
  }
  // Non-reuse: compare against current + historical hashes.
  if (user) {
    const priorHashes = [user.passwordHash, ...(user.passwordHistory || [])].filter(Boolean);
    for (const h of priorHashes) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(candidate, h)) {
        const err = new Error('Password policy not met: must not reuse a recent password');
        err.status = 422;
        err.code = 'password_reuse';
        throw err;
      }
    }
  }
}

/** Hash a password with bcrypt. */
function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verify a raw username/password against the stored hash. Used both for login and
 * for signing re-authentication (11.200(a)(1)). Does NOT mutate lockout state.
 * @returns {Promise<boolean>}
 */
async function verifyCredentials(username, password) {
  const user = await User.findOne({ username });
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}

/**
 * Attempt an interactive login. Enforces lockout and issues a session JWT.
 * @returns {Promise<{token:string, user:object, expiresInMinutes:number}>}
 * @throws error with .status 401 (bad creds) or 423 (locked)
 */
async function login(username, password) {
  const cfg = await getConfig(config.defaultPolicy);
  const now = serverNow();
  const user = await User.findOne({ username });

  // Unknown user: audit a failure without revealing which part was wrong.
  if (!user) {
    await writeAudit({ actor: { username }, collection: 'User', action: 'login_failed', reason: 'unknown username' });
    return fail401();
  }

  // Locked account: reject regardless of password correctness.
  if (user.lockedUntil && user.lockedUntil > now) {
    await writeAudit({ actor: { _id: user._id, username }, collection: 'User', docId: user._id, action: 'login_failed', reason: 'account locked' });
    const err = new Error('Account is locked due to repeated failed logins');
    err.status = 423;
    err.code = 'account_locked';
    throw err;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await registerFailure(user, cfg, now);
    return fail401();
  }

  // Success: reset failure counters and issue a token.
  user.failedAttempts = 0;
  user.failedWindowStartUTC = null;
  user.lockedUntil = null;
  await user.save();

  const expiresInMinutes = cfg.session.idleTimeoutMinutes;
  const token = jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, {
    expiresIn: `${expiresInMinutes}m`,
  });
  await writeAudit({ actor: { _id: user._id, username }, collection: 'User', docId: user._id, action: 'login', reason: 'successful login' });

  return {
    token,
    expiresInMinutes,
    warnBeforeMinutes: cfg.session.warnBeforeMinutes,
    user: { id: user._id, username: user.username, role: user.role, printedName: user.printedName },
  };
}

// Increment the rolling failure counter and lock the account at threshold.
async function registerFailure(user, cfg, now) {
  const windowMs = cfg.lockout.windowMinutes * 60000;
  const inWindow = user.failedWindowStartUTC && now - user.failedWindowStartUTC < windowMs;
  user.failedAttempts = inWindow ? user.failedAttempts + 1 : 1;
  user.failedWindowStartUTC = inWindow ? user.failedWindowStartUTC : now;

  let locked = false;
  if (user.failedAttempts >= cfg.lockout.threshold) {
    user.lockedUntil = new Date(now.getTime() + cfg.lockout.lockMinutes * 60000);
    user.failedAttempts = 0;
    user.failedWindowStartUTC = null;
    locked = true;
  }
  await user.save();
  await writeAudit({
    actor: { _id: user._id, username: user.username },
    collection: 'User',
    docId: user._id,
    action: locked ? 'account_locked' : 'login_failed',
    reason: locked ? 'lockout threshold reached' : 'invalid password',
  });
}

function fail401() {
  const err = new Error('Invalid username or password');
  err.status = 401;
  err.code = 'invalid_credentials';
  throw err;
}

/**
 * Change a user's password under policy + history rules.
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId);
  if (!user) { const e = new Error('User not found'); e.status = 404; throw e; }
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) { const e = new Error('Current password is incorrect'); e.status = 401; e.code = 'invalid_credentials'; throw e; }

  await assertPasswordMeetsPolicy(newPassword, user);

  const cfg = await getConfig(config.defaultPolicy);
  const oldHash = user.passwordHash;
  user.passwordHash = await hashPassword(newPassword);
  user.passwordHistory = [oldHash, ...(user.passwordHistory || [])].slice(0, cfg.passwordPolicy.historyDepth);
  user.passwordChangedAtUTC = serverNow();
  await user.save();
  await writeAudit({ actor: { _id: user._id, username: user.username }, collection: 'User', docId: user._id, action: 'password_change', reason: 'user changed password' });
  return { changed: true };
}

module.exports = {
  assertPasswordMeetsPolicy,
  hashPassword,
  verifyCredentials,
  login,
  changePassword,
};
