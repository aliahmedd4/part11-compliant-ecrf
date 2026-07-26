'use strict';

const express = require('express');
const authService = require('../services/auth.service');
const { authenticate } = require('../security/authenticate');

/**
 * Authentication routes. Login is intentionally generic in its error responses so
 * it never reveals whether a username exists (defence against user enumeration).
 */
const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const result = await authService.login(username, password);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
    const result = await authService.changePassword(req.user._id, currentPassword, newPassword);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Return the authenticated principal (used by the client to confirm the session).
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
