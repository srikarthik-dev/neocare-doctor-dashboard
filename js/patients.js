/**
 * NEOCARE Doctor Dashboard — Patients Page Controller
 * ─────────────────────────────────────────────────────
 * Stage 6: Full patient list implementation.
 *
 * DEMO / SAFETY NOTICE:
 *   All patient data displayed is entirely synthetic.
 *   This page does not represent real patients, real clinical
 *   records, or real medical decisions. Portfolio prototype only.
 *
 * Data access: exclusively via NeoCareData DAL.
 *   No direct fetch() of data/*.json files.
 *
 * Dependencies (loaded before this file):
 *   utils.js, auth.js, dataService.js, app.js
 */

'use strict';

(function PatientsController() {

  /* ══════════════════════════════════════════
     STATE
  ══════════════════════════════════════════ */

  let _allPatients  = [];      // Master list from DAL
  let _filtered     = [];      // Currently displayed subset
  let _searchQuery  = '';
  let _filterStatus = '';      // '' = All
  let _filterRisk   = '';      // '' = All
  let _isLoading    = false;

  /* ══════════════════════════════════════════
     DOM REFERENCES (bound once on init)
  ══════════════════════════════════════════ */

  const $ = id => document.getElementById(id);

  /* ══════════════════════════════════════════
     UTILITY — HTML escape
  ══════════════════════════════════════════ */

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ══════════════════════════════════════════
     AVATAR COLOR CLASS
  ══════════════════════════════════════════ */

  function _avatarClass(riskStatus) {
    if (riskStatus === 'High')     return 'pt-avatar--high';
    if (riskStatus === 'Moderate') return 'pt-avatar--moderate';
    return '';
  }

  /* ══════════════════════════════════════════
     SUMMARY CARDS
  ══════════════════════════════════════════ */

  function _setSummaryLoading() {
    ['sum-total','sum-active','sum-highrisk','sum-inactive'].forEach(id => {
      const el = $(id);
      if (el) el.classList.add('is-loading');
    });
  }

  function _renderSummary(patients) {
    const total    = patients.length;
    const active   = patients.filter(p => p.monitoringStatus === 'Active').length;
    const highRisk = patients.filter(p => p.riskStatus === 'High').length;
    const inactive = patients.filter(p => p.monitoringStatus === 'Inactive').length;

    function set(id, val) {
      const el = $(id);
      if (!el) return;
      el.classList.remove('is-loading');
      el.textContent = val;
    }
    set('sum-total',    total);
    set('sum-active',   active);
    set('sum-highrisk', highRisk);
    set('sum-inactive', inactive);
  }

  /* ══════════════════════════════════════════
     APPLY FILTERS
  ══════════════════════════════════════════ */

  function applyFilters() {
    const q = _searchQuery.toLowerCase().trim();

    _filtered = _allPatients.filter(p => {
      // Search
      if (q) {
        const nameMatch = p.name.toLowerCase().includes(q);
        const idMatch   = p.patientId.toLowerCase().includes(q);
        if (!nameMatch && !idMatch) return false;
      }
      // Monitoring status
      if (_filterStatus && p.monitoringStatus !== _filterStatus) return false;
      // Risk
      if (_filterRisk && p.riskStatus !== _filterRisk) return false;
      return true;
    });

    renderPatients();
  }

  /* ══════════════════════════════════════════
     CLEAR FILTERS
  ══════════════════════════════════════════ */

  function clearFilters() {
    _searchQuery  = '';
    _filterStatus = '';
    _filterRisk   = '';

    const searchEl = $('patient-search');
    const statusEl = $('filter-status');
    const riskEl   = $('filter-risk');

    if (searchEl) searchEl.value = '';
    if (statusEl) statusEl.value = '';
    if (riskEl)   riskEl.value   = '';

    applyFilters();
  }

  /* ══════════════════════════════════════════
     RENDER — TABLE ROW
  ══════════════════════════════════════════ */

  function _tableRow(p) {
    const initials   = typeof NeoCareUtils !== 'undefined'
      ? NeoCareUtils.getInitials(p.name)
      : p.name.slice(0,2).toUpperCase();

    const updTime = typeof NeoCareUtils !== 'undefined'
      ? NeoCareUtils.formatRelativeTime(p.lastUpdated)
      : '—';

    const detailUrl = `patient-details.html?id=${encodeURIComponent(p.patientId)}`;

    const edd = p.expectedDeliveryDate
      ? new Date(p.expectedDeliveryDate).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric'
        })
      : '—';

    return `
      <tr data-patient-id="${_esc(p.patientId)}" tabindex="0"
          role="row" aria-label="Patient ${_esc(p.name)}">
        <td>
          <div class="pt-avatar-cell">
            <div class="pt-avatar ${_avatarClass(p.riskStatus)}" aria-hidden="true">${_esc(initials)}</div>
            <div class="pt-name-wrap">
              <div class="pt-fullname">${_esc(p.name)}</div>
              <div class="pt-meta">${_esc(p.patientId)} · ${p.age} yrs</div>
            </div>
          </div>
        </td>
        <td>${p.pregnancyWeek} weeks</td>
        <td>${edd}</td>
        <td>
          <span class="status-badge">
            <span class="status-dot status-dot--${_esc(p.monitoringStatus)}" aria-hidden="true"></span>
            ${_esc(p.monitoringStatus)}
          </span>
        </td>
        <td><span class="risk-badge risk-badge--${_esc(p.riskStatus)}">${_esc(p.riskStatus)}</span></td>
        <td>${updTime}</td>
        <td>
          <a class="view-btn" href="${detailUrl}"
             aria-label="View details for ${_esc(p.name)}"
             onclick="event.stopPropagation()">
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
  }

  /* ══════════════════════════════════════════
     RENDER — MOBILE CARD
  ══════════════════════════════════════════ */

  function _mobileCard(p) {
    const initials = typeof NeoCareUtils !== 'undefined'
      ? NeoCareUtils.getInitials(p.name) : p.name.slice(0,2).toUpperCase();
    const updTime  = typeof NeoCareUtils !== 'undefined'
      ? NeoCareUtils.formatRelativeTime(p.lastUpdated) : '—';
    const edd = p.expectedDeliveryDate
      ? new Date(p.expectedDeliveryDate).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric'
        })
      : '—';
    const detailUrl = `patient-details.html?id=${encodeURIComponent(p.patientId)}`;

    return `
      <div class="pt-card" role="article" aria-label="Patient ${_esc(p.name)}">
        <div class="pt-card-top">
          <div class="pt-avatar-cell">
            <div class="pt-avatar ${_avatarClass(p.riskStatus)}" aria-hidden="true">${_esc(initials)}</div>
            <div class="pt-name-wrap">
              <div class="pt-fullname">${_esc(p.name)}</div>
              <div class="pt-meta">${_esc(p.patientId)} · ${p.age} yrs</div>
            </div>
          </div>
          <span class="risk-badge risk-badge--${_esc(p.riskStatus)}">${_esc(p.riskStatus)}</span>
        </div>
        <div class="pt-card-detail">
          <span>Pregnancy</span>
          <strong>${p.pregnancyWeek} weeks · EDD ${edd}</strong>
        </div>
        <div class="pt-card-detail">
          <span>Monitoring</span>
          <strong>
            <span class="status-badge">
              <span class="status-dot status-dot--${_esc(p.monitoringStatus)}" aria-hidden="true"></span>
              ${_esc(p.monitoringStatus)}
            </span>
          </strong>
        </div>
        <div class="pt-card-detail">
          <span>Last Updated</span>
          <strong>${updTime}</strong>
        </div>
        <div class="pt-card-footer">
          <a class="view-btn" href="${detailUrl}"
             aria-label="View details for ${_esc(p.name)}"
             style="width: 100%; justify-content: center;">
            View Patient Details →
          </a>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════
     RENDER — PATIENTS LIST
  ══════════════════════════════════════════ */

  function renderPatients() {
    const tbody  = $('patients-tbody');
    const mobile = $('patients-mobile');
    const meta   = $('results-meta');

    // Update results count
    if (meta) {
      meta.textContent = _filtered.length === _allPatients.length
        ? `${_allPatients.length} patient${_allPatients.length !== 1 ? 's' : ''}`
        : `${_filtered.length} of ${_allPatients.length} patients`;
    }

    if (_filtered.length === 0) {
      showEmptyState();
      return;
    }

    hideStatePanel();

    // Desktop table
    if (tbody) {
      tbody.innerHTML = _filtered.map(_tableRow).join('');
      // Row click → navigate to details
      tbody.querySelectorAll('tr[data-patient-id]').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.view-btn')) return;
          const id = row.dataset.patientId;
          window.location.href = `patient-details.html?id=${encodeURIComponent(id)}`;
        });
        row.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const id = row.dataset.patientId;
            window.location.href = `patient-details.html?id=${encodeURIComponent(id)}`;
          }
        });
      });
    }

    // Mobile cards
    if (mobile) {
      mobile.innerHTML = _filtered.map(_mobileCard).join('');
    }
  }

  /* ══════════════════════════════════════════
     LOADING / ERROR / EMPTY / HIDE STATES
  ══════════════════════════════════════════ */

  function showLoading() {
    const tbody  = $('patients-tbody');
    const mobile = $('patients-mobile');
    const panel  = $('state-panel');

    if (panel) panel.hidden = true;

    // Skeleton rows
    const skeletonRow = `
      <tr class="skeleton-row">
        <td><span class="skeleton-cell" style="width:160px"></span></td>
        <td><span class="skeleton-cell" style="width:60px"></span></td>
        <td><span class="skeleton-cell" style="width:90px"></span></td>
        <td><span class="skeleton-cell" style="width:70px"></span></td>
        <td><span class="skeleton-cell" style="width:60px"></span></td>
        <td><span class="skeleton-cell" style="width:80px"></span></td>
        <td><span class="skeleton-cell" style="width:50px"></span></td>
      </tr>`;
    if (tbody)  tbody.innerHTML  = skeletonRow.repeat(5);
    if (mobile) mobile.innerHTML = '';
  }

  function showEmptyState(isError) {
    const panel    = $('state-panel');
    const panelMsg = $('state-msg');
    const retrBtn  = $('state-retry');
    const clrBtn   = $('state-clear');
    const tbody    = $('patients-tbody');
    const mobile   = $('patients-mobile');

    if (panel) panel.hidden = false;
    if (tbody)  tbody.innerHTML  = '';
    if (mobile) mobile.innerHTML = '';

    const hasActive = _searchQuery || _filterStatus || _filterRisk;

    if (isError) {
      if (panelMsg) panelMsg.innerHTML = `
        <p class="state-title">Unable to load patients</p>
        <p class="state-sub">Please try again.</p>`;
      if (retrBtn) retrBtn.hidden = false;
      if (clrBtn)  clrBtn.hidden  = true;
    } else {
      if (panelMsg) panelMsg.innerHTML = `
        <p class="state-title">No patients found</p>
        <p class="state-sub">${hasActive ? 'Try adjusting your search or filters.' : 'No patients are currently assigned.'}</p>`;
      if (retrBtn) retrBtn.hidden = true;
      if (clrBtn)  clrBtn.hidden  = !hasActive;
    }
  }

  function hideStatePanel() {
    const panel = $('state-panel');
    if (panel) panel.hidden = true;
  }

  /* ══════════════════════════════════════════
     LOAD PATIENTS
  ══════════════════════════════════════════ */

  async function loadPatients() {
    if (_isLoading) return;
    _isLoading = true;

    _setSummaryLoading();
    showLoading();

    try {
      const patients = await NeoCareData.getPatients();
      _allPatients = patients;
      _renderSummary(patients);
      applyFilters();
    } catch (err) {
      _renderSummary([]);
      showEmptyState(true);
      console.warn('[PatientsController] Failed to load patients:', err.message);
    } finally {
      _isLoading = false;
    }
  }

  /* ══════════════════════════════════════════
     EVENT WIRING
  ══════════════════════════════════════════ */

  function _initEvents() {
    // Search (debounced)
    const searchEl = $('patient-search');
    if (searchEl) {
      const debouncedSearch = typeof NeoCareUtils !== 'undefined'
        ? NeoCareUtils.debounce(e => {
            _searchQuery = e.target.value;
            applyFilters();
          }, 220)
        : e => { _searchQuery = e.target.value; applyFilters(); };

      searchEl.addEventListener('input', debouncedSearch);
    }

    // Monitoring filter
    const statusEl = $('filter-status');
    if (statusEl) {
      statusEl.addEventListener('change', e => {
        _filterStatus = e.target.value;
        applyFilters();
      });
    }

    // Risk filter
    const riskEl = $('filter-risk');
    if (riskEl) {
      riskEl.addEventListener('change', e => {
        _filterRisk = e.target.value;
        applyFilters();
      });
    }

    // Clear filters button
    const clrBtn = $('clear-filters-btn');
    if (clrBtn) clrBtn.addEventListener('click', clearFilters);

    // State panel clear button
    const stateClr = $('state-clear');
    if (stateClr) stateClr.addEventListener('click', clearFilters);

    // State panel retry button
    const stateRetry = $('state-retry');
    if (stateRetry) stateRetry.addEventListener('click', loadPatients);
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */

  function _init() {
    _initEvents();
    loadPatients();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
