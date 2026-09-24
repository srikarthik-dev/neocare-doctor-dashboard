/**
 * NEOCARE Doctor Dashboard — Monitoring Controller
 * ──────────────────────────────────────────────────
 * Stage 7: Patient Monitoring page controller.
 *
 * Responsibilities:
 *   - Patient selection with live data refresh
 *   - Current vitals display (Maternal HR, BP, SpO₂, Temp, Fetal HR)
 *   - Historical trend chart (Maternal HR + Fetal HR) with range tabs
 *   - Recent sensor readings table (latest 10)
 *   - Patient alert summary
 *   - Patient status panel
 *   - Controlled DEMO simulation (start / pause / reset)
 *
 * DEMO NOTICE:
 *   All readings are entirely synthetic/algorithmically generated.
 *   No real clinical thresholds are applied.
 *   Simulation is NOT real-time medical monitoring.
 *   This module does NOT constitute a medical device.
 *
 * Data access: exclusively via NeoCareData DAL.
 * No direct fetch() calls to JSON files.
 *
 * Depends on (loaded before this file):
 *   utils.js       (NeoCareUtils)
 *   auth.js        (NeoCareAuth)
 *   dataService.js (NeoCareData)
 *   charts.js      (NeoCareCharts)
 *   app.js         (AppShell)
 *   Chart.js CDN
 */

'use strict';

