'use strict';

const express = require('express');
const Signature = require('../models/signature.model');
const FormInstance = require('../models/formInstance.model');
const signatureService = require('../services/signature.service');
const { authenticate } = require('../security/authenticate');
const { requirePermission } = require('../security/requirePermission');

/**
 * Electronic-signature routes (mounted under /forms alongside form.routes).
 * Signing requires the 'sign:form' authority AND password re-authentication in the
 * request body — the middleware proves authority, the service proves identity.
 */
const router = express.Router();

router.post('/:id/sign', authenticate, requirePermission('sign', 'form'), async (req, res, next) => {
  try {
    const { password, meaning } = req.body || {};
    if (!password || !meaning) return res.status(400).json({ error: 'password and meaning required' });
    const signature = await signatureService.sign({ actor: req.user, password, formId: req.params.id, meaning });
    res.status(201).json(signature);
  } catch (e) { next(e); }
});

// List signatures for a record, each annotated with a live validity check so a
// reviewer can immediately see whether the signed content still matches.
router.get('/:id/signatures', authenticate, requirePermission('read', 'form'), async (req, res, next) => {
  try {
    const form = await FormInstance.findById(req.params.id);
    if (!form) return res.status(404).json({ error: 'not_found' });
    const signatures = await Signature.find({ recordCollection: 'FormInstance', recordId: form._id }).sort({ whenUTC: 1 });
    const annotated = signatures.map((s) => ({
      ...s.toObject(),
      verification: signatureService.verifySignature(s, form),
    }));
    res.json(annotated);
  } catch (e) { next(e); }
});

module.exports = router;
