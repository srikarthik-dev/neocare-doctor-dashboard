/**
 * NEOCARE Doctor Dashboard — Dashboard Page Controller
 * ──────────────────────────────────────────────────────
 * Stage 5: Implements the full doctor dashboard.
 *
 * DEMO / SAFETY NOTICE:
 *   All data rendered by this module is entirely synthetic.
 *   This dashboard does not support any clinical decision-making.
 *   It is a portfolio demonstration prototype only.
 *
 * Responsibilities:
 *   - Load all dashboard data concurrently via NeoCareData
 *   - Render KPI cards (total patients, active, high-risk, new alerts)
 *   - Render risk distribution doughnut chart via NeoCareCharts
 *   - Render recent alerts list
 *   - Render patients requiring attention (high-risk + new alerts)
 *   - Render recent monitoring activity feed
 *   - Handle loading/error/empty states for every section
 *   - Support manual refresh without full page reload
 *
 * Does NOT:
 *   - Directly fetch any JSON file (all data via NeoCareData DAL)
 *   - Implement real-time polling / setInterval
 *   - Implement alert acknowledgement (Stage 8)
 *   - Implement patient management (Stage 6)
 *
 * Depends on (loaded before this file):
 *   - utils.js       (NeoCareUtils)
 *   - auth.js        (NeoCareAuth)
 *   - dataService.js (NeoCareData)
 *   - charts.js      (NeoCareCharts)
 *   - app.js         (shell init — auth guard, nav, logout)
 */

'use strict';

