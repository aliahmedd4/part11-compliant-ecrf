'use strict';

const express = require('express');
const exportService = require('../services/export.service');
const { authenticate } = require('../security/authenticate');
const { requirePermission } = require('../security/requirePermission');
const { writeAudit } = require('../services/audit.service');

/**
 * Dataset export route. Restricted to roles with 'export:dataset' authority and
 * audited, because an export is a disclosure of the controlled dataset and must
 * be attributable.
 */
const router = express.Router();

router.get('/dataset', authenticate, requirePermission('export', 'dataset'), async (req, res, next) => {
  try {
    const result = await exportService.buildExport({ actor: req.user });
    await writeAudit({
      actor: req.user, collection: 'Dataset', docId: undefined, field: null,
      oldValue: null, newValue: result.manifest, reason: 'dataset export', action: 'export',
    });
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
