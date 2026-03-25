/**
 * report/builder.js
 *
 * Builds the full HTML dashboard from an array of DomainReport objects.
 *
 * DomainReport shape (produced by monitor.js):
 *   {
 *     domain:   string,
 *     baseUrl:  string,
 *     pages:    PageReport[],
 *     scannedAt: ISO string,
 *   }
 */

const fs   = require('fs/promises');
const path = require('path');
const { buildTimeline } = require('./timeline');

const OUT_FILE = path.join(__dirname, '..', 'dashboard.html');

// ── Status badge helpers ───────────────────────────────────────────────────────

const STATUS_COLORS = {
  'Working':           { bg: '#166534', fg: '#bbf7d0', border: '#15803d' },
  'Partially Working': { bg: '#854d0e', fg: '#fef08a', border: '#ca8a04' },
  'Broken':            { bg: '#7f1d1d', fg: '#fecaca', border: '#dc2626' },
  'Not Configured':    { bg: '#1e3a5f', fg: '#bfdbfe', border: '#3b82f6' },
};

function badge(status) {
  const c = STATUS_COLORS[status] || STATUS_COLORS['Not Configured'];
  return `<span style="background:${c.bg};color:${c.fg};border:1px solid ${c.border};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${status}</span>`;
}

function levelIcon(level) {
  return level === 'error' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
}

// ── Per-page section ───────────────────────────────────────────────────────────

function buildPageSection(page) {
  const d = page.decision;

  const tagRows = Object.entries(d.tags).map(([name, t]) => `
    <tr>
      <td style="padding:6px 10px;color:#e2e8f0;font-weight:600;text-transform:uppercase;font-size:11px">${name}</td>
      <td style="padding:6px 10px">${badge(t.status)}</td>
      <td style="padding:6px 10px;color:#94a3b8;font-size:12px">${t.rootCause || '—'}</td>
    </tr>`).join('');

  const explanationRows = (page.explanations || []).map((e) => `
    <div style="border-left:3px solid ${e.level === 'error' ? '#dc2626' : e.level === 'warning' ? '#ca8a04' : '#3b82f6'};padding:8px 12px;margin:6px 0;background:#1e293b;border-radius:0 4px 4px 0">
      <div style="font-weight:600;color:#f1f5f9;font-size:13px">${levelIcon(e.level)} [${e.tag}] ${e.what}</div>
      <div style="color:#94a3b8;font-size:12px;margin-top:4px"><strong>Why:</strong> ${e.why}</div>
      <div style="color:#94a3b8;font-size:12px"><strong>Impact:</strong> ${e.impact}</div>
      <div style="color:#94a3b8;font-size:12px"><strong>Action:</strong> ${e.action}</div>
    </div>`).join('');

  // Timeline from accept scenario (most data)
  const timeline = buildTimeline(page.accept?.timeline || []);

  const overallColor = STATUS_COLORS[d.overall] || STATUS_COLORS['Not Configured'];

  return `
    <details style="margin-bottom:12px;border:1px solid #334155;border-radius:8px;overflow:hidden">
      <summary style="padding:12px 16px;background:#1e293b;cursor:pointer;display:flex;align-items:center;gap:12px;list-style:none">
        <span style="flex:1;color:#e2e8f0;font-size:13px;font-weight:600;font-family:monospace">${page.url}</span>
        <span style="background:${overallColor.bg};color:${overallColor.fg};border:1px solid ${overallColor.border};padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700">${d.overall}</span>
        <span style="color:#64748b;font-size:11px">${Math.round(page.durationMs / 1000)}s</span>
      </summary>
      <div style="padding:16px;background:#0f172a">

        <!-- Tag status table -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead>
            <tr style="border-bottom:1px solid #334155">
              <th style="padding:6px 10px;text-align:left;color:#64748b;font-size:11px">TAG</th>
              <th style="padding:6px 10px;text-align:left;color:#64748b;font-size:11px">STATUS</th>
              <th style="padding:6px 10px;text-align:left;color:#64748b;font-size:11px">ROOT CAUSE</th>
            </tr>
          </thead>
          <tbody>${tagRows}</tbody>
        </table>

        <!-- Explanations -->
        ${explanationRows ? `<div style="margin-bottom:16px"><div style="color:#64748b;font-size:11px;margin-bottom:6px;text-transform:uppercase">Analysis</div>${explanationRows}</div>` : ''}

        <!-- Timeline -->
        <div style="margin-bottom:8px">
          <div style="color:#64748b;font-size:11px;margin-bottom:6px;text-transform:uppercase">Timeline (Accept scenario)</div>
          ${timeline}
        </div>

        <!-- Scenario summary row -->
        <div style="display:flex;gap:12px;margin-top:12px;font-size:11px;color:#64748b">
          <span>Accept: ${page.accept?.consentAction || '—'}</span>
          <span>Reject: ${page.reject?.consentAction || '—'}</span>
          <span>No-action: ${page.noAction?.consentAction || 'no-action'}</span>
          <span>CMP: ${page.accept?.cmp?.vendor || page.reject?.cmp?.vendor || 'none'}</span>
        </div>

      </div>
    </details>`;
}