(function DashboardController() {

  /* ══════════════════════════════════════════
     STATE
  ══════════════════════════════════════════ */

  let _riskChart = null;      // Current Chart.js instance for risk doughnut
  let _isLoading  = false;    // Prevents concurrent refreshes

  /* ══════════════════════════════════════════
     GREETING
  ══════════════════════════════════════════ */

  /**
   * Returns "Good morning/afternoon/evening" based on hour.
   */
  function _timeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /**
   * Populates the dashboard header greeting using session/doctor data.
   * @param {object|null} doctor
   */
  function _renderGreeting(doctor) {
    const greetingEl = document.getElementById('dash-greeting');
    const nameEl     = document.getElementById('dash-greeting-name');
    if (!greetingEl || !nameEl) return;

    greetingEl.textContent = _timeGreeting() + ', ';

    // Use doctor profile name, fall back to session name, fall back to generic
    let name = 'Doctor';
    if (doctor && doctor.name) {
      name = doctor.name;
    } else if (typeof NeoCareAuth !== 'undefined') {
      const session = NeoCareAuth.getSession();
      if (session && session.name) name = session.name;
    }

    nameEl.textContent = name;
  }

  /* ══════════════════════════════════════════
     LAST UPDATED
  ══════════════════════════════════════════ */

  function _renderLastUpdated(patients) {
    const el = document.getElementById('dash-last-updated');
    if (!el) return;

    // Find the most recent lastUpdated from patients
    let latest = null;
    if (Array.isArray(patients) && patients.length > 0) {
      patients.forEach(p => {
        if (p.lastUpdated) {
          const d = new Date(p.lastUpdated);
          if (!latest || d > latest) latest = d;
        }
      });
    }

    if (latest) {
      el.textContent = latest.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      }) + ', ' + latest.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    } else {
      el.textContent = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    }
  }

  /* ══════════════════════════════════════════
     KPI CARDS
  ══════════════════════════════════════════ */

  function _setKpiLoading() {
    ['kpi-total', 'kpi-active', 'kpi-highrisk', 'kpi-alerts'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        el.classList.add('is-loading');
      }
    });
  }

  function _setKpiValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('is-loading');
    el.textContent = value;
  }

  function _renderKPIs(patients, alerts) {
    const total      = patients.length;
    const active     = patients.filter(p => p.monitoringStatus === 'Active').length;
    const highRisk   = patients.filter(p => p.riskStatus === 'High').length;
    const newAlerts  = alerts.filter(a => a.status === 'New').length;

    _setKpiValue('kpi-total',    total);
    _setKpiValue('kpi-active',   active);
    _setKpiValue('kpi-highrisk', highRisk);
    _setKpiValue('kpi-alerts',   newAlerts);
  }

  /* ══════════════════════════════════════════
     RISK DISTRIBUTION CHART
  ══════════════════════════════════════════ */

  function _renderRiskChart(patients) {
    const low      = patients.filter(p => p.riskStatus === 'Low').length;
    const moderate = patients.filter(p => p.riskStatus === 'Moderate').length;
    const high     = patients.filter(p => p.riskStatus === 'High').length;
    const total    = patients.length;

    // Center label: total patients
    const centerVal = document.getElementById('chart-center-value');
    const centerSub = document.getElementById('chart-center-sub');
    if (centerVal) centerVal.textContent = total;
    if (centerSub) centerSub.textContent = 'patients';

    // Legend counts
    const setLegend = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setLegend('legend-low',      low);
    setLegend('legend-moderate', moderate);
    setLegend('legend-high',     high);

    // Destroy previous chart instance if exists (safe refresh)
    if (_riskChart) {
      NeoCareCharts.destroyChart(_riskChart);
      _riskChart = null;
    }

    if (total === 0) {
      const el = document.getElementById('chart-wrap');
      if (el) el.innerHTML = '<p class="chart-empty">No patient data available.</p>';
      return;
    }

    _riskChart = NeoCareCharts.createDoughnutChart('risk-chart', {
      labels: ['Low', 'Moderate', 'High'],
      values: [low, moderate, high],
    });
  }

  /* ══════════════════════════════════════════
     RECENT ALERTS
  ══════════════════════════════════════════ */

  /**
   * Returns a patient name for a given patientId by looking up from patients array.
   * @param {string} patientId
   * @param {object[]} patients
   */
  function _patientName(patientId, patients) {
    const p = patients.find(pt => pt.patientId === patientId);
    return p ? p.name : patientId;
  }

  function _renderRecentAlerts(alerts, patients) {
    const container = document.getElementById('recent-alerts-list');
    if (!container) return;

    // Already sorted newest-first by DAL
    const recent = alerts.slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = '<p class="alerts-empty">No recent alerts.</p>';
      return;
    }

    container.innerHTML = recent.map(alert => {
      const name     = _patientName(alert.patientId, patients);
      const relTime  = typeof NeoCareUtils !== 'undefined'
        ? NeoCareUtils.formatRelativeTime(alert.timestamp)
        : '—';
      const severity = alert.severity || 'Info';

      return `
        <div class="alert-item" role="listitem">
          <span class="alert-severity-dot alert-severity-dot--${severity}" aria-hidden="true"></span>
          <div class="alert-content">
            <div class="alert-message" title="${_escHtml(alert.message)}">${_escHtml(alert.message)}</div>
            <div class="alert-meta">
              <span class="alert-patient">${_escHtml(name)}</span>
              <span class="alert-sep" aria-hidden="true"></span>
              <span class="alert-time">${relTime}</span>
            </div>
          </div>
          <span class="alert-badge alert-badge--${severity}" aria-label="${severity} severity">${severity}</span>
        </div>
      `;
    }).join('');
  }

  /* ══════════════════════════════════════════
     PATIENTS REQUIRING ATTENTION
  ══════════════════════════════════════════ */

  /**
   * Builds the attention patient list.
   * Priority: High risk first, then patients with New Warning/Critical alerts.
   * Deterministic tie-breaker: patientId alphabetical.
   */
  function _buildAttentionList(patients, alerts) {
    const newAlertPids = new Set(
      alerts
        .filter(a => a.status === 'New' && (a.severity === 'Critical' || a.severity === 'Warning'))
        .map(a => a.patientId)
    );

    let attention = patients.filter(p =>
      p.riskStatus === 'High' || newAlertPids.has(p.patientId)
    );

    // Sort: High first, then Moderate, then alphabetically by ID
    const riskOrder = { High: 0, Moderate: 1, Low: 2 };
    attention.sort((a, b) => {
      const rDiff = (riskOrder[a.riskStatus] ?? 9) - (riskOrder[b.riskStatus] ?? 9);
      if (rDiff !== 0) return rDiff;
      return a.patientId.localeCompare(b.patientId);
    });

    return attention;
  }

  function _renderAttentionTable(patients, alerts) {
    const tableBody  = document.getElementById('attention-tbody');
    const mobileWrap = document.getElementById('attention-mobile');
    const emptyEl    = document.getElementById('attention-empty');

    const list = _buildAttentionList(patients, alerts);

    if (emptyEl)  emptyEl.hidden  = list.length > 0;
    if (tableBody) tableBody.innerHTML = '';
    if (mobileWrap) mobileWrap.innerHTML = '';

    if (list.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    // Desktop table rows
    if (tableBody) {
      tableBody.innerHTML = list.map(p => {
        const updatedTime = typeof NeoCareUtils !== 'undefined'
          ? NeoCareUtils.formatTime(p.lastUpdated)
          : '—';
        const weekText = `${p.pregnancyWeek} wks`;
        const detailUrl = `patient-details.html?id=${encodeURIComponent(p.patientId)}`;

        return `
          <tr>
            <td>
              <div class="pt-name">${_escHtml(p.name)}</div>
              <div class="pt-id">${_escHtml(p.patientId)}</div>
            </td>
            <td>${weekText}</td>
            <td><span class="risk-badge risk-badge--${p.riskStatus}">${p.riskStatus}</span></td>
            <td>
              <span class="status-badge">
                <span class="status-dot status-dot--${p.monitoringStatus}" aria-hidden="true"></span>
                ${p.monitoringStatus}
              </span>
            </td>
            <td>${updatedTime}</td>
            <td>
              <a class="view-btn" href="${detailUrl}" aria-label="View ${_escHtml(p.name)}'s details">
                View
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                     stroke-linejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Mobile patient cards
    if (mobileWrap) {
      mobileWrap.innerHTML = list.map(p => {
        const updatedTime = typeof NeoCareUtils !== 'undefined'
          ? NeoCareUtils.formatTime(p.lastUpdated)
          : '—';
        const detailUrl = `patient-details.html?id=${encodeURIComponent(p.patientId)}`;

        return `
          <div class="pt-card">
            <div class="pt-card-header">
              <div>
                <div class="pt-name">${_escHtml(p.name)}</div>
                <div class="pt-id">${_escHtml(p.patientId)} · ${p.pregnancyWeek} weeks</div>
              </div>
              <span class="risk-badge risk-badge--${p.riskStatus}">${p.riskStatus}</span>
            </div>
            <div class="pt-card-row">
              <span class="pt-card-key">Monitoring</span>
              <span class="status-badge">
                <span class="status-dot status-dot--${p.monitoringStatus}" aria-hidden="true"></span>
                ${p.monitoringStatus}
              </span>
            </div>
            <div class="pt-card-row">
              <span class="pt-card-key">Last Updated</span>
              <span class="pt-card-val">${updatedTime}</span>
            </div>
            <a class="view-btn" href="${detailUrl}" aria-label="View ${_escHtml(p.name)}'s details">
              View Patient
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </a>
          </div>
        `;
      }).join('');
    }
  }

  /* ══════════════════════════════════════════
     RECENT MONITORING ACTIVITY
  ══════════════════════════════════════════ */

  /**
   * Builds an activity feed from the most recent sensor readings
   * across all high-attention patients.
   *
   * Data is derived purely from existing sensor readings —
   * no events are invented.
   */
  async function _renderActivity(patients) {
    const container = document.getElementById('activity-list');
    if (!container) return;

    container.innerHTML = '<p class="activity-empty">Loading activity…</p>';

    // Collect one most-recent reading per patient from high-attention set
    // (limit to first 6 patients to keep it lightweight)
    const priorityPatients = patients
      .filter(p => p.riskStatus === 'High' || p.monitoringStatus === 'Active')
      .slice(0, 6);

    const activities = [];

    for (const patient of priorityPatients) {
      try {
        const readings = await NeoCareData.getReadings(patient.patientId, 'all');
        if (readings && readings.length > 0) {
          // Most recent reading
          const latest = readings[readings.length - 1];
          activities.push({
            patientId:  patient.patientId,
            name:       patient.name,
            timestamp:  latest.timestamp,
            maternalHR: latest.maternalHeartRate,
            fetalHR:    latest.fetalHeartRate,
            spo2:       latest.spo2,
          });
        }
      } catch {
        // Skip patient if readings unavailable
      }
    }

    if (activities.length === 0) {
      container.innerHTML = '<p class="activity-empty">No recent monitoring data available.</p>';
      return;
    }

    // Sort newest first
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const SENSOR_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>`;

    container.innerHTML = activities.map(act => {
      const relTime = typeof NeoCareUtils !== 'undefined'
        ? NeoCareUtils.formatRelativeTime(act.timestamp)
        : '—';

      return `
        <div class="activity-item" role="listitem">
          <div class="activity-icon" aria-hidden="true">${SENSOR_ICON}</div>
          <div class="activity-content">
            <div class="activity-title">${_escHtml(act.name)}</div>
            <div class="activity-sub">
              MHR ${act.maternalHR} bpm · FHR ${act.fetalHR} bpm · SpO₂ ${act.spo2}%
            </div>
          </div>
          <div class="activity-time">${relTime}</div>
        </div>
      `;
    }).join('');
  }

  /* ══════════════════════════════════════════
     LOAD ALL DASHBOARD DATA
  ══════════════════════════════════════════ */

  async function _loadDashboard() {
    if (_isLoading) return;
    _isLoading = true;

    // Put KPI cards in loading state immediately
    _setKpiLoading();

    // Start refresh button loading state
    const refreshBtn = document.getElementById('dash-refresh-btn');
    if (refreshBtn) refreshBtn.classList.add('is-loading');

    try {
      // Load patients, alerts, doctor profile concurrently
      const [patients, alerts, doctor] = await Promise.all([
        NeoCareData.getPatients(),
        NeoCareData.getAlerts(),
        NeoCareData.getDoctorProfile().catch(() => null),
      ]);

      // Greeting + header
      _renderGreeting(doctor);
      _renderLastUpdated(patients);

      // KPI cards
      _renderKPIs(patients, alerts);

      // Risk chart
      _renderRiskChart(patients);

      // Recent alerts
      _renderRecentAlerts(alerts, patients);

      // Patients requiring attention
      _renderAttentionTable(patients, alerts);

      // Recent monitoring activity (async, non-blocking)
      _renderActivity(patients).catch(() => {
        const el = document.getElementById('activity-list');
        if (el) el.innerHTML = '<p class="activity-empty">Unable to load monitoring activity.</p>';
      });

    } catch (err) {
      // Show error on KPI cards — do not expose raw error
      ['kpi-total', 'kpi-active', 'kpi-highrisk', 'kpi-alerts'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('is-loading');
          el.textContent = '—';
        }
      });
      // Show error on alerts section
      const alertsEl = document.getElementById('recent-alerts-list');
      if (alertsEl) alertsEl.innerHTML = '<p class="alerts-error">Unable to load data. Please refresh.</p>';

      console.warn('[DashboardController] Data load failed:', err.message);
    } finally {
      _isLoading = false;
      if (refreshBtn) refreshBtn.classList.remove('is-loading');
    }
  }

  /* ══════════════════════════════════════════
     REFRESH BUTTON
  ══════════════════════════════════════════ */

  function _initRefreshButton() {
    const btn = document.getElementById('dash-refresh-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      if (_isLoading) return;
      await _loadDashboard();
    });
  }

  /* ══════════════════════════════════════════
     UTILITY — HTML ESCAPE
  ══════════════════════════════════════════ */

  function _escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */

  function _init() {
    _initRefreshButton();
    _loadDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
