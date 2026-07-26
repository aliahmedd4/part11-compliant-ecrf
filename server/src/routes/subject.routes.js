'use strict';

const express = require('express');
const Subject = require('../models/subject.model');
const formService = require('../services/form.service');
const { authenticate } = require('../security/authenticate');
const { requirePermission } = require('../security/requirePermission');

/**
 * Subject enrolment & listing. Every route is gated by authentication AND a
 * server-side authority check, so hiding a button in the UI is never the control.
 */
const router = express.Router();

router.post('/', authenticate, requirePermission('write', 'subject'), async (req, res, next) => {
  try {
    const { studyId, subjectCode, status } = req.body || {};
    if (!studyId || !subjectCode) return res.status(400).json({ error: 'studyId and subjectCode required' });
    const subject = await formService.enrolSubject({ actor: req.user, studyId, subjectCode, status });
    res.status(201).json(subject);
  } catch (e) { next(e); }
});

router.get('/', authenticate, requirePermission('read', 'subject'), async (req, res, next) => {
  try {
    const subjects = await Subject.find({}).sort({ subjectCode: 1 });
    res.json(subjects);
  } catch (e) { next(e); }
});

module.exports = router;