(function MonitoringController() {

  /* ══════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════ */

  /** Simulation tick interval in milliseconds. */
  const SIM_INTERVAL_MS  = 4000;

  /** Maximum number of simulated points kept on the chart. */
  const MAX_SIM_POINTS   = 40;

  /** Maximum readings rows to display in the table. */
  const MAX_READINGS_ROWS = 10;

  /** Default chart time range. */
  const DEFAULT_RANGE    = 'all';

  /* ══════════════════════════════════════════
     MUTABLE STATE
  ══════════════════════════════════════════ */

  /** Currently selected patient object (from DAL). */
  let _patient     = null;

  /** All patients list (for selector). */
  let _patients    = [];

  /** Historical sensor readings for the current patient. */
  let _readings    = [];

  /** Original synthetic readings snapshot (for reset). */
  let _origReadings = [];

  /** Alert list for the current patient. */
  let _alerts      = [];

  /** Active Chart.js instance. */
  let _chart       = null;

  /** Simulation interval handle. null when stopped. */
  let _simTimer    = null;

  /** Whether the simulation is currently running. */
  let _simRunning  = false;

  /** Simulated readings appended during live session (temp only). */
  let _simReadings  = [];

  /** Current vital values shown in cards. */
  let _currentVitals = null;

  /** Currently selected chart range key. */
  let _currentRange  = DEFAULT_RANGE;

  /* ══════════════════════════════════════════
     HTML ESCAPE HELPER
  ══════════════════════════════════════════ */

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ══════════════════════════════════════════
     DOM REFERENCES
  ══════════════════════════════════════════ */

  const _el = {
    /* Selector */
    patientSelect:  document.getElementById('mon-patient-select'),
    patientStrip:   document.getElementById('mon-patient-strip'),

    /* Content zones */
    initState:      document.getElementById('mon-init-state'),
    mainContent:    document.getElementById('mon-main-content'),
    loadingOverlay: document.getElementById('mon-loading-overlay'),

    /* Vitals */
    vitHR:   document.getElementById('mon-vit-hr'),
    vitBP:   document.getElementById('mon-vit-bp'),
    vitSpO2: document.getElementById('mon-vit-spo2'),
    vitTemp: document.getElementById('mon-vit-temp'),
    vitFHR:  document.getElementById('mon-vit-fhr'),

    /* Simulation controls */
    btnStart:   document.getElementById('mon-btn-start'),
    btnPause:   document.getElementById('mon-btn-pause'),
    btnReset:   document.getElementById('mon-btn-reset'),
    btnRefresh: document.getElementById('mon-btn-refresh'),
    simState:   document.getElementById('mon-sim-state'),
    simDot:     document.getElementById('mon-sim-dot'),
    simLabel:   document.getElementById('mon-sim-label'),
    timestamp:  document.getElementById('mon-timestamp'),

    /* Chart */
    chartCanvas:  document.getElementById('mon-chart-canvas'),
    chartWrap:    document.getElementById('mon-chart-wrap'),
    rangeBtns:    document.querySelectorAll('.mon-range-btn'),

    /* Readings */
    readingsContainer: document.getElementById('mon-readings-container'),

    /* Alerts */
    alertsContainer: document.getElementById('mon-alerts-container'),

    /* Status panel */
    statusMonitoring: document.getElementById('mon-status-monitoring'),
    statusRisk:       document.getElementById('mon-status-risk'),
    statusLastRead:   document.getElementById('mon-status-last-read'),
    statusDataSource: document.getElementById('mon-status-data-source'),
    statusPregWeek:   document.getElementById('mon-status-preg-week'),
  };

  /* ══════════════════════════════════════════
     SIMULATION: GENERATE DEMO VARIATION
     Small bounded perturbation of the latest reading.
     Does NOT invent new clinical state.
  ══════════════════════════════════════════ */

  /**
   * Generates a small demo variation from a baseline reading.
   * Values are clamped to remain plausible relative to the baseline.
   *
   * @param {object} baseline - A sensor reading object.
   * @returns {object} New simulated reading (not persisted anywhere).
   */
  function _generateSimReading(baseline) {
    function jitter(val, range) {
      return +(val + (Math.random() * range * 2 - range)).toFixed(1);
    }
    return {
      timestamp:        new Date().toISOString(),
      maternalHeartRate: jitter(baseline.maternalHeartRate, 2),
      systolicBP:        jitter(baseline.systolicBP, 2),
      diastolicBP:       jitter(baseline.diastolicBP, 1),
      spo2:              jitter(baseline.spo2, 0.5),
      temperature:       jitter(baseline.temperature, 0.1),
      fetalHeartRate:    jitter(baseline.fetalHeartRate, 3),
      _simulated:        true,
    };
  }

  /* ══════════════════════════════════════════
     VITAL CARD RENDERING
  ══════════════════════════════════════════ */

  /**
   * Updates all five vital cards with the given values.
   *
   * @param {object} vitals  - Vitals object from patient.vitals or a reading.
   * @param {boolean} isSimulated - Whether to show the SIMULATED tag.
   */
  function _renderVitals(vitals, isSimulated = false) {
    if (!vitals) return;
    _currentVitals = vitals;

    const simTag = isSimulated
      ? '<span class="mon-vital-sim-tag" aria-label="Simulated value">SIM</span>'
      : '';

    const bp = `${vitals.systolicBP ?? '—'}/${vitals.diastolicBP ?? '—'}`;

    // Maternal Heart Rate
    if (_el.vitHR) {
      _el.vitHR.innerHTML = `
        <span class="mon-vital-num">${vitals.maternalHeartRate ?? '—'}</span>
        <span class="mon-vital-unit">bpm</span>${simTag}`;
    }
    // Blood Pressure
    if (_el.vitBP) {
      _el.vitBP.innerHTML = `
        <span class="mon-vital-num">${_esc(bp)}</span>
        <span class="mon-vital-unit">mmHg</span>${simTag}`;
    }
    // SpO₂
    if (_el.vitSpO2) {
      _el.vitSpO2.innerHTML = `
        <span class="mon-vital-num">${vitals.spo2 ?? '—'}</span>
        <span class="mon-vital-unit">%</span>${simTag}`;
    }
    // Temperature
    if (_el.vitTemp) {
      _el.vitTemp.innerHTML = `
        <span class="mon-vital-num">${vitals.temperature ?? '—'}</span>
        <span class="mon-vital-unit">°C</span>${simTag}`;
    }
    // Fetal Heart Rate
    if (_el.vitFHR) {
      _el.vitFHR.innerHTML = `
        <span class="mon-vital-num">${vitals.fetalHeartRate ?? '—'}</span>
        <span class="mon-vital-unit">bpm</span>${simTag}`;
    }
  }

  /* ══════════════════════════════════════════
     TREND CHART
  ══════════════════════════════════════════ */

  /**
   * Builds the chart dataset from the combined original+sim readings.
   * Applies a time range filter matching the selected range button.
   *
   * @param {object[]} readings
   * @param {string}   range  - 'all' | '6h' | '12h' | '24h' | '48h'
   * @returns {{ labels: string[], maternal: number[], fetal: number[] }}
   */
  function _buildChartData(readings, range) {
    let filtered = [...readings];

    if (range && range !== 'all') {
      const hours = { '6h': 6, '12h': 12, '24h': 24, '48h': 48 }[range];
      if (hours) {
        const cutoff = new Date(Date.now() - hours * 3600 * 1000);
        const rangeFiltered = filtered.filter(r => new Date(r.timestamp) >= cutoff);
        // If range filter yields nothing, show all available (never fabricate)
        filtered = rangeFiltered.length > 0 ? rangeFiltered : filtered;
      }
    }

    // Sort oldest first for charting
    filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const labels  = filtered.map(r => NeoCareUtils.formatTime(r.timestamp));
    const maternal = filtered.map(r => r.maternalHeartRate);
    const fetal    = filtered.map(r => r.fetalHeartRate);
    return { labels, maternal, fetal };
  }

  /**
   * Destroys the existing chart (if any) and creates a new one.
   */
  function _renderChart() {
    if (_chart) {
      NeoCareCharts.destroyChart(_chart);
      _chart = null;
    }
    if (!_el.chartCanvas) return;
    if (typeof Chart === 'undefined') return;

    const allReadings = [..._readings, ..._simReadings];
    const { labels, maternal, fetal } = _buildChartData(allReadings, _currentRange);

    _chart = NeoCareCharts.createLineChart('mon-chart-canvas', {
      labels,
      datasets: [
        {
          label:            'Maternal HR (bpm)',
          data:             maternal,
          borderColor:      NeoCareCharts.PALETTE.critical,
          backgroundColor:  'rgba(220,38,38,0.08)',
          borderWidth:      2,
          fill:             true,
          pointRadius:      2,
          pointHoverRadius: 4,
        },
        {
          label:            'Fetal HR (bpm)',
          data:             fetal,
          borderColor:      NeoCareCharts.PALETTE.accent,
          backgroundColor:  'rgba(20,184,166,0.08)',
          borderWidth:      2,
          fill:             true,
          pointRadius:      2,
          pointHoverRadius: 4,
        },
      ],
    }, {
      chartOptions: {
        plugins: {
          legend: {
            display:  true,
            position: 'top',
            labels:   { boxWidth: 12, padding: 12, font: { size: 11 } },
          },
        },
        scales: {
          y: { suggestedMin: 50, suggestedMax: 180 },
        },
        maintainAspectRatio: false,
      },
    });
  }

  /**
   * Appends a new simulated reading to the chart without full redraw.
   * Keeps the chart bounded to MAX_SIM_POINTS of simulated data.
   *
   * @param {object} reading
   */
  function _appendSimPointToChart(reading) {
    if (!_chart) return;
    const ds    = _chart.data.datasets;
    const label = NeoCareUtils.formatTime(reading.timestamp);

    _chart.data.labels.push(label);
    ds[0].data.push(reading.maternalHeartRate);
    ds[1].data.push(reading.fetalHeartRate);

    // Trim from the front if too many points
    const totalPoints = _chart.data.labels.length;
    const origLen     = _readings.length;
    if (totalPoints > origLen + MAX_SIM_POINTS) {
      _chart.data.labels.shift();
      ds[0].data.shift();
      ds[1].data.shift();
    }

    _chart.update('none'); // skip animation for live append
  }

  /* ══════════════════════════════════════════
     READINGS TABLE
  ══════════════════════════════════════════ */

  /**
   * Renders the readings table from combined historical + simulated rows.
   * Shows latest MAX_READINGS_ROWS rows, newest first.
   */
  function _renderReadings() {
    if (!_el.readingsContainer) return;

    const combined = [..._readings, ..._simReadings]
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, MAX_READINGS_ROWS);

    if (combined.length === 0) {
      _el.readingsContainer.innerHTML = `
        <div class="mon-empty-inline">No sensor readings available for this patient.</div>`;
      return;
    }

    const rows = combined.map(r => {
      const isSim = r._simulated ? 'is-simulated' : '';
      const ts    = NeoCareUtils.formatTime(r.timestamp);
      const bp    = `${r.systolicBP ?? '—'}/${r.diastolicBP ?? '—'}`;
      return `<tr class="${_esc(isSim)}" aria-label="${isSim ? 'Simulated reading' : 'Sensor reading'} at ${_esc(ts)}">
        <td>${_esc(ts)}</td>
        <td>${r.maternalHeartRate ?? '—'}</td>
        <td>${_esc(bp)}</td>
        <td>${r.spo2 ?? '—'}</td>
        <td>${r.temperature ?? '—'}</td>
        <td>${r.fetalHeartRate ?? '—'}</td>
      </tr>`;
    }).join('');

    _el.readingsContainer.innerHTML = `
      <div class="mon-readings-wrap" role="region" aria-label="Recent sensor readings">
        <table class="mon-readings-table" aria-label="Sensor readings table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Maternal HR</th>
              <th scope="col">BP (mmHg)</th>
              <th scope="col">SpO₂ (%)</th>
              <th scope="col">Temp (°C)</th>
              <th scope="col">Fetal HR</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  /* ══════════════════════════════════════════
     ALERT SUMMARY
  ══════════════════════════════════════════ */

  function _renderAlerts() {
    if (!_el.alertsContainer) return;

    if (!_alerts || _alerts.length === 0) {
      _el.alertsContainer.innerHTML = `
        <div class="mon-empty-inline">No alerts for this patient.</div>`;
      return;
    }

    const severityOrder = { Critical: 0, Warning: 1, Info: 2 };
    const sorted = [..._alerts].sort(
      (a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
    );

    const rows = sorted.slice(0, 6).map(alert => {
      const isAck    = alert.status === 'Acknowledged';
      const relTime  = NeoCareUtils.formatRelativeTime(alert.timestamp);
      return `
        <div class="mon-alert-row" role="listitem">
          <span class="mon-severity-dot mon-severity-dot--${_esc(alert.severity)}"
                title="${_esc(alert.severity)}" aria-label="${_esc(alert.severity)} severity"></span>
          <div class="mon-alert-body">
            <div class="mon-alert-msg">${_esc(alert.message)}</div>
            <div class="mon-alert-meta">${_esc(alert.sensor ?? '')} · ${_esc(relTime)}</div>
          </div>
          ${isAck
            ? '<span class="mon-alert-ack" aria-label="Acknowledged">Acknowledged</span>'
            : ''}
        </div>`;
    }).join('');

    _el.alertsContainer.innerHTML = `
      <div class="mon-alert-list" role="list" aria-label="Patient alerts">${rows}</div>`;
  }

  /* ══════════════════════════════════════════
     PATIENT STATUS PANEL
  ══════════════════════════════════════════ */

  function _renderStatusPanel() {
    if (!_patient) return;

    const lastReading = _readings.length > 0
      ? _readings[_readings.length - 1]
      : null;

    const lastReadTs = lastReading
      ? NeoCareUtils.formatRelativeTime(lastReading.timestamp)
      : 'No readings';

    if (_el.statusMonitoring) {
      _el.statusMonitoring.innerHTML = `
        <span class="mon-status-badge mon-status-badge--${_esc(_patient.monitoringStatus)}">
          <span class="mon-status-dot mon-status-dot--${_esc(_patient.monitoringStatus)}"></span>
          ${_esc(_patient.monitoringStatus)}
        </span>`;
    }

    if (_el.statusRisk) {
      _el.statusRisk.innerHTML = `
        <span class="mon-risk-badge mon-risk-badge--${_esc(_patient.riskStatus)}">
          ${_esc(_patient.riskStatus)} Risk
        </span>`;
    }

    if (_el.statusLastRead)   _el.statusLastRead.textContent   = lastReadTs;
    if (_el.statusDataSource) _el.statusDataSource.textContent = 'Synthetic demo data';
    if (_el.statusPregWeek)   _el.statusPregWeek.textContent   =
      `Week ${_patient.pregnancyWeek ?? '—'}`;
  }

  /* ══════════════════════════════════════════
     PATIENT STRIP (summary bar)
  ══════════════════════════════════════════ */

  function _renderPatientStrip() {
    if (!_patient || !_el.patientStrip) return;

    const initials = typeof NeoCareUtils !== 'undefined'
      ? NeoCareUtils.getInitials(_patient.name)
      : (_patient.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    _el.patientStrip.removeAttribute('hidden');
    _el.patientStrip.innerHTML = `
      <div class="mon-patient-avatar mon-patient-avatar--${_esc(_patient.riskStatus)}"
           aria-hidden="true">${_esc(initials)}</div>
      <div class="mon-patient-info">
        <div class="mon-patient-name">${_esc(_patient.name)}</div>
        <div class="mon-patient-meta">
          ${_esc(_patient.patientId)} · ${_patient.age ?? '—'} yrs ·
          Week ${_patient.pregnancyWeek ?? '—'}
        </div>
      </div>
      <div class="mon-patient-badges">
        <span class="mon-status-badge mon-status-badge--${_esc(_patient.monitoringStatus)}"
              aria-label="Monitoring status: ${_esc(_patient.monitoringStatus)}">
          <span class="mon-status-dot mon-status-dot--${_esc(_patient.monitoringStatus)}"
                aria-hidden="true"></span>
          ${_esc(_patient.monitoringStatus)}
        </span>
        <span class="mon-risk-badge mon-risk-badge--${_esc(_patient.riskStatus)}"
              aria-label="Risk: ${_esc(_patient.riskStatus)}">
          ${_esc(_patient.riskStatus)} Risk
        </span>
      </div>`;
  }

  /* ══════════════════════════════════════════
     SIMULATION STATE UI
  ══════════════════════════════════════════ */

  function _updateSimUI() {
    if (!_el.simState) return;

    if (_simRunning) {
      _el.simState.className = 'mon-sim-state mon-sim-state--live';
      _el.simLabel.textContent = 'SIMULATION';
      _el.simState.setAttribute('aria-label', 'Simulation running — SIMULATED data');
    } else {
      _el.simState.className = 'mon-sim-state mon-sim-state--paused';
      _el.simLabel.textContent = 'PAUSED';
      _el.simState.setAttribute('aria-label', 'Simulation paused');
    }

    // Button disabled states
    const hasPatient = !!_patient;
    if (_el.btnStart) _el.btnStart.disabled   = !hasPatient || _simRunning;
    if (_el.btnPause) _el.btnPause.disabled   = !hasPatient || !_simRunning;
    if (_el.btnReset) _el.btnReset.disabled   = !hasPatient;
    if (_el.btnRefresh) _el.btnRefresh.disabled = false;

    _updateTimestamp();
  }

  function _updateTimestamp() {
    if (_el.timestamp) {
      _el.timestamp.textContent =
        `Updated: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
    }
  }

  /* ══════════════════════════════════════════
     SIMULATION: START / PAUSE / RESET
  ══════════════════════════════════════════ */

  function _startSim() {
    if (_simRunning || !_patient) return;
    _simRunning = true;
    _updateSimUI();

    _simTimer = setInterval(() => {
      // Use the latest reading as baseline (real or sim)
      const allCurrent = [..._readings, ..._simReadings];
      const baseline   = allCurrent[allCurrent.length - 1];
      if (!baseline) return;

      const simReading = _generateSimReading(baseline);

      // Add to sim buffer (bounded)
      _simReadings.push(simReading);
      if (_simReadings.length > MAX_SIM_POINTS) {
        _simReadings.shift();
      }

      // Update vitals with sim tag
      _renderVitals(simReading, true);

      // Append point to chart
      _appendSimPointToChart(simReading);

      // Prepend row to readings table
      _renderReadings();

      _updateTimestamp();
    }, SIM_INTERVAL_MS);
  }

  function _pauseSim() {
    if (!_simRunning) return;
    _simRunning = false;
    if (_simTimer) {
      clearInterval(_simTimer);
      _simTimer = null;
    }
    _updateSimUI();
  }

  function _resetSim() {
    // Stop simulation
    _pauseSim();

    // Clear all simulated data
    _simReadings = [];

    // Restore original readings
    _readings = [..._origReadings];

    // Restore original vitals (from patient snapshot)
    if (_patient && _patient.vitals) {
      _renderVitals(_patient.vitals, false);
    }

    // Re-render chart with only synthetic data
    _renderChart();

    // Re-render readings table with only original data
    _renderReadings();

    _updateSimUI();
  }

  /* ══════════════════════════════════════════
     CLEANUP
  ══════════════════════════════════════════ */

  function _stopAndCleanup() {
    if (_simTimer) {
      clearInterval(_simTimer);
      _simTimer = null;
    }
    _simRunning = false;
    if (_chart) {
      NeoCareCharts.destroyChart(_chart);
      _chart = null;
    }
  }

  /* ══════════════════════════════════════════
     LOAD PATIENT DATA
  ══════════════════════════════════════════ */

  /**
   * Loads all data for the given patient ID and renders the page sections.
   * Stops any existing simulation first.
   *
   * @param {string} patientId
   */
  async function _loadPatientData(patientId) {
    // Stop existing simulation cleanly
    const wasRunning = _simRunning;
    _pauseSim();
    _simReadings = [];

    // Show loading overlay
    _setLoading(true);

    try {
      // Fetch patient, readings, and alerts concurrently
      const [patientResult, readingsResult, alertsResult] = await Promise.allSettled([
        NeoCareData.getPatientById(patientId),
        NeoCareData.getReadings(patientId, 'all'),
        NeoCareData.getAlerts({ patientId }),
      ]);

      if (patientResult.status === 'rejected' || !patientResult.value) {
        _showError(`Could not load patient ${_esc(patientId)}.`);
        return;
      }

      _patient      = patientResult.value;
      _readings     = readingsResult.status === 'fulfilled' ? (readingsResult.value || []) : [];
      _origReadings = [..._readings];
      _alerts       = alertsResult.status === 'fulfilled' ? (alertsResult.value || []) : [];

      // Render all sections
      _renderPatientStrip();

      // Vitals: prefer latest reading snapshot, fallback to patient.vitals
      const latestReading = _readings.length > 0
        ? _readings[_readings.length - 1]
        : null;
      _renderVitals(latestReading || _patient.vitals, false);

      _renderChart();
      _renderReadings();
      _renderAlerts();
      _renderStatusPanel();

      // Show main content, hide init state
      if (_el.initState) _el.initState.hidden = true;
      if (_el.mainContent) _el.mainContent.hidden = false;

      // Restart sim if it was running before patient switch
      if (wasRunning) _startSim();

    } catch (err) {
      console.error('[MonitoringController] Failed to load patient data:', err);
      _showError('Unable to load monitoring data. Please try again.');
    } finally {
      _setLoading(false);
      _updateSimUI();
    }
  }

  /* ══════════════════════════════════════════
     LOADING / ERROR STATES
  ══════════════════════════════════════════ */

  function _setLoading(on) {
    if (_el.loadingOverlay) {
      _el.loadingOverlay.hidden = !on;
    }
  }

  function _showError(msg) {
    _setLoading(false);
    if (_el.initState) {
      _el.initState.hidden = false;
      _el.initState.innerHTML = `
        <div class="mon-state-panel">
          <div class="mon-state-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="mon-state-title">Failed to load patient</p>
          <p class="mon-state-sub">${msg}</p>
          <button class="mon-btn mon-btn--reset" type="button" id="mon-error-retry">Retry</button>
        </div>`;
      const retryBtn = document.getElementById('mon-error-retry');
      if (retryBtn && _patient) {
        retryBtn.addEventListener('click', () => _loadPatientData(_patient.patientId));
      }
    }
    if (_el.mainContent) _el.mainContent.hidden = true;
  }

  /* ══════════════════════════════════════════
     POPULATE PATIENT SELECTOR
  ══════════════════════════════════════════ */

  async function _populateSelector() {
    if (!_el.patientSelect) return;

    try {
      _patients = await NeoCareData.getPatients();
    } catch (err) {
      console.error('[MonitoringController] Failed to load patients:', err);
      _patients = [];
    }

    // Build options sorted by name
    const sorted = [..._patients].sort((a, b) => a.name.localeCompare(b.name));

    const opts = sorted.map(p =>
      `<option value="${_esc(p.patientId)}">
        ${_esc(p.name)} (${_esc(p.patientId)}) · ${_esc(p.monitoringStatus)}
      </option>`
    ).join('');

    _el.patientSelect.innerHTML = `<option value="">— Select a patient —</option>${opts}`;
  }

  /* ══════════════════════════════════════════
     RANGE BUTTONS
  ══════════════════════════════════════════ */

  function _initRangeButtons() {
    _el.rangeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        _currentRange = btn.dataset.range || 'all';

        // Update aria-pressed state
        _el.rangeBtns.forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');

        // Re-render chart with new range
        if (_patient) _renderChart();
      });
    });

    // Activate default range button
    const defaultBtn = document.querySelector(`[data-range="${DEFAULT_RANGE}"]`);
    if (defaultBtn) {
      defaultBtn.classList.add('is-active');
      defaultBtn.setAttribute('aria-pressed', 'true');
    }
  }

  /* ══════════════════════════════════════════
     EVENT WIRING
  ══════════════════════════════════════════ */

  function _initEvents() {
    // Patient selector change
    if (_el.patientSelect) {
      _el.patientSelect.addEventListener('change', () => {
        const pid = _el.patientSelect.value;
        if (pid) {
          _loadPatientData(pid);
        } else {
          // Deselect — show init state
          _stopAndCleanup();
          _patient = null;
          _simReadings = [];
          if (_el.patientStrip) _el.patientStrip.setAttribute('hidden', '');
          if (_el.initState) _el.initState.hidden = false;
          if (_el.mainContent) _el.mainContent.hidden = true;
          _updateSimUI();
        }
      });
    }

    // Start simulation
    if (_el.btnStart) {
      _el.btnStart.addEventListener('click', () => {
        if (_patient) _startSim();
      });
    }

    // Pause simulation
    if (_el.btnPause) {
      _el.btnPause.addEventListener('click', _pauseSim);
    }

    // Reset
    if (_el.btnReset) {
      _el.btnReset.addEventListener('click', () => {
        if (_patient) _resetSim();
      });
    }

    // Refresh data
    if (_el.btnRefresh) {
      _el.btnRefresh.addEventListener('click', async () => {
        if (!_patient) return;
        _el.btnRefresh.disabled = true;
        const pid = _patient.patientId;
        // Stop sim, reload
        const wasRunning = _simRunning;
        _pauseSim();
        _simReadings = [];
        await _loadPatientData(pid);
        if (wasRunning) _startSim();
        _el.btnRefresh.disabled = false;
      });
    }

    // Range buttons
    _initRangeButtons();

    // Page unload: clean up timer and chart
    window.addEventListener('beforeunload', _stopAndCleanup);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) _pauseSim();
    });
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */

  async function _init() {
    // Populate the patient dropdown
    await _populateSelector();

    // Wire events
    _initEvents();

    // Set initial UI state (no patient selected)
    _updateSimUI();
    if (_el.patientStrip) _el.patientStrip.setAttribute('hidden', '');
    if (_el.mainContent)  _el.mainContent.hidden = true;
    if (_el.initState)    _el.initState.hidden = false;
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