// ── Per-domain section ────────────────────────────────────────────────────────

function buildDomainSection(domainReport) {
  const pages    = domainReport.pages || [];
  const broken   = pages.filter((p) => p.decision?.overall === 'Broken').length;
  const partial  = pages.filter((p) => p.decision?.overall === 'Partially Working').length;
  const working  = pages.filter((p) => p.decision?.overall === 'Working').length;
  const gdprHits = pages.filter((p) => (p.decision?.gdprConcerns?.length || 0) > 0).length;

  const domainStatus = broken > 0 ? 'Broken' : partial > 0 ? 'Partially Working' : 'Working';
  const dc = STATUS_COLORS[domainStatus];

  const pageSections = pages.map(buildPageSection).join('');

  return `
    <div style="margin-bottom:32px">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #334155">
        <h2 style="margin:0;color:#f1f5f9;font-size:20px">${domainReport.domain}</h2>
        <span style="background:${dc.bg};color:${dc.fg};border:1px solid ${dc.border};padding:3px 12px;border-radius:6px;font-size:12px;font-weight:700">${domainStatus}</span>
        ${gdprHits > 0 ? `<span style="background:#7f1d1d;color:#fca5a5;border:1px solid #ef4444;padding:3px 12px;border-radius:6px;font-size:12px;font-weight:700">⚠ ${gdprHits} GDPR issue${gdprHits > 1 ? 's' : ''}</span>` : ''}
        <span style="margin-left:auto;color:#64748b;font-size:12px">
          ${working} working · ${partial} partial · ${broken} broken · ${pages.length} pages scanned
        </span>
      </div>
      ${pageSections || '<p style="color:#64748b">No pages scanned yet.</p>'}
    </div>`;
}

// ── Full dashboard ────────────────────────────────────────────────────────────

async function buildDashboard(domainReports) {
  const generatedAt  = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Paris' });
  const totalBroken  = domainReports.reduce((n, d) => n + (d.pages || []).filter((p) => p.decision?.overall === 'Broken').length, 0);
  const totalGdpr    = domainReports.reduce((n, d) => n + (d.pages || []).filter((p) => (p.decision?.gdprConcerns?.length || 0) > 0).length, 0);
  const totalPages   = domainReports.reduce((n, d) => n + (d.pages || []).length, 0);

  const headerStatus = totalBroken > 0 || totalGdpr > 0 ? '🔴 Issues Detected' : '🟢 All Systems Working';

  const domainSections = domainReports.map(buildDomainSection).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tracking Monitor Dashboard</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #020617; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    details > summary::-webkit-details-marker { display: none; }
    details > summary::before { content: '▶ '; color: #64748b; }
    details[open] > summary::before { content: '▼ '; }
  </style>
</head>
<body>
  <div style="max-width:1200px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding:20px 24px;background:#0f172a;border-radius:12px;border:1px solid #1e293b">
      <div>
        <h1 style="margin:0 0 4px;font-size:24px;color:#f1f5f9">Tracking Monitor</h1>
        <div style="color:#64748b;font-size:13px">Last scan: ${generatedAt} CET · ${totalPages} pages across ${domainReports.length} domains</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:700;color:${totalBroken > 0 || totalGdpr > 0 ? '#f87171' : '#4ade80'}">${headerStatus}</div>
        ${totalGdpr > 0 ? `<div style="color:#fca5a5;font-size:13px;margin-top:4px">⚠ ${totalGdpr} GDPR concern${totalGdpr > 1 ? 's' : ''} require immediate attention</div>` : ''}
      </div>
    </div>

    <!-- Quick summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:32px">
      ${domainReports.map((d) => {
        const pages   = d.pages || [];
        const broken  = pages.filter((p) => p.decision?.overall === 'Broken').length;
        const gdpr    = pages.filter((p) => (p.decision?.gdprConcerns?.length || 0) > 0).length;
        const color   = broken > 0 || gdpr > 0 ? '#7f1d1d' : '#166534';
        const border  = broken > 0 || gdpr > 0 ? '#dc2626' : '#15803d';
        const fg      = broken > 0 || gdpr > 0 ? '#fca5a5' : '#bbf7d0';
        return `
          <div style="background:${color};border:1px solid ${border};border-radius:8px;padding:14px;text-align:center">
            <div style="font-weight:700;color:${fg};font-size:14px">${d.domain}</div>
            <div style="color:${fg};font-size:12px;margin-top:4px;opacity:0.8">${pages.length} pages · ${broken} broken${gdpr > 0 ? ` · ${gdpr} GDPR` : ''}</div>
          </div>`;
      }).join('')}
    </div>

    <!-- Domain sections -->
    ${domainSections}

    <div style="text-align:center;color:#334155;font-size:11px;margin-top:32px">
      Generated by Tracking Monitor v4 · Auto-refreshes on each scan cycle
    </div>

  </div>
  <script>
    // Auto-reload every 60s if this page is open in a browser
    setTimeout(() => location.reload(), 60000);
  </script>
</body>
</html>`;

  await fs.writeFile(OUT_FILE, html, 'utf8');
  return OUT_FILE;
}

module.exports = { buildDashboard };
