'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/user.model');

/**
 * Authentication middleware.
 *
 * Verifies the bearer JWT (session token) and, crucially, RE-READS the user and
 * their role from the database rather than trusting whatever the token claims.
 *
 * REGULATORY REASONING (11.10(d)/(g)):
 * The role drives every authority check. If we trusted a role encoded in the
 * token, anyone who could craft a token (or whose role was later downgraded)
 * could act above their privilege. Re-reading from the database means access
 * always reflects the CURRENT authorization state, and a revoked/soft-deleted or
 * deactivated account is rejected immediately. The token expiry also enforces the
 * configurable session timeout (11.10(d)).
 *
 * On success it attaches `req.user = { _id, username, role, printedName }`.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'unauthenticated', message: 'Bearer token required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (e) {
    // Covers both tampered tokens and expired sessions (session timeout).
    const expired = e.name === 'TokenExpiredError';
    return res.status(401).json({ error: expired ? 'session_expired' : 'invalid_token' });
  }

  // Re-read the authoritative user record (role, active state) from the DB.
  const user = await User.findById(payload.sub);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'account_unavailable' });
  }

  req.user = {
    _id: user._id,
    username: user.username,
    role: user.role,
    printedName: user.printedName,
  };
  return next();
}

module.exports = { authenticate };
