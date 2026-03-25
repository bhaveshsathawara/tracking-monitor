/**
 * report/timeline.js
 *
 * Generates an HTML horizontal-bar timeline from a sorted TimingEvent[].
 * Used inside the dashboard to visualise when each tag fired relative to
 * page load and consent interaction.
 */

const COLORS = {
  cmpLoad:        '#6366f1',  // indigo
  gtmLoad:        '#0ea5e9',  // sky blue
  gtmFired:       '#0ea5e9',
  gtmGlobalSet:   '#0ea5e9',
  metaPixelLoaded:'#f59e0b',  // amber
  metaPixelFire:  '#f97316',  // orange
  gtagLoaded:     '#22c55e',  // green
  gtagCall:       '#16a34a',
  googleAdsLoad:  '#22c55e',
  consentMode:    '#a855f7',  // purple
  dataLayerEvent: '#94a3b8',  // slate
  default:        '#64748b',
};

function colorFor(label) {
  for (const [key, color] of Object.entries(COLORS)) {
    if (label.startsWith(key)) return color;
  }
  return COLORS.default;
}

/**
 * Builds a compact HTML timeline strip for a set of events.
 *
 * @param {TimingEvent[]} events
 * @param {number}        maxMs   — total width represents this duration (default: highest msAfterNav + 500)
 * @returns {string}              — HTML string
 */
function buildTimeline(events, maxMs) {
  if (!events || events.length === 0) {
    return '<p style="color:#94a3b8;font-size:12px;margin:4px 0">No timeline events captured</p>';
  }

  const cap = maxMs || (Math.max(...events.map((e) => e.msAfterNav || 0)) + 500) || 8000;

  const rows = events
    .filter((e) => e.msAfterNav !== undefined && e.msAfterNav !== null)
    .map((e) => {
      const pct    = Math.min(100, ((e.msAfterNav / cap) * 100)).toFixed(2);
      const color  = colorFor(e.label || '');
      const source = e.source === 'network' ? '🌐' : '⚡';
      const label  = (e.label || 'unknown').replace(/:/g, ': ');
      const blocked = e.detail?.blocked ? ' <span style="color:#ef4444">[blocked]</span>' : '';

      return `
        <div style="display:flex;align-items:center;gap:8px;margin:2px 0;font-size:11px;font-family:monospace">
          <span style="width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#e2e8f0"
                title="${label}">${source} ${label}${blocked}</span>
          <div style="flex:1;background:#1e293b;border-radius:2px;height:12px;position:relative">
            <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
          </div>
          <span style="width:55px;text-align:right;color:#94a3b8">${e.msAfterNav}ms</span>
        </div>`;
    });

  return `
    <div style="background:#0f172a;padding:12px;border-radius:6px;overflow-x:auto">
      <div style="font-size:10px;color:#64748b;margin-bottom:6px;font-family:monospace">
        Timeline (0 → ${cap}ms)
      </div>
      ${rows.join('')}
    </div>`;
}

module.exports = { buildTimeline };
