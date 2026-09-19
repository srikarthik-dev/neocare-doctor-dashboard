/**
 * NEOCARE Doctor Dashboard — Patient Details Page Controller
 * ───────────────────────────────────────────────────────────
 * Stage 6: Full patient details implementation.
 *
 * DEMO / SAFETY NOTICE:
 *   All patient data displayed is entirely synthetic.
 *   This page does not represent real patients, real clinical
 *   records, or real medical decisions. Portfolio prototype only.
 *   It does NOT constitute a certified medical device or
 *   clinical decision-support system.
 *
 * Data access: exclusively via NeoCareData DAL.
 *   No direct fetch() of data/*.json files.
 *
 * Dependencies (loaded before this file):
 *   utils.js, auth.js, dataService.js, charts.js, app.js
 *
 * URL parameter: ?id=P0001 (or any valid patientId)
 */

'use strict';

(function PatientDetailsController() {

  /* ══════════════════════════════════════════
     STATE
  ══════════════════════════════════════════ */

  let _patient     = null;
  let _readings    = [];
  let _alerts      = [];
  let _isLoading   = false;
  let _vitalChart  = null;     // Chart.js instance

  /* ══════════════════════════════════════════
     DOM HELPERS
  ══════════════════════════════════════════ */

  const $ = id => document.getElementById(id);
  const setText = (id, val) => {
    const el = $(id);
    if (el) el.textContent = val == null ? 'Not available' : String(val);
  };
  const setHtml = (id, html) => {
    const el = $(id);
    if (el) el.innerHTML = html;
  };
  const show = id => { const el = $(id); if (el) el.hidden = false; };
  const hide = id => { const el = $(id); if (el) el.hidden = true; };

  /* ══════════════════════════════════════════
     UTILITY — HTML escape
  ══════════════════════════════════════════ */

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _fmt(val, fallback = 'Not available') {
    return val == null ? fallback : String(val);
  }

  /* ══════════════════════════════════════════
     READ PATIENT ID FROM URL
  ══════════════════════════════════════════ */

  function getPatientIdFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get('id') || null;
    } catch {
      return null;
    }
  }

  /* ══════════════════════════════════════════
     AVATAR COLOR CLASS
  ══════════════════════════════════════════ */

  function _avatarClass(riskStatus) {
    if (riskStatus === 'High')     return 'patient-hero-avatar--high';
    if (riskStatus === 'Moderate') return 'patient-hero-avatar--moderate';
    return '';
  }

  /* ══════════════════════════════════════════
     SENSOR LABEL MAP
  ══════════════════════════════════════════ */

  const SENSOR_LABELS = {
    maternalHeartRate: 'Maternal Heart Rate',
    systolicBP:        'Systolic BP',
    diastolicBP:       'Diastolic BP',
    spo2:              'SpO₂',
    temperature:       'Temperature',
    fetalHeartRate:    'Fetal Heart Rate',
  };

  /* ══════════════════════════════════════════
     SHOW LOADING
  ══════════════════════════════════════════ */

  function showLoading() {
    hide('details-content');
    hide('error-panel');
    hide('missing-panel');
    show('loading-panel');
  }

  /* ══════════════════════════════════════════
     SHOW MISSING-ID STATE
  ══════════════════════════════════════════ */

  function showMissingId() {
    hide('loading-panel');
    hide('details-content');
    hide('error-panel');
    show('missing-panel');
    setHtml('missing-panel', `
      <div class="state-panel">
        <div class="state-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
               stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
        </div>
        <p class="state-title">Patient not specified</p>
        <p class="state-sub">Select a patient from the Patients page to view their details.</p>
        <a class="action-btn" href="patients.html">Back to Patients</a>
      </div>
    `);
  }

  /* ══════════════════════════════════════════
     SHOW NOT-FOUND STATE
  ══════════════════════════════════════════ */

  function showNotFound(patientId) {
    hide('loading-panel');
    hide('details-content');
    hide('missing-panel');
    show('error-panel');
    setHtml('error-panel', `
      <div class="state-panel">
        <div class="state-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
               stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <p class="state-title">Patient not found</p>
        <p class="state-sub">The requested patient (${_esc(patientId)}) could not be found in the demo dataset.</p>
        <a class="action-btn" href="patients.html">Back to Patients</a>
      </div>
    `);
  }

  /* ══════════════════════════════════════════
     SHOW LOAD ERROR
  ══════════════════════════════════════════ */

  function showLoadError(msg) {
    hide('loading-panel');
    hide('details-content');
    hide('missing-panel');
    show('error-panel');
    setHtml('error-panel', `
      <div class="state-panel">
        <div class="state-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
               stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p class="state-title">Unable to load patient</p>
        <p class="state-sub">Please try again.</p>
        <button class="action-btn" type="button" onclick="window.location.reload()">Retry</button>
        <a class="action-btn action-btn--secondary" href="patients.html" style="margin-top:8px">Back to Patients</a>
      </div>
    `);
  }

  /* ══════════════════════════════════════════
     RENDER PATIENT HERO HEADER
  ══════════════════════════════════════════ */

  function renderPatientHeader(patient) {
    const initials = typeof NeoCareUtils !== 'undefined'
      ? NeoCareUtils.getInitials(patient.name) : patient.name.slice(0,2).toUpperCase();
    const updTime  = typeof NeoCareUtils !== 'undefined'
      ? NeoCareUtils.formatRelativeTime(patient.lastUpdated)
      : '—';

    const heroEl = $('patient-hero');
    if (!heroEl) return;

    heroEl.innerHTML = `
      <div class="patient-hero-avatar ${_avatarClass(patient.riskStatus)}" aria-hidden="true">
        ${_esc(initials)}
      </div>
      <div class="patient-hero-info">
        <div class="patient-hero-name">${_esc(patient.name)}</div>
        <div class="patient-hero-meta">${_esc(patient.patientId)} &bull; ${patient.age} years</div>
        <div class="patient-hero-week">${patient.pregnancyWeek} weeks pregnant</div>
        <div class="patient-hero-badges">
          <span class="status-badge">
            <span class="status-dot status-dot--${_esc(patient.monitoringStatus)}" aria-hidden="true"></span>
            ${_esc(patient.monitoringStatus)}
          </span>
          <span class="risk-badge risk-badge--${_esc(patient.riskStatus)}">${_esc(patient.riskStatus)} Risk</span>
        </div>
      </div>
      <div class="patient-hero-actions">
        <div class="patient-hero-updated" aria-live="polite">
          <span style="font-size:var(--text-xs);color:var(--text-secondary);">Last updated</span><br/>
          <span style="font-size:var(--text-sm);font-weight:var(--font-medium)">${updTime}</span>
        </div>
        <button class="action-btn" id="refresh-btn" type="button" aria-label="Refresh patient data">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>
    `;

    // Wire refresh button (dynamically inserted)
    const refreshBtn = $('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => refreshPatient());
    }

    // Update page title
    document.title = `NEOCARE | ${patient.name}`;

    // Update topbar page title
    const topbarTitle = $('topbar-page-title-dyn');
    if (topbarTitle) topbarTitle.textContent = patient.name;
  }

  /* ══════════════════════════════════════════
     RENDER PREGNANCY INFO
  ══════════════════════════════════════════ */

  function renderPregnancyInfo(patient) {
    const edd = patient.expectedDeliveryDate
      ? new Date(patient.expectedDeliveryDate).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'long', year: 'numeric'
        })
      : 'Not available';
    const lastUpd = typeof NeoCareUtils !== 'undefined'
      ? NeoCareUtils.formatDate(patient.lastUpdated)
      : (patient.lastUpdated || 'Not available');

    setHtml('pregnancy-info-body', `
      <div class="info-row">
        <span class="info-key">Pregnancy Week</span>
        <span class="info-val">${patient.pregnancyWeek} weeks</span>
      </div>
      <div class="info-row">
        <span class="info-key">Expected Delivery</span>
        <span class="info-val">${_esc(edd)}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Monitoring Status</span>
        <span class="info-val">
          <span class="status-badge">
            <span class="status-dot status-dot--${_esc(patient.monitoringStatus)}" aria-hidden="true"></span>
            ${_esc(patient.monitoringStatus)}
          </span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-key">Risk Status</span>
        <span class="info-val">
          <span class="risk-badge risk-badge--${_esc(patient.riskStatus)}">${_esc(patient.riskStatus)}</span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-key">Last Updated</span>
        <span class="info-val">${_esc(lastUpd)}</span>
      </div>
    `);
  }

  /* ══════════════════════════════════════════
     RENDER CONTACT INFO
  ══════════════════════════════════════════ */

  function renderContactInfo(patient) {
    const contact = patient.contact || {};
    const phone   = contact.phone || null;
    const email   = contact.email || null;

    setHtml('contact-info-body', `
      <div class="info-row">
        <span class="info-key">Phone</span>
        <span class="info-val">${phone ? _esc(phone) : 'Not available'}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Email</span>
        <span class="info-val">${email ? _esc(email) : 'Not available'}</span>
      </div>
    `);
  }

  /* ══════════════════════════════════════════
     RENDER VITALS
  ══════════════════════════════════════════ */

  function renderVitals(patient) {
    const v = patient.vitals || {};
    const vitalsGrid = $('vitals-grid');
    if (!vitalsGrid) return;

    const bp = (v.systolicBP != null && v.diastolicBP != null)
      ? `${v.systolicBP} / ${v.diastolicBP}`
      : 'Not available';

    vitalsGrid.innerHTML = `
      <div class="vital-card">
        <div class="vital-label">Maternal Heart Rate</div>
        <div class="vital-value">${v.maternalHeartRate ?? '—'}<span class="vital-unit"> bpm</span></div>
        <div class="vital-sublabel">Latest reading</div>
      </div>
      <div class="vital-card">
        <div class="vital-label">Blood Pressure</div>
        <div class="vital-value" style="font-size:var(--text-xl)">${_esc(bp)}<span class="vital-unit"> mmHg</span></div>
        <div class="vital-sublabel">Systolic / Diastolic</div>
      </div>
      <div class="vital-card">
        <div class="vital-label">SpO₂</div>
        <div class="vital-value">${v.spo2 ?? '—'}<span class="vital-unit">%</span></div>
        <div class="vital-sublabel">Latest reading</div>
      </div>
      <div class="vital-card">
        <div class="vital-label">Temperature</div>
        <div class="vital-value">${v.temperature ?? '—'}<span class="vital-unit"> °C</span></div>
        <div class="vital-sublabel">Latest reading</div>
      </div>
      <div class="vital-card">
        <div class="vital-label">Fetal Heart Rate</div>
        <div class="vital-value">${v.fetalHeartRate ?? '—'}<span class="vital-unit"> bpm</span></div>
        <div class="vital-sublabel">Latest reading</div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════
     RENDER RECENT READINGS TABLE
  ══════════════════════════════════════════ */

  function renderReadings(readings) {
    const container = $('readings-container');
    if (!container) return;

    if (!readings || readings.length === 0) {
      container.innerHTML = '<div class="state-panel" style="min-height:120px"><p class="state-sub">No readings available.</p></div>';
      return;
    }

    // Show max 10 most-recent readings (newest first)
    const recent = [...readings].reverse().slice(0, 10);

    // Desktop table
    const tableHtml = `
      <div class="readings-table-wrap">
        <table class="readings-table" aria-label="Recent sensor readings for patient">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">MHR (bpm)</th>
              <th scope="col">BP (mmHg)</th>
              <th scope="col">SpO₂ (%)</th>
              <th scope="col">Temp (°C)</th>
              <th scope="col">FHR (bpm)</th>
            </tr>
          </thead>
          <tbody>
            ${recent.map(r => {
              const time = typeof NeoCareUtils !== 'undefined'
                ? NeoCareUtils.formatTime(r.timestamp)
                : '—';
              return `
                <tr>
                  <td>${_esc(time)}</td>
                  <td>${r.maternalHeartRate ?? '—'}</td>
                  <td>${r.systolicBP != null ? `${r.systolicBP}/${r.diastolicBP}` : '—'}</td>
                  <td>${r.spo2 ?? '—'}</td>
                  <td>${r.temperature ?? '—'}</td>
                  <td>${r.fetalHeartRate ?? '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHtml;
  }

  /* ══════════════════════════════════════════
     RENDER VITAL TREND CHART
  ══════════════════════════════════════════ */

  function renderVitalChart(readings) {
    const chartWrap = $('vital-chart-wrap');
    if (!chartWrap) return;

    if (!readings || readings.length === 0) {
      chartWrap.innerHTML = '<p class="state-sub" style="padding:var(--space-6);text-align:center">No readings available for chart.</p>';
      return;
    }

    // Destroy existing chart instance safely
    if (_vitalChart && typeof _vitalChart.destroy === 'function') {
      _vitalChart.destroy();
      _vitalChart = null;
    }

    // Use last 20 readings for chart clarity
    const recent = [...readings].slice(-20);

    const labels = recent.map(r => {
      const d = new Date(r.timestamp);
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    });

    const mhrData = recent.map(r => r.maternalHeartRate);
    const fhrData = recent.map(r => r.fetalHeartRate);

    // Inject canvas if not present
    chartWrap.innerHTML = `<div class="chart-container-pd"><canvas id="vital-chart-canvas" aria-label="Vital signs trend: Maternal and Fetal Heart Rate over time" role="img"></canvas></div>`;

    if (typeof Chart === 'undefined') {
      chartWrap.innerHTML = '<p class="state-sub" style="padding:var(--space-6);text-align:center">Chart.js not available.</p>';
      return;
    }

    const ctx = document.getElementById('vital-chart-canvas').getContext('2d');

    if (typeof NeoCareCharts !== 'undefined') {
      _vitalChart = NeoCareCharts.createLineChart('vital-chart-canvas', {
        labels,
        datasets: [
          {
            label: 'Maternal HR (bpm)',
            data: mhrData,
            borderColor: '#2F6FED',
            backgroundColor: 'rgba(47,111,237,0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            borderWidth: 2,
          },
          {
            label: 'Fetal HR (bpm)',
            data: fhrData,
            borderColor: '#14B8A6',
            backgroundColor: 'rgba(20,184,166,0.06)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            borderWidth: 2,
          },
        ],
      }, {
        chartOptions: {
          plugins: {
            legend: { display: true, position: 'top' },
          },
          scales: {
            y: { beginAtZero: false },
          },
        },
      });
    } else {
      // Fallback direct Chart.js usage
      _vitalChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Maternal HR (bpm)', data: mhrData, borderColor: '#2F6FED', backgroundColor: 'rgba(47,111,237,0.08)', fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2 },
            { label: 'Fetal HR (bpm)',    data: fhrData, borderColor: '#14B8A6', backgroundColor: 'rgba(20,184,166,0.06)', fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: true, position: 'top' } },
          scales: {
            x: { ticks: { maxRotation: 0 } },
            y: { beginAtZero: false },
          },
        },
      });
    }
  }

  /* ══════════════════════════════════════════
     RENDER ALERTS
  ══════════════════════════════════════════ */

  function renderAlerts(alerts) {
    const container = $('alerts-container');
    if (!container) return;

    _alerts = alerts;

    if (!alerts || alerts.length === 0) {
      container.innerHTML = '<div class="state-panel" style="min-height:100px"><p class="state-sub">No alerts recorded for this patient.</p></div>';
      return;
    }

    container.innerHTML = alerts.map(alert => {
      const relTime = typeof NeoCareUtils !== 'undefined'
        ? NeoCareUtils.formatRelativeTime(alert.timestamp)
        : '—';
      const sensorLabel = SENSOR_LABELS[alert.sensor] || alert.sensor || '—';
      const isNew = alert.status === 'New';

      return `
        <div class="alert-row" id="alert-row-${_esc(alert.alertId)}" role="listitem">
          <span class="severity-pill severity-pill--${_esc(alert.severity)}" aria-label="${_esc(alert.severity)} severity">
            ${_esc(alert.severity)}
          </span>
          <div class="alert-body">
            <div class="alert-msg">${_esc(alert.message)}</div>
            <div class="alert-detail">
              <span>${_esc(sensorLabel)}: ${_esc(String(alert.reading))}</span>
              <span>${relTime}</span>
            </div>
          </div>
          ${isNew
            ? `<button class="acknowledge-btn" type="button"
                 data-alert-id="${_esc(alert.alertId)}"
                 aria-label="Acknowledge alert: ${_esc(alert.message)}">
                 Acknowledge
               </button>`
            : `<span class="ack-badge" aria-label="Alert acknowledged">
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                      stroke-linejoin="round" aria-hidden="true">
                   <polyline points="20 6 9 17 4 12"/>
                 </svg>
                 Acknowledged
               </span>`
          }
        </div>
      `;
    }).join('');

    // Wire acknowledge buttons
    container.querySelectorAll('.acknowledge-btn').forEach(btn => {
      btn.addEventListener('click', () => handleAcknowledgeAlert(btn.dataset.alertId));
    });
  }

  /* ══════════════════════════════════════════
     HANDLE ALERT ACKNOWLEDGEMENT
  ══════════════════════════════════════════ */

  async function handleAcknowledgeAlert(alertId) {
    const btn = document.querySelector(`button[data-alert-id="${alertId}"]`);
    if (!btn) return;

    // Disable while processing
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      await NeoCareData.acknowledgeAlert(alertId);

      // Update in-memory state
      _alerts = _alerts.map(a =>
        a.alertId === alertId ? { ...a, status: 'Acknowledged' } : a
      );

      // Swap button → ack badge without full re-render
      const row = $(`alert-row-${alertId}`);
      if (row) {
        const oldBtn = row.querySelector('.acknowledge-btn');
        if (oldBtn) {
          const badge = document.createElement('span');
          badge.className = 'ack-badge';
          badge.setAttribute('aria-label', 'Alert acknowledged');
          badge.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                 stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Acknowledged
          `;
          oldBtn.replaceWith(badge);
        }
      }

      showToast('Alert acknowledged successfully.', 'success');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Acknowledge';
      showToast('Could not acknowledge alert. Please try again.', 'error');
      console.warn('[PatientDetailsController] acknowledgeAlert failed:', err.message);
    }
  }

  /* ══════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════ */

  function showToast(message, type = 'success') {
    let toast = $('nc-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'nc-toast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className   = `toast${type === 'success' ? ' toast--success' : ''}`;
    // Trigger animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('is-visible'));
    });
    setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  /* ══════════════════════════════════════════
     LOAD ALL PATIENT DETAILS
  ══════════════════════════════════════════ */

  async function loadPatientDetails() {
    if (_isLoading) return;
    _isLoading = true;

    const patientId = getPatientIdFromUrl();

    if (!patientId) {
      showMissingId();
      _isLoading = false;
      return;
    }

    showLoading();

    let patient;
    try {
      patient = await NeoCareData.getPatientById(patientId);
    } catch (err) {
      showLoadError(err.message);
      _isLoading = false;
      return;
    }

    if (!patient) {
      showNotFound(patientId);
      _isLoading = false;
      return;
    }

    _patient = patient;

    // Reveal content
    hide('loading-panel');
    hide('error-panel');
    hide('missing-panel');
    show('details-content');

    // Render patient-level sections (fast)
    renderPatientHeader(patient);
    renderPregnancyInfo(patient);
    renderContactInfo(patient);
    renderVitals(patient);

    // Load readings and alerts concurrently
    let readings = [];
    let alerts   = [];

    const readingsContainer = $('readings-container');
    const alertsContainer   = $('alerts-container');
    const chartWrap         = $('vital-chart-wrap');

    if (readingsContainer) readingsContainer.innerHTML = '<p class="state-sub" style="padding:var(--space-4);text-align:center;color:var(--text-secondary)">Loading readings…</p>';
    if (alertsContainer)   alertsContainer.innerHTML   = '<p class="state-sub" style="padding:var(--space-4);text-align:center;color:var(--text-secondary)">Loading alerts…</p>';
    if (chartWrap)         chartWrap.innerHTML          = '<p class="state-sub" style="padding:var(--space-4);text-align:center;color:var(--text-secondary)">Loading chart…</p>';

    const [readingsResult, alertsResult] = await Promise.allSettled([
      NeoCareData.getReadings(patientId, '24h'),
      NeoCareData.getAlerts({ patientId }),
    ]);

    // Readings — graceful failure
    if (readingsResult.status === 'fulfilled') {
      readings = readingsResult.value;
    } else {
      if (readingsContainer) readingsContainer.innerHTML = '<div class="state-panel" style="min-height:100px"><p class="state-sub">Unable to load readings.</p></div>';
      if (chartWrap)         chartWrap.innerHTML = '<p class="state-sub" style="padding:var(--space-4);text-align:center">Unable to load chart data.</p>';
      console.warn('[PatientDetailsController] getReadings failed:', readingsResult.reason?.message);
    }

    // Alerts — graceful failure
    if (alertsResult.status === 'fulfilled') {
      alerts = alertsResult.value;
    } else {
      if (alertsContainer) alertsContainer.innerHTML = '<div class="state-panel" style="min-height:100px"><p class="state-sub">Unable to load alerts.</p></div>';
      console.warn('[PatientDetailsController] getAlerts failed:', alertsResult.reason?.message);
    }

    if (readingsResult.status === 'fulfilled') {
      renderReadings(readings);
      renderVitalChart(readings);
    }

    if (alertsResult.status === 'fulfilled') {
      renderAlerts(alerts);
    }

    _isLoading = false;
  }

  /* ══════════════════════════════════════════
     REFRESH
  ══════════════════════════════════════════ */

  function refreshPatient() {
    // Reset state and reload
    _patient    = null;
    _readings   = [];
    _alerts     = [];
    loadPatientDetails();
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */

  function _init() {
    loadPatientDetails();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
