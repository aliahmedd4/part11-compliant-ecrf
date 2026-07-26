'use strict';

const express = require('express');
const User = require('../models/user.model');
const AuditEvent = require('../models/auditEvent.model');
const authService = require('../services/auth.service');
const { authenticate } = require('../security/authenticate');
const { requirePermission } = require('../security/requirePermission');
const { writeAudit } = require('../services/audit.service');

/**
 * Administration routes: user access management and audit-trail REVIEW.
 *
 * There is deliberately NO endpoint to modify or delete an audit event — the
 * audit trail is exposed read-only. This is the API-level expression of the
 * append-only guarantee: even an Administrator can only READ history, never
 * rewrite it. (The OQ suite also proves the model layer blocks mutation.)
 */
const router = express.Router();

// --- User Access Management (Administrator only, via '*:*') ---
router.post('/users', authenticate, requirePermission('manage', 'user'), async (req, res, next) => {
  try {
    const { username, printedName, role, password } = req.body || {};
    if (!username || !printedName || !role || !password) {
      return res.status(400).json({ error: 'username, printedName, role, password required' });
    }
    if (!User.ROLES.includes(role)) return res.status(422).json({ error: 'invalid_role' });
    await authService.assertPasswordMeetsPolicy(password, null);
    const passwordHash = await authService.hashPassword(password);
    const user = await User.create({ username, printedName, role, passwordHash });
    await writeAudit({ actor: req.user, collection: 'User', docId: user._id, field: null, oldValue: null, newValue: { username, role }, reason: 'user provisioned', action: 'create' });
    res.status(201).json({ id: user._id, username, role, printedName });
  } catch (e) { next(e); }
});

router.get('/users', authenticate, requirePermission('manage', 'user'), async (req, res, next) => {
  try {
    const users = await User.find({}).select('username printedName role active lockedUntil');
    res.json(users);
  } catch (e) { next(e); }
});

// Deactivate (soft) a user account — never a hard delete.
router.post('/users/:id/deactivate', authenticate, requirePermission('manage', 'user'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'not_found' });
    user.active = false;
    await user.save();
    await writeAudit({ actor: req.user, collection: 'User', docId: user._id, field: 'active', oldValue: true, newValue: false, reason: (req.body || {}).reason || 'account deactivated', action: 'update' });
    res.json({ deactivated: true });
  } catch (e) { next(e); }
});

// --- Audit trail review (read-only) ---
router.get('/audit', authenticate, requirePermission('read', 'audit'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.targetModel) filter.targetModel = req.query.targetModel;
    if (req.query.docId) filter.docId = req.query.docId;
    if (req.query.action) filter.action = req.query.action;
    const events = await AuditEvent.find(filter).sort({ whenUTC: 1 }).limit(1000);
    res.json(events);
  } catch (e) { next(e); }
});

module.exports = router;
