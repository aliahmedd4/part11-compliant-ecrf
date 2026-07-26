import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { api, setToken } from './api.js';

/**
 * Authentication + SESSION TIMEOUT context.
 *
 * REGULATORY REASONING (21 CFR 11.10(d) — automatic logoff / session controls):
 * An unattended, still-authenticated workstation is a Part 11 risk (someone else
 * could act under the logged-in identity). The server already expires the JWT
 * after the configured idle timeout; the client mirrors that with an idle timer
 * that shows a WARNING modal `warnBeforeMinutes` before expiry and logs the user
 * out when the session elapses. Any activity resets the timer.
 */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null); // { idleTimeoutMinutes, warnBeforeMinutes }
  const [warning, setWarning] = useState(false);
  const warnTimer = useRef(null);
  const logoutTimer = useRef(null);

  const logout = useCallback(() => {
    clearTimeout(warnTimer.current);
    clearTimeout(logoutTimer.current);
    setToken(null);
    setUser(null);
    setSession(null);
    setWarning(false);
  }, []);

  const armTimers = useCallback((cfg) => {
    if (!cfg) return;
    clearTimeout(warnTimer.current);
    clearTimeout(logoutTimer.current);
    setWarning(false);
    const idleMs = cfg.idleTimeoutMinutes * 60000;
    const warnMs = idleMs - cfg.warnBeforeMinutes * 60000;
    warnTimer.current = setTimeout(() => setWarning(true), Math.max(warnMs, 0));
    logoutTimer.current = setTimeout(() => logout(), idleMs);
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    setToken(res.token);
    setUser(res.user);
    const cfg = { idleTimeoutMinutes: res.expiresInMinutes, warnBeforeMinutes: res.warnBeforeMinutes };
    setSession(cfg);
    armTimers(cfg);
    return res.user;
  }, [armTimers]);

  // Any user interaction extends the session (resets the idle timers).
  const keepAlive = useCallback(() => { if (session) armTimers(session); }, [session, armTimers]);

  useEffect(() => () => { clearTimeout(warnTimer.current); clearTimeout(logoutTimer.current); }, []);

  return (
    <AuthCtx.Provider value={{ user, login, logout, warning, keepAlive, session }}>
      {children}
    </AuthCtx.Provider>
  );
}
