import React, { useState } from 'react';
import { api } from './api.js';

/**
 * Vital-signs entry form. Displays server-returned edit-check violations inline.
 * Note the UI does not itself decide validity for compliance purposes — it sends
 * the data and renders whatever the server's edit-check engine reports, so the
 * authoritative validation always runs server-side.
 */
export default function VitalsForm({ subjectId, visitId, onCreated }) {
  const [values, setValues] = useState({ systolic: '', diastolic: '', heartRate: '' });
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  function set(field, v) { setValues((s) => ({ ...s, [field]: v })); }
  function errFor(field) { return errors.find((e) => e.field === field); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrors([]);
    try {
      const data = {
        systolic: Number(values.systolic),
        diastolic: Number(values.diastolic),
        heartRate: Number(values.heartRate),
      };
      await api.createForm({ subjectId, visitId, type: 'vitals', data });
      setValues({ systolic: '', diastolic: '', heartRate: '' });
      onCreated();
    } catch (err) {
      if (err.status === 422 && err.body && err.body.errors) setErrors(err.body.errors);
      else setErrors([{ field: '_', message: err.message || 'Save failed' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid2">
        <div>
          <label htmlFor="systolic">Systolic (60–300)</label>
          <input id="systolic" type="number" value={values.systolic} onChange={(e) => set('systolic', e.target.value)} />
          {errFor('systolic') && <div className="field-error">{errFor('systolic').message}</div>}
        </div>
        <div>
          <label htmlFor="diastolic">Diastolic (30–200)</label>
          <input id="diastolic" type="number" value={values.diastolic} onChange={(e) => set('diastolic', e.target.value)} />
          {errFor('diastolic') && <div className="field-error">{errFor('diastolic').message}</div>}
        </div>
      </div>
      <label htmlFor="heartRate">Heart rate (20–250)</label>
      <input id="heartRate" type="number" value={values.heartRate} onChange={(e) => set('heartRate', e.target.value)} />
      {errFor('heartRate') && <div className="field-error">{errFor('heartRate').message}</div>}
      {errFor('_') && <div className="error">{errFor('_').message}</div>}
      <div style={{ marginTop: 12 }}>
        <button type="submit" disabled={busy}>Save vital signs</button>
      </div>
    </form>
  );
}
