/**
 * NEOCARE Doctor Dashboard — Chart.js Wrappers
 * ──────────────────────────────────────────────
 * Stage 5: Reusable Chart.js factory functions.
 *
 * Provides a consistent visual language (palette, typography,
 * grid lines, tooltips) across all charts in the application.
 *
 * External dependency:
 *   Chart.js — loaded via CDN before this file in each page's HTML.
 *   Must be loaded before charts.js is executed.
 *
 * DEMO NOTICE:
 *   All chart data is derived from synthetic demo datasets.
 *   These charts do not represent real clinical information.
 *
 * Public API (namespace: NeoCareCharts):
 *   createDoughnutChart(canvasId, data, options) → Chart instance
 *   createLineChart(canvasId, data, options)     → Chart instance
 *   destroyChart(instance)                       → void
 */

'use strict';

const NeoCareCharts = (() => {

  /* ══════════════════════════════════════════
     DESIGN TOKENS (mirrored from CSS variables)
     Chart.js renders to canvas — CSS vars not accessible directly.
  ══════════════════════════════════════════ */

  const PALETTE = {
    primary:      '#2F6FED',
    accent:       '#14B8A6',
    success:      '#16A34A',
    warning:      '#D97706',
    critical:     '#DC2626',
    info:         '#0284C7',
    border:       '#E5E7EB',
    textPrimary:  '#111827',
    textMuted:    '#6B7280',
    surface:      '#FFFFFF',
  };

  const RISK_COLORS = {
    Low:      PALETTE.success,
    Moderate: PALETTE.warning,
    High:     PALETTE.critical,
  };

  const FONT_FAMILY = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  /* ══════════════════════════════════════════
     GLOBAL CHART.JS DEFAULTS
     Applied once when this module is loaded.
  ══════════════════════════════════════════ */

  function _applyGlobalDefaults() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.font.family  = FONT_FAMILY;
    Chart.defaults.font.size    = 13;
    Chart.defaults.color        = PALETTE.textMuted;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = PALETTE.textPrimary;
    Chart.defaults.plugins.tooltip.padding         = 10;
    Chart.defaults.plugins.tooltip.cornerRadius    = 8;
    Chart.defaults.plugins.tooltip.titleFont       = { size: 12, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont        = { size: 12 };
    Chart.defaults.plugins.tooltip.displayColors   = true;
    Chart.defaults.plugins.tooltip.boxPadding      = 4;
    Chart.defaults.animation.duration              = 300;
  }

  // Apply defaults on module load
  _applyGlobalDefaults();

  /* ══════════════════════════════════════════
     DOUGHNUT CHART
     Used for: risk distribution overview
  ══════════════════════════════════════════ */

  /**
   * Creates a doughnut chart.
   *
   * @param {string} canvasId       - ID of the <canvas> element.
   * @param {{ labels: string[], values: number[] }} data
   * @param {{ colors?: string[] }} [options]
   * @returns {Chart|null}
   */
  function createDoughnutChart(canvasId, data, options = {}) {
    if (typeof Chart === 'undefined') {
      console.warn('[NeoCareCharts] Chart.js not loaded.');
      return null;
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn(`[NeoCareCharts] Canvas #${canvasId} not found.`);
      return null;
    }

    const ctx = canvas.getContext('2d');
    const colors = options.colors || data.labels.map(l => RISK_COLORS[l] || PALETTE.primary);

    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   data.labels,
        datasets: [{
          data:            data.values,
          backgroundColor: colors.map(c => c),
          borderColor:     colors.map(() => PALETTE.surface),
          borderWidth:     3,
          hoverBorderWidth: 3,
          hoverOffset:     4,
        }],
      },
      options: {
        responsive:         true,
        maintainAspectRatio: true,
        cutout:             '70%',
        animation:          { duration: 350 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed} patient${ctx.parsed === 1 ? '' : 's'}`,
            },
          },
        },
      },
    });
  }

  /* ══════════════════════════════════════════
     LINE CHART
     Used for: sensor readings trends (Stage 6+)
  ══════════════════════════════════════════ */

  /**
   * Creates a line chart.
   *
   * @param {string}  canvasId
   * @param {{ labels: string[], datasets: object[] }} data
   * @param {object}  [options]
   * @returns {Chart|null}
   */
  function createLineChart(canvasId, data, options = {}) {
    if (typeof Chart === 'undefined') return null;

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');

    return new Chart(ctx, {
      type: 'line',
      data,
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        interaction: {
          mode:      'index',
          intersect: false,
        },
        plugins: {
          legend: { display: data.datasets.length > 1 },
        },
        scales: {
          x: {
            grid:  { color: PALETTE.border, drawBorder: false },
            ticks: { color: PALETTE.textMuted, maxRotation: 0 },
          },
          y: {
            grid:  { color: PALETTE.border, drawBorder: false },
            ticks: { color: PALETTE.textMuted },
            beginAtZero: options.beginAtZero || false,
          },
        },
        elements: {
          point: { radius: 3, hoverRadius: 5 },
          line:  { tension: 0.35 },
        },
        animation: { duration: 300 },
        ...options.chartOptions,
      },
    });
  }

  /* ══════════════════════════════════════════
     DESTROY HELPER
     Safely destroys a Chart instance.
     Prevents "Canvas already in use" errors on refresh.
  ══════════════════════════════════════════ */

  /**
   * @param {Chart|null} instance
   */
  function destroyChart(instance) {
    if (instance && typeof instance.destroy === 'function') {
      instance.destroy();
    }
  }

  /* ══════════════════════════════════════════
     EXPOSE PUBLIC API
  ══════════════════════════════════════════ */

  return {
    PALETTE,
    RISK_COLORS,
    createDoughnutChart,
    createLineChart,
    destroyChart,
  };

})();
