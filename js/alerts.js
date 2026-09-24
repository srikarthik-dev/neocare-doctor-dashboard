/**
 * NEOCARE Doctor Dashboard — Alerts Controller
 * ──────────────────────────────────────────────
 * Stage 8: Alerts page implementation.
 *
 * Responsibility:
 *   - Control the alerts page (pages/alerts.html).
 *   - Fetch all alerts from dataService.js.
 *   - Render alerts in table (desktop) and cards (mobile).
 *   - Implement client-side filtering by severity, status, search, and patient.
 *   - Implement alert acknowledgement via NeoCareData.acknowledgeAlert().
 *   - Display alert timestamp, patient name, and description.
 *   - Show an unread-alert badge count in the sidebar and topbar.
 *
 * DEMO NOTE:
 *   All alerts are synthetic. No real clinical alerts.
 */

'use strict';

(function AlertsController() {

  /* ══════════════════════════════════════════
     STATE
  ══════════════════════════════════════════ */
  let _allAlerts = [];
  let _allPatients = [];

  const _el = {
    // KPI Cards
    kpiTotal: document.getElementById('kpi-total'),
    kpiNew: document.getElementById('kpi-new'),
    kpiCritical: document.getElementById('kpi-critical'),
    kpiAcked: document.getElementById('kpi-acked'),

    // Filters
    search: document.getElementById('filter-search'),
    severity: document.getElementById('filter-severity'),
    status: document.getElementById('filter-status'),
    patient: document.getElementById('filter-patient'),
    btnClear: document.getElementById('btn-clear-filters'),
    btnRefresh: document.getElementById('btn-refresh'),

    // Content
    container: document.getElementById('alerts-container'),
    tableBody: document.getElementById('alerts-table-body'),
    mobileList: document.getElementById('alerts-mobile-list'),
    emptyState: document.getElementById('alerts-empty'),

    // Modal
    modalOverlay: document.getElementById('alert-modal'),
    modalBody: document.getElementById('modal-body-content'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnModalPatient: document.getElementById('modal-btn-patient'),
    btnModalAck: document.getElementById('modal-btn-ack')
  };

  let _currentModalAlertId = null;

  /* ══════════════════════════════════════════
     INITIALISATION
  ══════════════════════════════════════════ */
  async function init() {
    _initEvents();
    await loadData();
  }

  function _initEvents() {
    const debouncedFilter = NeoCareUtils.debounce(renderAlerts, 250);

    _el.search.addEventListener('input', debouncedFilter);
    _el.severity.addEventListener('change', renderAlerts);
    _el.status.addEventListener('change', renderAlerts);
    _el.patient.addEventListener('change', renderAlerts);

    _el.btnClear.addEventListener('click', () => {
      _el.search.value = '';
      _el.severity.value = 'All';
      _el.status.value = 'All';
      _el.patient.value = 'All';
      renderAlerts();
    });

    _el.btnRefresh.addEventListener('click', async () => {
      const btn = _el.btnRefresh;
      btn.disabled = true;
      btn.innerHTML = 'Refreshing...';
      await loadData();
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Refresh';
      btn.disabled = false;
    });

    _el.btnCloseModal.addEventListener('click', closeModal);
    _el.modalOverlay.addEventListener('click', (e) => {
      if (e.target === _el.modalOverlay) closeModal();
    });

    _el.btnModalAck.addEventListener('click', async () => {
      if (_currentModalAlertId) {
        await handleAcknowledge(_currentModalAlertId, true);
      }
    });

    // Close modal on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _el.modalOverlay.classList.contains('is-active')) {
        closeModal();
      }
    });
  }

  async function loadData() {
    try {
      const [alerts, patients] = await Promise.all([
        NeoCareData.getAlerts(),
        NeoCareData.getPatients()
      ]);
      _allAlerts = alerts;
      _allPatients = patients;

      populatePatientDropdown();
      renderAlerts();
      updateGlobalBadges();
    } catch (err) {
      console.error('[AlertsController] Failed to load data:', err);
      showErrorState();
    }
  }

  /* ══════════════════════════════════════════
     RENDERING
  ══════════════════════════════════════════ */

  function populatePatientDropdown() {
    const currentVal = _el.patient.value;
    let optionsHtml = '<option value="All">All Patients</option>';

    const sorted = [..._allPatients].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach(p => {
      optionsHtml += `<option value="${p.patientId}">${p.name} (${p.patientId})</option>`;
    });

    _el.patient.innerHTML = optionsHtml;
    if (currentVal && currentVal !== 'All' && _allPatients.some(p => p.patientId === currentVal)) {
      _el.patient.value = currentVal;
    }
  }

  function getPatientName(patientId) {
    const p = _allPatients.find(p => p.patientId === patientId);
    return p ? p.name : 'Unknown Patient';
  }

  function updateKPIs() {
    const total = _allAlerts.length;
    const newCount = _allAlerts.filter(a => a.status === 'New').length;
    const criticalCount = _allAlerts.filter(a => a.severity === 'Critical').length;
    const ackedCount = _allAlerts.filter(a => a.status === 'Acknowledged').length;

    _el.kpiTotal.textContent = total;
    _el.kpiNew.textContent = newCount;
    _el.kpiCritical.textContent = criticalCount;
    _el.kpiAcked.textContent = ackedCount;
  }

  function updateGlobalBadges() {
    const newCount = _allAlerts.filter(a => a.status === 'New').length;
    const countStr = newCount > 0 ? String(newCount) : '';

    const topbarBadge = document.querySelector('.notif-badge');
    if (topbarBadge) {
      topbarBadge.textContent = countStr;
      topbarBadge.dataset.count = newCount;
      topbarBadge.setAttribute('aria-label', `${newCount} new alert${newCount === 1 ? '' : 's'}`);
    }

    const navBadge = document.querySelector('.nav-badge[data-for="alerts"]');
    if (navBadge) {
      navBadge.textContent = newCount > 9 ? '9+' : countStr;
      navBadge.dataset.count = newCount;
    }
  }

  function renderAlerts() {
    updateKPIs();

    const searchQuery = _el.search.value.toLowerCase().trim();
    const severityFilter = _el.severity.value;
    const statusFilter = _el.status.value;
    const patientFilter = _el.patient.value;

    let filtered = _allAlerts.filter(alert => {
      // Status
      if (statusFilter !== 'All' && alert.status !== statusFilter) return false;
      // Severity
      if (severityFilter !== 'All' && alert.severity !== severityFilter) return false;
      // Patient
      if (patientFilter !== 'All' && alert.patientId !== patientFilter) return false;
      // Search
      if (searchQuery) {
        const pName = getPatientName(alert.patientId).toLowerCase();
        const msg = (alert.message || '').toLowerCase();
        const pid = alert.patientId.toLowerCase();
        if (!pName.includes(searchQuery) && !msg.includes(searchQuery) && !pid.includes(searchQuery)) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      _el.container.hidden = true;
      _el.emptyState.hidden = false;
      return;
    }

    _el.container.hidden = false;
    _el.emptyState.hidden = true;

    // Render Table
    let tableHtml = '';
    let cardsHtml = '';

    filtered.forEach(alert => {
      const pName = getPatientName(alert.patientId);
      const timeStr = NeoCareUtils.formatRelativeTime(alert.timestamp) + ' (' + NeoCareUtils.formatTime(alert.timestamp) + ')';

      const isNew = alert.status === 'New';
      const actionHtml = isNew
        ? `<button class="alert-action-btn alert-action-btn--primary" onclick="window.acknowledgeAlert('${alert.alertId}')">Acknowledge</button>`
        : `<span style="font-size:var(--text-xs);color:var(--text-secondary);">Acknowledged</span>`;

      const viewHtml = `<a href="#" class="alert-view-link" onclick="window.viewAlert('${alert.alertId}'); return false;">View Details</a>`;

      tableHtml += `
        <tr>
          <td>
            <div class="severity-indicator">
              <span class="severity-dot severity-dot--${alert.severity}" aria-hidden="true"></span>
              <span class="severity-label">${alert.severity}</span>
            </div>
          </td>
          <td>
            <div class="alert-msg-wrap">
              <span class="alert-title">${alert.message}</span>
            </div>
          </td>
          <td>
            <div class="alert-patient-wrap">
              <span class="alert-patient-name">${pName}</span>
              <span class="alert-patient-id">${alert.patientId}</span>
            </div>
          </td>
          <td>${timeStr}</td>
          <td><span class="alert-status-badge alert-status-badge--${alert.status}">${alert.status}</span></td>
          <td>
            <div style="display:flex; align-items:center;">
              ${actionHtml}
              ${viewHtml}
            </div>
          </td>
        </tr>
      `;

      cardsHtml += `
        <div class="alert-card-mobile">
          <div class="alert-card-header">
            <div class="severity-indicator">
              <span class="severity-dot severity-dot--${alert.severity}" aria-hidden="true"></span>
              <span class="severity-label">${alert.severity}</span>
            </div>
            <span class="alert-status-badge alert-status-badge--${alert.status}">${alert.status}</span>
          </div>
          <div class="alert-card-body">
            <div class="alert-title" style="margin-bottom:8px;">${alert.message}</div>
            <div class="alert-patient-wrap">
              <span class="alert-patient-name">${pName}</span>
              <span class="alert-patient-id">${alert.patientId}</span>
            </div>
            <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:4px;">${timeStr}</div>
          </div>
          <div class="alert-card-footer">
            ${viewHtml}
            ${actionHtml}
          </div>
        </div>
      `;
    });

    _el.tableBody.innerHTML = tableHtml;
    _el.mobileList.innerHTML = cardsHtml;
  }

  function showErrorState() {
    _el.container.hidden = true;
    _el.emptyState.hidden = false;
    _el.emptyState.innerHTML = `
      <div class="alerts-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h3 class="alerts-empty-title">Unable to load alerts</h3>
      <button class="alert-action-btn" onclick="location.reload()" style="margin-top:16px;">Retry</button>
    `;
  }

  /* ══════════════════════════════════════════
     ACTIONS
  ══════════════════════════════════════════ */

  window.acknowledgeAlert = async function(alertId) {
    await handleAcknowledge(alertId, false);
  };

  async function handleAcknowledge(alertId, fromModal) {
    try {
      if (fromModal) {
        _el.btnModalAck.disabled = true;
        _el.btnModalAck.textContent = 'Acknowledging...';
      }

      await NeoCareData.acknowledgeAlert(alertId);

      // Update local state instead of full reload for performance
      const alert = _allAlerts.find(a => a.alertId === alertId);
      if (alert) {
        alert.status = 'Acknowledged';
      }

      renderAlerts();
      updateGlobalBadges();

      if (fromModal) {
        _el.btnModalAck.disabled = false;
        _el.btnModalAck.textContent = 'Acknowledge Alert';
        closeModal();
      }
    } catch (err) {
      console.error('[AlertsController] Failed to acknowledge alert:', err);
      alert('Failed to acknowledge alert. Please try again.');
      if (fromModal) {
        _el.btnModalAck.disabled = false;
        _el.btnModalAck.textContent = 'Acknowledge Alert';
      }
    }
  }

  window.viewAlert = function(alertId) {
    const alert = _allAlerts.find(a => a.alertId === alertId);
    if (!alert) return;

    _currentModalAlertId = alertId;
    const pName = getPatientName(alert.patientId);

    _el.modalBody.innerHTML = `
      <div class="alert-modal-row">
        <div class="alert-modal-key">Alert ID</div>
        <div class="alert-modal-val">${alert.alertId}</div>
      </div>
      <div class="alert-modal-row">
        <div class="alert-modal-key">Severity</div>
        <div class="alert-modal-val">
          <div class="severity-indicator">
            <span class="severity-dot severity-dot--${alert.severity}" aria-hidden="true"></span>
            <span class="severity-label">${alert.severity}</span>
          </div>
        </div>
      </div>
      <div class="alert-modal-row">
        <div class="alert-modal-key">Status</div>
        <div class="alert-modal-val"><span class="alert-status-badge alert-status-badge--${alert.status}">${alert.status}</span></div>
      </div>
      <div class="alert-modal-row">
        <div class="alert-modal-key">Patient</div>
        <div class="alert-modal-val">${pName} (${alert.patientId})</div>
      </div>
      <div class="alert-modal-row">
        <div class="alert-modal-key">Sensor</div>
        <div class="alert-modal-val">${alert.sensor || '—'}</div>
      </div>
      <div class="alert-modal-row">
        <div class="alert-modal-key">Reading</div>
        <div class="alert-modal-val">${alert.reading !== undefined ? alert.reading : '—'}</div>
      </div>
      <div class="alert-modal-row">
        <div class="alert-modal-key">Message</div>
        <div class="alert-modal-val" style="font-weight:var(--font-medium);">${alert.message}</div>
      </div>
      <div class="alert-modal-row">
        <div class="alert-modal-key">Timestamp</div>
        <div class="alert-modal-val">${NeoCareUtils.formatDate(alert.timestamp)} ${NeoCareUtils.formatTime(alert.timestamp)}</div>
      </div>
    `;

    _el.btnModalPatient.href = `patient-details.html?id=${encodeURIComponent(alert.patientId)}`;

    if (alert.status === 'New') {
      _el.btnModalAck.style.display = 'inline-block';
    } else {
      _el.btnModalAck.style.display = 'none';
    }

    _el.modalOverlay.classList.add('is-active');
  };

  function closeModal() {
    _el.modalOverlay.classList.remove('is-active');
    _currentModalAlertId = null;
  }

  // Bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
