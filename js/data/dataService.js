/**
 * NEOCARE Doctor Dashboard — Data Access Layer
 * ─────────────────────────────────────────────
 * Stage 3: Centralized data service (local JSON implementation).
 *
 * ARCHITECTURE NOTE:
 *   This module is the ONLY layer that directly accesses data sources.
 *   All page controllers must call these functions — never fetch
 *   data/*.json directly.
 *
 *   Current implementation: local JSON files (fetch API).
 *   Future implementation: Firebase / Firestore.
 *   When Firebase is integrated, ONLY this file changes.
 *   Page controllers require no modifications.
 *
 * DEMO / SAFETY NOTICE:
 *   All data returned by this module is entirely synthetic.
 *   It is not derived from real patients or real clinical records.
 *   This module does not constitute a medical device or clinical tool.
 *
 * Public API (namespace: NeoCareData):
 *   getPatients(filters)           → Promise<Patient[]>
 *   getPatientById(id)             → Promise<Patient|null>
 *   getReadings(patientId, range)  → Promise<Reading[]>
 *   getAlerts(filters)             → Promise<Alert[]>
 *   acknowledgeAlert(alertId)      → Promise<void>
 *   getDoctorProfile()             → Promise<Doctor>
 */

'use strict';

const NeoCareData = (() => {

  /* ══════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════ */

  /** Paths are relative to the site root, not to this file. */
  const DATA_PATHS = {
    patients:   'data/patients.json',
    sensorData: 'data/sensor-data.json',
    alerts:     'data/alerts.json',
    doctor:     'data/doctor.json',
  };

  /** localStorage key for mutable alert state overlay. */
  const ALERT_OVERRIDES_KEY = 'neocare_alert_overrides';

  /** Supported values — used in dev validation. */
  const VALID_MONITORING_STATUS = ['Active', 'Inactive', 'Monitoring'];
  const VALID_RISK_STATUS       = ['Low', 'Moderate', 'High'];
  const VALID_SEVERITY          = ['Info', 'Warning', 'Critical'];
  const VALID_ALERT_STATUS      = ['New', 'Acknowledged'];

  /* ══════════════════════════════════════════
     IN-MEMORY CACHE
     Prevents redundant network / disk fetches
     within the same browser session.
  ══════════════════════════════════════════ */

  const _cache = {
    patients:   null,
    sensorData: null,
    alerts:     null,
    doctor:     null,
  };

  /* ══════════════════════════════════════════
     INTERNAL: JSON LOADER
  ══════════════════════════════════════════ */

  /**
   * Fetches and parses a JSON file.
   * Caches the result for the lifetime of the page.
   * Throws a descriptive error on failure.
   *
   * @param {string} cacheKey  - Key into the _cache object.
   * @param {string} filePath  - Path to the JSON file (relative to site root).
   * @returns {Promise<any>}
   */
  async function _loadJSON(cacheKey, filePath) {
    if (_cache[cacheKey] !== null) {
      return _cache[cacheKey];
    }

    let response;
    try {
      response = await fetch(filePath);
    } catch (networkError) {
      throw new Error(
        `[NeoCareData] Network error loading "${filePath}". ` +
        `Ensure the application is running on an HTTP server, not file://.`
      );
    }

    if (!response.ok) {
      throw new Error(
        `[NeoCareData] Failed to load "${filePath}" — ` +
        `HTTP ${response.status} ${response.statusText}.`
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(
        `[NeoCareData] Invalid JSON in "${filePath}": ${parseError.message}`
      );
    }

    _cache[cacheKey] = data;
    return data;
  }

  /* ══════════════════════════════════════════
     INTERNAL: RAW DATA LOADERS
  ══════════════════════════════════════════ */

  /**
   * Returns the raw patients array, filtered to remove any
   * non-object entries (e.g. the _comment string in the JSON).
   */
  async function _loadPatients() {
    const raw = await _loadJSON('patients', DATA_PATHS.patients);
    return Array.isArray(raw) ? raw.filter(p => p && typeof p === 'object' && p.patientId) : [];
  }

  /**
   * Returns the raw sensor-data object, minus the _comment key.
   */
  async function _loadSensorData() {
    const raw = await _loadJSON('sensorData', DATA_PATHS.sensorData);
    if (!raw || typeof raw !== 'object') return {};
    const { _comment, ...data } = raw;
    return data;
  }

  /**
   * Returns the base alerts array (no overrides applied yet).
   * Filters out non-object entries (e.g. _comment).
   */
  async function _loadBaseAlerts() {
    const raw = await _loadJSON('alerts', DATA_PATHS.alerts);
    return Array.isArray(raw) ? raw.filter(a => a && typeof a === 'object' && a.alertId) : [];
  }

  /* ══════════════════════════════════════════
     INTERNAL: ALERT OVERRIDE HELPERS
     Mutable alert state — stored in localStorage
     so that acknowledgeAlert() persists across
     page navigations within the same session.
  ══════════════════════════════════════════ */

  /**
   * Reads the alert override map from localStorage.
   * @returns {{ [alertId: string]: object }}
   */
  function _readAlertOverrides() {
    try {
      const raw = window.localStorage.getItem(ALERT_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * Writes the alert override map to localStorage.
   * @param {{ [alertId: string]: object }} overrides
   */
  function _writeAlertOverrides(overrides) {
    try {
      window.localStorage.setItem(ALERT_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (e) {
      console.warn('[NeoCareData] Could not persist alert overrides:', e);
    }
  }

  /**
   * Merges localStorage overrides into a base alert array.
   * Returns a new array — does not mutate the source.
   *
   * @param {object[]} baseAlerts
   * @returns {object[]}
   */
  function _applyAlertOverrides(baseAlerts) {
    const overrides = _readAlertOverrides();
    if (Object.keys(overrides).length === 0) return baseAlerts;

    return baseAlerts.map(alert => {
      const override = overrides[alert.alertId];
      return override ? { ...alert, ...override } : alert;
    });
  }

  /* ══════════════════════════════════════════
     INTERNAL: DEVELOPMENT VALIDATION
     Runs once when sensor data is first loaded.
     Logs warnings for relationship errors so
     issues are visible during development.
  ══════════════════════════════════════════ */

  let _validationRun = false;

  async function _runDevValidation() {
    if (_validationRun) return;
    _validationRun = true;

    try {
      const patients   = await _loadPatients();
      const sensorData = await _loadSensorData();
      const alerts     = await _loadBaseAlerts();

      const patientIds = new Set(patients.map(p => p.patientId));
      const alertIds   = new Set();
      let   issues     = 0;

      // Unique patient IDs
      const pidSeen = new Set();
      patients.forEach(p => {
        if (pidSeen.has(p.patientId)) {
          console.warn(`[NeoCareData] Duplicate patientId: ${p.patientId}`);
          issues++;
        }
        pidSeen.add(p.patientId);
      });

      // Every patient should have sensor data
      patientIds.forEach(pid => {
        if (!sensorData[pid]) {
          console.warn(`[NeoCareData] No sensor data for patient: ${pid}`);
          issues++;
        }
      });

      // Sensor data keys should reference valid patients
      Object.keys(sensorData).forEach(pid => {
        if (!patientIds.has(pid)) {
          console.warn(`[NeoCareData] Sensor data references unknown patient: ${pid}`);
          issues++;
        }
      });

      // Alert validation
      alerts.forEach(alert => {
        // Unique alert IDs
        if (alertIds.has(alert.alertId)) {
          console.warn(`[NeoCareData] Duplicate alertId: ${alert.alertId}`);
          issues++;
        }
        alertIds.add(alert.alertId);

        // Alert references valid patient
        if (!patientIds.has(alert.patientId)) {
          console.warn(`[NeoCareData] Alert ${alert.alertId} references unknown patient: ${alert.patientId}`);
          issues++;
        }

        // Valid severity
        if (!VALID_SEVERITY.includes(alert.severity)) {
          console.warn(`[NeoCareData] Alert ${alert.alertId} has invalid severity: "${alert.severity}"`);
          issues++;
        }

        // Valid status
        if (!VALID_ALERT_STATUS.includes(alert.status)) {
          console.warn(`[NeoCareData] Alert ${alert.alertId} has invalid status: "${alert.status}"`);
          issues++;
        }
      });

      // Patient status validation
      patients.forEach(p => {
        if (!VALID_MONITORING_STATUS.includes(p.monitoringStatus)) {
          console.warn(`[NeoCareData] Patient ${p.patientId} has invalid monitoringStatus: "${p.monitoringStatus}"`);
          issues++;
        }
        if (!VALID_RISK_STATUS.includes(p.riskStatus)) {
          console.warn(`[NeoCareData] Patient ${p.patientId} has invalid riskStatus: "${p.riskStatus}"`);
          issues++;
        }
      });

      if (issues === 0) {
        console.info(`[NeoCareData] Data validation passed — ${patients.length} patients, ${alerts.length} alerts, ${Object.keys(sensorData).length} sensor feeds.`);
      } else {
        console.warn(`[NeoCareData] Data validation completed with ${issues} issue(s).`);
      }

    } catch (e) {
      console.warn('[NeoCareData] Dev validation could not complete:', e.message);
    }
  }

  /* ══════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════ */

  /**
   * Returns all patients, optionally filtered.
   *
   * Filters (all optional, combinable):
   *   search          {string} — matches name or patientId (case-insensitive)
   *   monitoringStatus {string} — exact match: "Active" | "Inactive" | "Monitoring"
   *   riskStatus       {string} — exact match: "Low" | "Moderate" | "High"
   *
   * Returns a new array — original dataset is not mutated.
   *
   * @param {{ search?: string, monitoringStatus?: string, riskStatus?: string }} [filters]
   * @returns {Promise<object[]>}
   */
  async function getPatients(filters = {}) {
    const patients = await _loadPatients();
    _runDevValidation();

    let results = [...patients];

    const { search, monitoringStatus, riskStatus } = filters;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.patientId.toLowerCase().includes(q)
      );
    }

    if (monitoringStatus && monitoringStatus.trim()) {
      results = results.filter(p => p.monitoringStatus === monitoringStatus);
    }

    if (riskStatus && riskStatus.trim()) {
      results = results.filter(p => p.riskStatus === riskStatus);
    }

    return results;
  }

  /**
   * Returns a single patient by ID, or null if not found.
   * Throws if data cannot be loaded.
   *
   * @param {string} patientId
   * @returns {Promise<object|null>}
   */
  async function getPatientById(patientId) {
    if (!patientId) return null;
    const patients = await _loadPatients();
    const patient  = patients.find(p => p.patientId === patientId);
    return patient || null;
  }

  /**
   * Returns sensor readings for a patient, sorted chronologically.
   *
   * Range parameter:
   *   "24h"  → readings from the last 24 hours
   *   "7d"   → readings from the last 7 days
   *   "all"  → all available readings (default)
   *
   * If the requested range has fewer readings than expected,
   * returns whatever is available (never fabricates data).
   *
   * @param {string} patientId
   * @param {"24h"|"7d"|"all"} [range="all"]
   * @returns {Promise<object[]>}
   */
  async function getReadings(patientId, range = 'all') {
    if (!patientId) return [];

    const sensorData = await _loadSensorData();
    const readings   = sensorData[patientId];

    if (!readings || !Array.isArray(readings)) return [];

    // Sort chronologically (oldest first)
    const sorted = [...readings].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    if (range === 'all') return sorted;

    const now = new Date();
    let cutoff;

    if (range === '24h') {
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (range === '7d') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      // Unknown range — return all
      console.warn(`[NeoCareData] Unknown range "${range}" — returning all readings.`);
      return sorted;
    }

    const filtered = sorted.filter(r => new Date(r.timestamp) >= cutoff);

    // If range filter yields nothing, return whatever is available
    return filtered.length > 0 ? filtered : sorted;
  }

  /**
   * Returns alerts, newest first, with localStorage overrides applied.
   *
   * Filters (all optional, combinable):
   *   patientId {string} — exact match
   *   severity  {string} — "Info" | "Warning" | "Critical"
   *   status    {string} — "New" | "Acknowledged"
   *
   * Returns a new array — original dataset is not mutated.
   *
   * @param {{ patientId?: string, severity?: string, status?: string }} [filters]
   * @returns {Promise<object[]>}
   */
  async function getAlerts(filters = {}) {
    const baseAlerts = await _loadBaseAlerts();
    const alerts     = _applyAlertOverrides(baseAlerts);

    let results = [...alerts];

    const { patientId, severity, status } = filters;

    if (patientId && patientId.trim()) {
      results = results.filter(a => a.patientId === patientId);
    }

    if (severity && severity.trim()) {
      results = results.filter(a => a.severity === severity);
    }

    if (status && status.trim()) {
      results = results.filter(a => a.status === status);
    }

    // Sort newest first
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return results;
  }

  /**
   * Acknowledges an alert by ID.
   *
   * Changes the alert's status from "New" to "Acknowledged".
   * Persists the change in localStorage (neocare_alert_overrides).
   * Does NOT modify the source JSON file.
   *
   * Throws if the alertId does not exist.
   *
   * @param {string} alertId
   * @returns {Promise<void>}
   */
  async function acknowledgeAlert(alertId) {
    if (!alertId) throw new Error('[NeoCareData] acknowledgeAlert: alertId is required.');

    const baseAlerts = await _loadBaseAlerts();
    const exists     = baseAlerts.some(a => a.alertId === alertId);

    if (!exists) {
      throw new Error(`[NeoCareData] acknowledgeAlert: No alert found with ID "${alertId}".`);
    }

    const overrides = _readAlertOverrides();
    overrides[alertId] = { status: 'Acknowledged' };
    _writeAlertOverrides(overrides);

    // Bust the in-memory alerts cache so getAlerts() re-applies overrides
    // Note: we do NOT bust _cache.alerts because that's the base JSON;
    // overrides are applied at read time so the next getAlerts() call
    // will pick up the change automatically.
  }

  /**
   * Returns the synthetic demo doctor profile.
   *
   * @returns {Promise<object>}
   */
  async function getDoctorProfile() {
    return _loadJSON('doctor', DATA_PATHS.doctor);
  }

  /* ══════════════════════════════════════════
     EXPOSE PUBLIC API
  ══════════════════════════════════════════ */

  return {
    getPatients,
    getPatientById,
    getReadings,
    getAlerts,
    acknowledgeAlert,
    getDoctorProfile,
  };

})();
