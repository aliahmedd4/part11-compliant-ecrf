'use strict';

const express = require('express');
const FormInstance = require('../models/formInstance.model');
const formService = require('../services/form.service');
const { authenticate } = require('../security/authenticate');
const { requirePermission } = require('../security/requirePermission');

/**
 * Form data entry, update, amendment and soft delete. Edit-check failures return
 * 422 with a structured `errors` array; locked (signed) records return 409 to
 * force the amendment workflow.
 */
const router = express.Router();

router.post('/', authenticate, requirePermission('write', 'form'), async (req, res, next) => {
  try {
    const { subjectId, visitId, type, data } = req.body || {};
    if (!subjectId || !visitId || !type) return res.status(400).json({ error: 'subjectId, visitId and type required' });
    const form = await formService.createForm({ actor: req.user, subjectId, visitId, type, data });
    res.status(201).json(form);
  } catch (e) { next(e); }
});

router.get('/', authenticate, requirePermission('read', 'form'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    const forms = await FormInstance.find(filter).sort({ createdAt: 1 });
    res.json(forms);
  } catch (e) { next(e); }
});

router.get('/:id', authenticate, requirePermission('read', 'form'), async (req, res, next) => {
  try {
    const form = await FormInstance.findById(req.params.id);
    if (!form) return res.status(404).json({ error: 'not_found' });
    res.json(form);
  } catch (e) { next(e); }
});

router.patch('/:id', authenticate, requirePermission('write', 'form'), async (req, res, next) => {
  try {
    const { data, reason } = req.body || {};
    const form = await formService.updateForm({ actor: req.user, formId: req.params.id, data, reason });
    res.json(form);
  } catch (e) { next(e); }
});

router.post('/:id/amend', authenticate, requirePermission('write', 'form'), async (req, res, next) => {
  try {
    const { data, reason } = req.body || {};
    const form = await formService.amendForm({ actor: req.user, formId: req.params.id, data, reason });
    res.json(form);
  } catch (e) { next(e); }
});

router.delete('/:id', authenticate, requirePermission('write', 'form'), async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    const form = await formService.deleteForm({ actor: req.user, formId: req.params.id, reason });
    res.json({ deleted: true, id: form._id });
  } catch (e) { next(e); }
});

module.exports = router;
