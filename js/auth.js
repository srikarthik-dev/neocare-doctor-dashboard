/**
 * NEOCARE Doctor Dashboard — Authentication Module
 * ─────────────────────────────────────────────────
 * Stage 2: Demo authentication and session management.
 *
 * DEMO NOTICE:
 *   This module simulates authentication for portfolio purposes.
 *   It does NOT connect to any real authentication service.
 *   All credentials and profile data are entirely synthetic.
 *   No real patient or physician data is used or stored.
 *
 * Architecture note:
 *   All session reads/writes are isolated in this file.
 *   When Firebase Auth is integrated in a future stage,
 *   only this file needs to change — no other modules are affected.
 *
 * Public API:
 *   NeoCareAuth.login(email, password, rememberMe) → Promise<{ok, error}>
 *   NeoCareAuth.logout()
 *   NeoCareAuth.isAuthenticated() → boolean
 *   NeoCareAuth.getSession() → Session | null
 *   NeoCareAuth.requireAuth(redirectPath)
 */

'use strict';

const NeoCareAuth = (() => {

  /* ══════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════ */

  /**
   * Demo credentials — synthetic data only.
   * Replace with Firebase Auth in a future stage.
   */
  const DEMO_CREDENTIALS = {
    email:    'doctor@neocare.demo',
    password: 'Doctor@123'
  };

  /**
   * Demo session profile — synthetic data only.
   * This does NOT represent a real person.
   */
  const DEMO_PROFILE = {
    authenticated: true,
    email:         'doctor@neocare.demo',
    name:          'Dr. Ananya Sharma',
    role:          'Doctor',
    specialty:     'Obstetrics & Gynecology',
    hospital:      'NEOCARE Demo Hospital',
    loginTime:     null  // set at login time
  };

  /** Key used in storage. */
  const SESSION_KEY = 'neocare_session';

  /** Simulated network delay for loading-state UX (ms). */
  const AUTH_DELAY_MS = 1000;

  /* ══════════════════════════════════════════
     PRIVATE HELPERS
  ══════════════════════════════════════════ */

  /**
   * Returns the active storage object.
   * localStorage  → used when Remember Me is true (persists across browser sessions).
   * sessionStorage → used otherwise (cleared when the tab/browser closes).
   *
   * @param {boolean} persistent
   * @returns {Storage}
   */
  function _getStorage(persistent) {
    return persistent ? window.localStorage : window.sessionStorage;
  }

  /**
   * Reads the session from whichever storage it was written to.
   * Checks localStorage first (persistent), then sessionStorage.
   *
   * @returns {object|null} Parsed session object or null.
   */
  function _readSession() {
    try {
      const fromLocal   = window.localStorage.getItem(SESSION_KEY);
      const fromSession = window.sessionStorage.getItem(SESSION_KEY);
      const raw = fromLocal || fromSession;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Writes the session to the appropriate storage.
   *
   * @param {object}  session    - Session data to persist.
   * @param {boolean} persistent - True → localStorage, false → sessionStorage.
   */
  function _writeSession(session, persistent) {
    try {
      _getStorage(persistent).setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      // Storage may be unavailable (private browsing quota, etc.)
      console.warn('[NeoCareAuth] Could not write session to storage.', e);
    }
  }

  /**
   * Removes the session from both storages.
   * Ensures a clean logout regardless of which storage was used.
   */
  function _clearSession() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.warn('[NeoCareAuth] Could not clear session from storage.', e);
    }
  }

  /**
   * Basic email format validation.
   *
   * @param {string} email
   * @returns {boolean}
   */
  function _isValidEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /* ══════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════ */

  /**
   * Attempts to log in with the provided credentials.
   *
   * Simulates an async network call with a short delay to allow
   * the UI to show a loading state. On success, writes a session
   * to the appropriate storage and returns { ok: true }.
   * On failure, returns { ok: false, error: string }.
   *
   * @param {string}  email
   * @param {string}  password
   * @param {boolean} [rememberMe=false] - If true, uses localStorage.
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async function login(email, password, rememberMe = false) {
    // Simulate async auth check
    await new Promise(resolve => setTimeout(resolve, AUTH_DELAY_MS));

    const normalizedEmail    = (email    || '').trim().toLowerCase();
    const normalizedDemo     = DEMO_CREDENTIALS.email.toLowerCase();

    if (
      normalizedEmail === normalizedDemo &&
      password === DEMO_CREDENTIALS.password
    ) {
      const session = {
        ...DEMO_PROFILE,
        loginTime: new Date().toISOString(),
        persistent: !!rememberMe
      };
      _writeSession(session, !!rememberMe);
      return { ok: true };
    }

    return { ok: false, error: 'Invalid email or password.' };
  }

  /**
   * Ends the current session and redirects to the login page.
   *
   * @param {string} [redirectTo='../index.html'] - Redirect destination.
   */
  function logout(redirectTo) {
    _clearSession();
    const destination = redirectTo || (
      // From pages/ subdirectory, go up one level.
      window.location.pathname.includes('/pages/')
        ? '../index.html'
        : 'index.html'
    );
    window.location.href = destination;
  }

  /**
   * Returns true if a valid demo session exists in storage.
   *
   * @returns {boolean}
   */
  function isAuthenticated() {
    const session = _readSession();
    return !!(session && session.authenticated === true);
  }

  /**
   * Returns the current session object, or null if not authenticated.
   *
   * @returns {object|null}
   */
  function getSession() {
    const session = _readSession();
    if (session && session.authenticated === true) {
      return session;
    }
    return null;
  }

  /**
   * Guards a page: if the user is not authenticated, redirects to the
   * login page immediately. Call this at the top of each protected page.
   *
   * @param {string} [loginPath] - Path to the login page.
   *                               Defaults to '../index.html' (from pages/).
   */
  function requireAuth(loginPath) {
    if (!isAuthenticated()) {
      const destination = loginPath || (
        window.location.pathname.includes('/pages/')
          ? '../index.html'
          : 'index.html'
      );
      window.location.href = destination;
    }
  }

  /* ══════════════════════════════════════════
     EXPOSE PUBLIC API
  ══════════════════════════════════════════ */

  return {
    login,
    logout,
    isAuthenticated,
    getSession,
    requireAuth
  };

})();
