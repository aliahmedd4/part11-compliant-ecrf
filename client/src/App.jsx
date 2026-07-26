import React from 'react';
import { useAuth } from './AuthContext.jsx';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';

/**
 * Top-level shell: shows the login screen until authenticated, then the workspace.
 * Also renders the session-expiry warning modal driven by AuthContext's idle timer
 * (client mirror of the server-enforced session timeout, 11.10(d)).
 */
export default function App() {
  const { user, logout, warning, keepAlive } = useAuth();

  if (!user) return <Login />;

  return (
    <div className="app" onMouseDown={keepAlive} onKeyDown={keepAlive}>
      <div className="topbar">
        <strong>Part 11 eCRF</strong>
        <span>
          {user.printedName} <span className="role">{user.role}</span>{' '}
          <button className="secondary" onClick={logout} style={{ marginLeft: 10 }}>Log out</button>
        </span>
      </div>

      <Dashboard />

      {warning && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Session expiring</h3>
            <p>Your session is about to time out due to inactivity. Any activity will keep you signed in.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={keepAlive}>Stay signed in</button>
              <button className="secondary" onClick={logout}>Log out now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
