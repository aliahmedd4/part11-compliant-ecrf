import React, { useState } from 'react';
import { useAuth } from './AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await login(username, password);
    } catch (err) {
      // Deliberately generic — the server does not reveal which field was wrong.
      setError(err.status === 423 ? 'Account locked due to repeated failures.' : 'Invalid username or password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="card" style={{ maxWidth: 380, margin: '80px auto' }}>
        <h3>Part 11 eCRF — Sign in</h3>
        <form onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <p className="error" role="alert">{error}</p>}
          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
        <p className="muted">Seeded roles: investigator, datamanager, monitor, administrator</p>
      </div>
    </div>
  );
}
