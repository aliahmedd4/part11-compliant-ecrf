'use strict';

const path = require('path');
const { SERVER_SRC } = require('../setup/testServer');
const { checkForm } = require(path.join(SERVER_SRC, 'validation', 'editChecks'));

/**
 * OQ — Edit checks (data integrity: required, range, cross-field). Pure-function
 * tests; no database required.
 */
describe('Edit-check engine', () => {
  test('OQ-EC-01: demographics requires DOB and sex', () => {
    const errors = checkForm('demographics', {});
    expect(errors.map((e) => e.field)).toEqual(expect.arrayContaining(['dateOfBirth', 'sex']));
  });

  test('OQ-EC-02: demographics rejects a future date of birth', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const errors = checkForm('demographics', { dateOfBirth: future, sex: 'F' });
    expect(errors.find((e) => e.field === 'dateOfBirth' && e.rule === 'not_future')).toBeDefined();
  });

  test('OQ-EC-03: vitals range checks catch out-of-range systolic', () => {
    const errors = checkForm('vitals', { systolic: 400, diastolic: 80, heartRate: 70 });
    expect(errors.find((e) => e.field === 'systolic' && e.rule === 'range')).toBeDefined();
  });

  test('OQ-EC-04: vitals cross-field requires systolic > diastolic', () => {
    const errors = checkForm('vitals', { systolic: 80, diastolic: 120, heartRate: 70 });
    expect(errors.find((e) => e.rule === 'cross_field')).toBeDefined();
  });

  test('OQ-EC-05: valid vitals produce no errors', () => {
    expect(checkForm('vitals', { systolic: 120, diastolic: 80, heartRate: 70 })).toEqual([]);
  });

  test('OQ-EC-06: adverse event end date cannot precede start date', () => {
    const errors = checkForm('adverse_event', { term: 'Headache', severity: 'mild', startDate: '2026-02-01', endDate: '2026-01-01' });
    expect(errors.find((e) => e.field === 'endDate' && e.rule === 'cross_field')).toBeDefined();
  });

  test('OQ-EC-07: an ongoing adverse event cannot have an end date', () => {
    const errors = checkForm('adverse_event', { term: 'Nausea', severity: 'moderate', startDate: '2026-02-01', ongoing: true, endDate: '2026-03-01' });
    expect(errors.find((e) => e.field === 'endDate' && e.rule === 'cross_field')).toBeDefined();
  });
});
