'use strict';

/**
 * Edit-check (data-validation) engine.
 *
 * REGULATORY REASONING (ALCOA+ "Accurate"; ICH GCP data quality):
 * Edit checks are the front-line control for data integrity — they stop
 * implausible or incomplete data from ever entering the record. Three classic
 * kinds are implemented:
 *   - required-field checks (completeness),
 *   - range checks (plausibility of a single value),
 *   - cross-field checks (internal consistency between values).
 * The engine is a PURE function (no DB, no time) so it is trivially testable and
 * its behaviour is fully determined by its inputs — important for OQ evidence.
 *
 * @param {'demographics'|'vitals'|'adverse_event'} type
 * @param {object} data the form's data payload
 * @returns {{field:string, rule:string, message:string}[]} list of violations
 *          (empty array means the data passed all checks)
 */
function checkForm(type, data) {
  const d = data || {};
  switch (type) {
    case 'demographics':
      return checkDemographics(d);
    case 'vitals':
      return checkVitals(d);
    case 'adverse_event':
      return checkAdverseEvent(d);
    default: {
      return [{ field: 'type', rule: 'known_type', message: `Unknown form type: ${type}` }];
    }
  }
}

function checkDemographics(d) {
  const errors = [];
  required(errors, d, 'dateOfBirth', 'Date of birth is required');
  required(errors, d, 'sex', 'Sex is required');
  if (d.sex && !['M', 'F', 'Other'].includes(d.sex)) {
    errors.push({ field: 'sex', rule: 'enum', message: 'Sex must be M, F or Other' });
  }
  if (d.dateOfBirth) {
    const dob = new Date(d.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      errors.push({ field: 'dateOfBirth', rule: 'date', message: 'Date of birth is not a valid date' });
    } else if (dob.getTime() > Date.now()) {
      errors.push({ field: 'dateOfBirth', rule: 'not_future', message: 'Date of birth cannot be in the future' });
    }
  }
  return errors;
}

function checkVitals(d) {
  const errors = [];
  required(errors, d, 'systolic', 'Systolic blood pressure is required');
  required(errors, d, 'diastolic', 'Diastolic blood pressure is required');
  required(errors, d, 'heartRate', 'Heart rate is required');
  range(errors, d, 'systolic', 60, 300);
  range(errors, d, 'diastolic', 30, 200);
  range(errors, d, 'heartRate', 20, 250);
  // Cross-field: systolic must exceed diastolic.
  if (isNum(d.systolic) && isNum(d.diastolic) && d.systolic <= d.diastolic) {
    errors.push({ field: 'systolic', rule: 'cross_field', message: 'Systolic must be greater than diastolic' });
  }
  return errors;
}

function checkAdverseEvent(d) {
  const errors = [];
  required(errors, d, 'term', 'Adverse event term is required');
  required(errors, d, 'severity', 'Severity is required');
  if (d.severity && !['mild', 'moderate', 'severe'].includes(d.severity)) {
    errors.push({ field: 'severity', rule: 'enum', message: 'Severity must be mild, moderate or severe' });
  }
  required(errors, d, 'startDate', 'Start date is required');
  const start = d.startDate ? new Date(d.startDate) : null;
  const end = d.endDate ? new Date(d.endDate) : null;
  // Cross-field: end date must not precede start date.
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
    errors.push({ field: 'endDate', rule: 'cross_field', message: 'End date cannot be before start date' });
  }
  // Cross-field: an ongoing event cannot also have an end date.
  if (d.ongoing === true && d.endDate) {
    errors.push({ field: 'endDate', rule: 'cross_field', message: 'An ongoing event cannot have an end date' });
  }
  return errors;
}

// --- helpers ---
function required(errors, d, field, message) {
  const v = d[field];
  if (v === undefined || v === null || v === '') {
    errors.push({ field, rule: 'required', message });
  }
}
function range(errors, d, field, min, max) {
  const v = d[field];
  if (isNum(v) && (v < min || v > max)) {
    errors.push({ field, rule: 'range', message: `${field} must be between ${min} and ${max}` });
  }
}
function isNum(v) {
  return typeof v === 'number' && !Number.isNaN(v);
}

module.exports = { checkForm };
