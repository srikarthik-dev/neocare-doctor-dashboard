/**
 * NEOCARE Doctor Dashboard — Shared Utility Functions
 * ─────────────────────────────────────────────────────
 * Stage 2: Utility functions used across all modules.
 *
 * Pure, stateless helpers — no DOM side-effects.
 * No dependency on auth.js or dataService.js.
 */

'use strict';

const NeoCareUtils = (() => {

  /**
   * Formats an ISO date string into a human-readable date.
   * @param {string} isoString
   * @param {string} [locale='en-IN']
   * @returns {string}  e.g. "18 Sep 2026"
   */
  function formatDate(isoString, locale = 'en-IN') {
    try {
      return new Date(isoString).toLocaleDateString(locale, {
        day:   '2-digit',
        month: 'short',
        year:  'numeric',
      });
    } catch {
      return isoString || '—';
    }
  }

  /**
   * Formats an ISO timestamp to HH:MM.
   * @param {string} isoString
   * @returns {string}  e.g. "09:30"
   */
  function formatTime(isoString) {
    try {
      return new Date(isoString).toLocaleTimeString('en-IN', {
        hour:   '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return isoString || '—';
    }
  }

  /**
   * Returns a human-readable relative time string.
   * @param {string} isoString
   * @returns {string}  e.g. "2 hours ago", "just now"
   */
  function formatRelativeTime(isoString) {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const mins  = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      const days  = Math.floor(hours / 24);

      if (mins < 1)   return 'just now';
      if (mins < 60)  return `${mins} minute${mins === 1 ? '' : 's'} ago`;
      if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      return `${days} day${days === 1 ? '' : 's'} ago`;
    } catch {
      return '—';
    }
  }

  /**
   * Capitalises the first letter of a string.
   * @param {string} str
   * @returns {string}
   */
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Clamps a numeric value within [min, max].
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Returns a debounced version of fn.
   * @param {Function} fn
   * @param {number}   delayMs
   * @returns {Function}
   */
  function debounce(fn, delayMs) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delayMs);
    };
  }

  /**
   * Returns a throttled version of fn.
   * @param {Function} fn
   * @param {number}   limitMs
   * @returns {Function}
   */
  function throttle(fn, limitMs) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= limitMs) {
        lastCall = now;
        fn.apply(this, args);
      }
    };
  }

  /**
   * Generates a simple unique ID string.
   * Not a real UUID — sufficient for demo element IDs.
   * @returns {string}
   */
  function generateId() {
    return `nc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Joins class name arguments, filtering falsy values.
   * @param {...(string|undefined|null|boolean)} args
   * @returns {string}
   */
  function classNames(...args) {
    return args.filter(Boolean).join(' ');
  }

  /**
   * Extracts initials from a full name string.
   * e.g. "Dr. Ananya Sharma" → "AS"
   * @param {string} name
   * @param {number} [max=2]
   * @returns {string}
   */
  function getInitials(name, max = 2) {
    if (!name) return '?';
    return name
      .replace(/^Dr\.?\s*/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, max)
      .map(w => w[0].toUpperCase())
      .join('');
  }

  /**
   * Safely queries a DOM element by selector.
   * Returns null (does not throw) if not found.
   * @param {string}   selector
   * @param {Element}  [scope=document]
   * @returns {Element|null}
   */
  function qs(selector, scope = document) {
    return scope.querySelector(selector);
  }

  /**
   * Safely queries all matching DOM elements.
   * @param {string}   selector
   * @param {Element}  [scope=document]
   * @returns {Element[]}
   */
  function qsAll(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  return {
    formatDate,
    formatTime,
    formatRelativeTime,
    capitalize,
    clamp,
    debounce,
    throttle,
    generateId,
    classNames,
    getInitials,
    qs,
    qsAll,
  };

})();
