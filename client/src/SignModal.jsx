import React, { useState } from 'react';
import { api } from './api.js';

/**
 * Electronic signature modal. Enforces the two-step act at the UI level: the user
 * must RE-ENTER their password and explicitly choose the MEANING of the signature.
 * The actual authority + binding is enforced by the server; this component just
 * collects the credential and meaning and surfaces the result.
 */
export default function SignModal({ formId, onClose, onSigned }) {
  const [password, setPassword] = useState('');
  const [meaning, setMeaning] = useState('author');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.signForm(formId, password, meaning);
      onSigned();
    } catch (err) {
      setError(err.status === 401 ? 'Re-authentication failed — password incorrect.' : (err.message || 'Signing failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Electronically sign record</h3>
        <p className="muted">
          By signing you certify this record. Your signature will be permanently
          bound to its current content (21 CFR 11.70).
        </p>
        <form onSubmit={submit}>
          <label htmlFor="sig-meaning">Meaning of signature</label>
          <select id="sig-meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)}>
            <option value="author">Author (I recorded this data)</option>
            <option value="reviewer">Reviewer (I have reviewed this data)</option>
            <option value="approver">Approver (I approve this data)</option>
          </select>
          <label htmlFor="sig-password">Re-enter your password</label>
          <input id="sig-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <p className="error" role="alert">{error}</p>}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy}>Sign</button>
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
