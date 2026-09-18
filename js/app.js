/**
 * NEOCARE Doctor Dashboard — Application Shell Controller
 * ─────────────────────────────────────────────────────────
 * Stage 4: Manages the shared authenticated page shell.
 *
 * Responsibilities:
 *   - Authentication guard (calls NeoCareAuth.requireAuth)
 *   - Active navigation state based on current URL
 *   - Mobile off-canvas sidebar (open/close/overlay/escape)
 *   - Topbar doctor mini-profile (via NeoCareData.getDoctorProfile)
 *   - Notification badge count (via NeoCareData.getAlerts)
 *   - Nav badge alert count on Alerts link
 *   - Sidebar logout button
 *
 * Does NOT contain:
 *   - Dashboard KPIs or charts
 *   - Patient data tables
 *   - Monitoring logic
 *   - Any page-specific business logic
 *
 * Depends on (loaded before this file):
 *   - utils.js       (NeoCareUtils)
 *   - auth.js        (NeoCareAuth)
 *   - dataService.js (NeoCareData)
 */

'use strict';

(function AppShell() {

  /* ══════════════════════════════════════════
     GUARD — redirect if unauthenticated
  ══════════════════════════════════════════ */

  // This must run synchronously before any other shell logic.
  // NeoCareAuth.requireAuth() redirects immediately if no session.
  if (typeof NeoCareAuth !== 'undefined') {
    NeoCareAuth.requireAuth();
  }

  /* ══════════════════════════════════════════
     NAVIGATION MAP
     Maps page filenames → nav item selectors
  ══════════════════════════════════════════ */

  /**
   * Returns the key that should be active for the current page.
   * patient-details.html → 'patients' (parent nav highlighted)
   */
  function _resolveActiveKey() {
    const path = window.location.pathname;
    const filename = path.split('/').pop().split('?')[0];

    const map = {
      'dashboard.html':       'dashboard',
      'patients.html':        'patients',
      'patient-details.html': 'patients', // patient-details activates Patients
      'monitoring.html':      'monitoring',
      'alerts.html':          'alerts',
      'reports.html':         'reports',
      'profile.html':         'profile',
    };

    return map[filename] || 'dashboard';
  }

  /* ══════════════════════════════════════════
     ACTIVE NAVIGATION
  ══════════════════════════════════════════ */

  function _initActiveNav() {
    const activeKey = _resolveActiveKey();
    const navItems  = document.querySelectorAll('.nav-item[data-page]');

    navItems.forEach(item => {
      if (item.dataset.page === activeKey) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    });
  }

  /* ══════════════════════════════════════════
     PAGE TITLE
     Syncs the topbar title with the active page
  ══════════════════════════════════════════ */

  function _initPageTitle() {
    const titleEl = document.querySelector('.topbar-page-title');
    if (!titleEl) return;

    const key = _resolveActiveKey();
    const titles = {
      dashboard:  'Dashboard',
      patients:   'Patients',
      monitoring: 'Monitoring',
      alerts:     'Alerts',
      reports:    'Reports',
      profile:    'Profile',
    };

    // patient-details.html gets its own document title
    const filename = window.location.pathname.split('/').pop().split('?')[0];
    if (filename === 'patient-details.html') {
      titleEl.textContent = 'Patient Details';
      return;
    }

    titleEl.textContent = titles[key] || 'NEOCARE';
  }

  /* ══════════════════════════════════════════
     MOBILE SIDEBAR
  ══════════════════════════════════════════ */

  const _sidebar  = document.querySelector('.sidebar');
  const _overlay  = document.querySelector('.sidebar-overlay');
  const _menuBtn  = document.querySelector('.topbar-menu-btn');

  function _openSidebar() {
    if (!_sidebar || !_overlay) return;
    _sidebar.classList.add('is-open');
    _overlay.classList.add('is-open');
    _sidebar.setAttribute('aria-hidden', 'false');
    if (_menuBtn) {
      _menuBtn.setAttribute('aria-expanded', 'true');
    }
    // Trap-free: move focus into first nav link
    const firstLink = _sidebar.querySelector('.nav-item');
    if (firstLink) firstLink.focus();
    document.body.style.overflow = 'hidden';
  }

  function _closeSidebar() {
    if (!_sidebar || !_overlay) return;
    _sidebar.classList.remove('is-open');
    _overlay.classList.remove('is-open');
    _sidebar.setAttribute('aria-hidden', 'true');
    if (_menuBtn) {
      _menuBtn.setAttribute('aria-expanded', 'false');
      _menuBtn.focus();
    }
    document.body.style.overflow = '';
  }

  function _initMobileSidebar() {
    if (_menuBtn) {
      _menuBtn.addEventListener('click', _openSidebar);
    }

    if (_overlay) {
      _overlay.addEventListener('click', _closeSidebar);
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _sidebar && _sidebar.classList.contains('is-open')) {
        _closeSidebar();
      }
    });

    // Close sidebar when a nav item is clicked on mobile
    if (_sidebar) {
      _sidebar.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth < 768) {
            _closeSidebar();
          }
        });
      });
    }

    // Set initial ARIA state
    if (_sidebar) {
      const isDesktop = window.innerWidth >= 768;
      _sidebar.setAttribute('aria-hidden', isDesktop ? 'false' : 'true');
    }
  }

  /* ══════════════════════════════════════════
     DOCTOR PROFILE
     Loads doctor name and role into topbar and sidebar
  ══════════════════════════════════════════ */

  async function _initDoctorProfile() {
    // Targets in topbar
    const topbarName   = document.querySelector('.topbar-doctor-name');
    const topbarRole   = document.querySelector('.topbar-doctor-role');
    const topbarAvatar = document.querySelector('.topbar-doctor-avatar');
    // Targets in sidebar
    const sidebarName   = document.querySelector('.doctor-name');
    const sidebarRole   = document.querySelector('.doctor-role');
    const sidebarAvatar = document.querySelector('.doctor-avatar');

    // Fallback: use session data (always available if authenticated)
    const session = typeof NeoCareAuth !== 'undefined'
      ? NeoCareAuth.getSession()
      : null;

    const fallbackName = session?.name || 'Doctor';
    const fallbackRole = session?.role || '';

    // Apply fallback immediately so the shell renders right away
    function _applyProfile(name, role) {
      const initials = typeof NeoCareUtils !== 'undefined'
        ? NeoCareUtils.getInitials(name)
        : name.slice(0, 2).toUpperCase();

      if (topbarName)   topbarName.textContent   = name;
      if (topbarRole)   topbarRole.textContent    = role;
      if (topbarAvatar) topbarAvatar.textContent  = initials;
      if (sidebarName)  sidebarName.textContent   = name;
      if (sidebarRole)  sidebarRole.textContent   = role;
      if (sidebarAvatar) sidebarAvatar.textContent = initials;
    }

    // Apply session data immediately
    _applyProfile(fallbackName, fallbackRole);

    // Then enrich with data from DAL (may already be cached)
    try {
      if (typeof NeoCareData !== 'undefined') {
        const doctor = await NeoCareData.getDoctorProfile();
        if (doctor && doctor.name) {
          _applyProfile(doctor.name, doctor.role || fallbackRole);
        }
      }
    } catch (err) {
      // Silently degrade — session fallback already applied
      console.warn('[AppShell] Doctor profile load failed, using session data:', err.message);
    }
  }

  /* ══════════════════════════════════════════
     NOTIFICATION BADGE
     Loads count of "New" alerts
  ══════════════════════════════════════════ */

  async function _initNotificationBadge() {
    const topbarBadge = document.querySelector('.notif-badge');
    const navBadge    = document.querySelector('.nav-badge[data-for="alerts"]');

    let count = 0;

    try {
      if (typeof NeoCareData !== 'undefined') {
        const newAlerts = await NeoCareData.getAlerts({ status: 'New' });
        count = newAlerts.length;
      }
    } catch (err) {
      console.warn('[AppShell] Alert count load failed, defaulting to 0:', err.message);
      count = 0;
    }

    const countStr = count > 0 ? String(count) : '';

    if (topbarBadge) {
      topbarBadge.textContent = countStr;
      topbarBadge.dataset.count = count;
      topbarBadge.setAttribute('aria-label', `${count} new alert${count === 1 ? '' : 's'}`);
    }

    if (navBadge) {
      navBadge.textContent = count > 9 ? '9+' : countStr;
      navBadge.dataset.count = count;
    }
  }

  /* ══════════════════════════════════════════
     LOGOUT
  ══════════════════════════════════════════ */

  function _initLogout() {
    const logoutBtns = document.querySelectorAll('.sidebar-logout-btn, [data-action="logout"]');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof NeoCareAuth !== 'undefined') {
          NeoCareAuth.logout();
        } else {
          // Fallback: clear storage and redirect
          try {
            localStorage.removeItem('neocare_session');
            sessionStorage.removeItem('neocare_session');
          } catch {}
          window.location.href = '../index.html';
        }
      });
    });
  }

  /* ══════════════════════════════════════════
     NOTIFICATIONS LINK
     Make the topbar bell icon navigate to alerts
  ══════════════════════════════════════════ */

  function _initNotifLink() {
    const notifBtn = document.querySelector('.topbar-notif-btn');
    if (!notifBtn) return;

    notifBtn.addEventListener('click', () => {
      window.location.href = 'alerts.html';
    });
  }

  /* ══════════════════════════════════════════
     INIT — entry point
  ══════════════════════════════════════════ */

  function _init() {
    _initActiveNav();
    _initPageTitle();
    _initMobileSidebar();
    _initLogout();
    _initNotifLink();

    // Async (non-blocking): load doctor profile and alert count
    _initDoctorProfile();
    _initNotificationBadge();
  }

  // Run after DOM is fully parsed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
