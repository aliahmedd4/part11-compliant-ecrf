'use strict';

const express = require('express');
const Query = require('../models/query.model');
const queryService = require('../services/query.service');
const { authenticate } = require('../security/authenticate');
const { requirePermission } = require('../security/requirePermission');

/**
 * Query workflow routes. Note how the three transitions require DIFFERENT
 * authorities from the RBAC matrix — raise (Monitor/DataManager), respond
 * (Investigator), close (DataManager) — enforcing separation of duties.
 */
const router = express.Router();

router.post('/', authenticate, requirePermission('raise', 'query'), async (req, res, next) => {
  try {
    const { formInstanceId, field, text } = req.body || {};
    const query = await queryService.raiseQuery({ actor: req.user, formInstanceId, field, text });
    res.status(201).json(query);
  } catch (e) { next(e); }
});

router.get('/', authenticate, requirePermission('read', 'query'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.formInstanceId) filter.formInstanceId = req.query.formInstanceId;
    if (req.query.status) filter.status = req.query.status;
    const queries = await Query.find(filter).sort({ createdAt: 1 });
    res.json(queries);
  } catch (e) { next(e); }
});

router.post('/:id/respond', authenticate, requirePermission('respond', 'query'), async (req, res, next) => {
  try {
    const query = await queryService.respondQuery({ actor: req.user, queryId: req.params.id, text: (req.body || {}).text });
    res.json(query);
  } catch (e) { next(e); }
});

router.post('/:id/close', authenticate, requirePermission('close', 'query'), async (req, res, next) => {
  try {
    const query = await queryService.closeQuery({ actor: req.user, queryId: req.params.id, text: (req.body || {}).text });
    res.json(query);
  } catch (e) { next(e); }
});

module.exports = router;
