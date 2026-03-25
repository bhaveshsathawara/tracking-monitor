const fs   = require('fs/promises');
const path = require('path');
const { readRecentLogs }       = require('./logger');
const { REPORTS_DIR, DOMAINS } = require('./config');

// ── Badge / cell helpers ──────────────────────────────────────────────────────

function badge(status) {
  const map = { ok: ['#22c55e','✅ OK'], warning: ['#f59e0b','⚠️ Warning'], error: ['#ef4444','❌ Error'], unknown: ['#94a3b8','— N/A'] };
  const [color, label] = map[status] || map.unknown;
  return `<span class="badge" style="background:${color}">${label}</span>`;
}

function statusCell(status) {
  const bg = { ok: '#dcfce7', warning: '#fef9c3', error: '#fee2e2', unknown: '#f1f5f9' };
  return `<td style="background:${bg[status]||bg.unknown};text-align:center">${badge(status)}</td>`;
}

function pct(n, total) {
  return total === 0 ? '—' : Math.round((n / total) * 100) + '%';
}

/**
 * Dual-layer tag cell:
 *   Row 1: GTM/JS layer (what Pixel Helper sees — tag CONFIGURED and EXECUTED)
 *   Row 2: Network layer (data actually REACHED the ad platform server)
 *
 * This is why Pixel Helper shows "fired" while our report shows "blocked" —
 * they measure different things. Both can be true at the same time.
 */
function dualTagCell(tagName, jsDetected, networkFired, networkDelivered, networkStatus, cmpBlocking) {
  // Row 1: JavaScript / GTM layer
  const jsRow = jsDetected
    ? `<div class="tag-row tag-js-ok">✅ In GTM (JS)</div>`
    : `<div class="tag-row tag-js-missing">❌ Not in GTM</div>`;

  // Row 2: Network layer
  let netRow;
  if (!networkFired && !jsDetected) {
    netRow = `<div class="tag-row tag-net-missing">❌ No request</div>`;
  } else if (cmpBlocking || (!networkDelivered && networkFired)) {
    netRow = `<div class="tag-row tag-net-blocked">🚫 Blocked by CMP</div>`;
  } else if (networkDelivered) {
    netRow = `<div class="tag-row tag-net-ok">📡 Delivered (${networkStatus})</div>`;
  } else if (jsDetected && !networkFired) {
    netRow = `<div class="tag-row tag-net-blocked">🚫 Data not sent</div>`;
  } else {
    netRow = `<div class="tag-row tag-net-missing">— No data</div>`;
  }

  return `<td style="font-size:12px;min-width:140px">${jsRow}${netRow}</td>`;
}

// ── Read real visitor data from collector logs ────────────────────────────────

async function readVisitorStats() {
  const visitorDir = path.join(__dirname, 'logs', 'visitors');
  try {
    await fs.mkdir(visitorDir, { recursive: true });
    const files = (await fs.readdir(visitorDir))
      .filter((f) => f.endsWith('.jsonl'))
      .sort().reverse().slice(0, 7);

    const visits = [];
    for (const file of files) {
      const raw = await fs.readFile(path.join(visitorDir, file), 'utf8').catch(() => '');
      for (const line of raw.split('\n').filter(Boolean)) {
        try { visits.push(JSON.parse(line)); } catch (_) {}
      }
    }

    const byDomain = {};
    for (const v of visits) {
      const d = v.domain || 'unknown';
      if (!byDomain[d]) byDomain[d] = { visits: 0, gtm: 0, meta: 0, ads: 0, consentGiven: 0, consentDenied: 0, consentUnknown: 0, vendors: {} };
      byDomain[d].visits++;
      if (v.tags?.gtm)       byDomain[d].gtm++;
      if (v.tags?.meta)      byDomain[d].meta++;
      if (v.tags?.googleAds) byDomain[d].ads++;
      if (v.consent?.given === true)  byDomain[d].consentGiven++;
      else if (v.consent?.given === false) byDomain[d].consentDenied++;
      else byDomain[d].consentUnknown++;
      if (v.consent?.vendor) byDomain[d].vendors[v.consent.vendor] = (byDomain[d].vendors[v.consent.vendor] || 0) + 1;
    }

    return { byDomain, totalVisits: visits.length, recentVisits: visits.slice(0, 50) };
  } catch (_) {
    return { byDomain: {}, totalVisits: 0, recentVisits: [] };
  }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildHTML(logs, visitorStats) {
  const latest      = logs[0];
  const genTime     = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'medium' });
  const statusOrder = { ok: 0, warning: 1, error: 2 };

  const overallStatus = latest
    ? latest.domains.reduce((w, d) =>
        statusOrder[d.summary.status] > statusOrder[w] ? d.summary.status : w, 'ok')
    : 'unknown';

  const headerBg = { ok: '#16a34a', warning: '#d97706', error: '#dc2626', unknown: '#64748b' };

  // ── Two-layer explainer ───────────────────────────────────────────────────
  const layerExplainer = `
  <div class="explainer">
    <h4>🔍 Why Pixel Helper shows "Fired" but this report shows "Blocked" — explained</h4>
    <p>Both tools are correct. They measure <strong>two different things</strong>:</p>
    <table style="width:100%;font-size:13px;margin-top:10px;border-collapse:collapse">
      <tr style="background:#f1f5f9">
        <th style="padding:8px;text-align:left;border:1px solid #e2e8f0">Tool</th>
        <th style="padding:8px;text-align:left;border:1px solid #e2e8f0">What it checks</th>
        <th style="padding:8px;text-align:left;border:1px solid #e2e8f0">What "fired" means</th>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #e2e8f0"><strong>Meta Pixel Helper<br>Google Tag Assistant</strong></td>
        <td style="padding:8px;border:1px solid #e2e8f0">JavaScript inside the browser</td>
        <td style="padding:8px;border:1px solid #e2e8f0">GTM <em>executed</em> the tag code in the browser ✅</td>
      </tr>
      <tr>
        <td style="padding:8px;border:1px solid #e2e8f0"><strong>This report (Network layer)</strong></td>
        <td style="padding:8px;border:1px solid #e2e8f0">Actual HTTP network requests</td>
        <td style="padding:8px;border:1px solid #e2e8f0">The data <em>reached</em> Meta/Google servers 📡</td>
      </tr>
    </table>
    <p style="margin-top:10px">The tag executes in GTM → but then the CMP intercepts the outgoing request → data never reaches the ad platform. <strong>Pixel Helper sees step 1. We check step 2.</strong></p>
    <p style="margin-top:6px">Each tag row in this report shows <strong>both layers</strong>: <span style="background:#dcfce7;padding:2px 6px;border-radius:4px;font-size:12px">✅ In GTM (JS)</span> = configured correctly &nbsp;|&nbsp; <span style="background:#fee2e2;padding:2px 6px;border-radius:4px;font-size:12px">🚫 Blocked by CMP</span> = data not reaching the platform.</p>
  </div>`;

  // ── Domain summary table ──────────────────────────────────────────────────
  const domainRows = latest
    ? latest.domains.map((d) => {
        const s = d.summary;
        const cmpInfo = s.cmpDetected
          ? `<span style="color:#16a34a;font-weight:600">${s.cmpVendor || 'Yes'}</span><br><span style="font-size:11px;color:${s.cmpBlocking ? '#dc2626' : '#16a34a'}">${s.cmpBlocking ? 'Holding back tags' : 'Consented OK'}</span>`
          : '<span style="color:#94a3b8">None</span>';

        return `<tr>
          <td><strong>${d.domain}</strong></td>
          ${statusCell(s.status)}
          <td style="text-align:center;font-size:12px">${s.gtmHealthy ? '✅ OK' : '❌'}</td>
          <td style="text-align:center;font-size:12px">${s.googleAdsHealthy ? '✅ OK' : (s.cmpBlocking ? '🚫 CMP' : '❌')}</td>
          <td style="text-align:center;font-size:12px">${s.metaHealthy ? '✅ OK' : (s.cmpBlocking ? '🚫 CMP' : '❌')}</td>
          <td style="text-align:center;font-size:13px">${cmpInfo}</td>
          <td style="text-align:center">${s.gdprConcern ? '<span style="color:#dc2626;font-weight:600">🚨 Yes</span>' : '<span style="color:#16a34a">OK</span>'}</td>
          <td style="text-align:center">${s.totalBlockedRequests > 0 ? `<span style="color:#dc2626;font-weight:600">${s.totalBlockedRequests}</span>` : '<span style="color:#16a34a">0</span>'}</td>
          <td class="small">${new Date(d.scannedAt).toLocaleString('en-GB')}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px">No data yet — run a scan first.</td></tr>';

  // ── Per-domain page details with dual-layer tag cells ────────────────────
  const domainDetails = latest
    ? latest.domains.map((d) => {
        const pageRows = d.pages.map((p) => {
          const v   = p.validations  || {};
          const det = p.detections   || {};
          const js  = p.jsDetection  || {};
          const cmp = p.cmp          || {};
          const pre = p.preConsentFiring || {};

          const gtmCell  = dualTagCell('GTM',
            js.gtm?.loaded,
            det.gtm?.fired,       v.gtm?.loaded,       v.gtm?.status,       v.gtm?.blocked);

          const adsCell  = dualTagCell('Google Ads',
            js.googleAds?.loaded,
            det.googleAds?.fired, v.googleAds?.scriptDelivered, v.googleAds?.scriptStatus, p.cmpBlocking);

          const metaCell = dualTagCell('Meta Pixel',
            js.meta?.loaded,
            det.meta?.fired,      v.meta?.scriptDelivered,      v.meta?.scriptStatus,      p.cmpBlocking);

          // GTM container IDs
          const containerInfo = js.gtm?.containerIds?.length
            ? `<div style="font-size:11px;color:#64748b;margin-top:2px">IDs: ${js.gtm.containerIds.join(', ')}</div>` : '';

          // Meta pixel IDs
          const metaIds = js.meta?.pixelIds?.length
            ? `<div style="font-size:11px;color:#64748b;margin-top:2px">ID: ${js.meta.pixelIds.join(', ')}</div>` : '';

          // CMP cell
          const cmpCell = `<td style="text-align:center;font-size:12px">
            ${cmp.detected ? `<span style="color:#16a34a;font-weight:600">${cmp.vendor || 'Yes'}</span><br>
              ${cmp.bannerVisible ? '<span style="color:#dc2626">Banner shown</span>' : '<span style="color:#16a34a">Banner hidden</span>'}<br>
              ${p.consentAccepted ? '<span style="color:#16a34a">✓ Accepted</span>' : (cmp.detected ? '<span style="color:#f59e0b">Not accepted</span>' : '')}
              ${p.cmpBlocking ? '<br><span style="color:#dc2626;font-weight:600">Holding back tags</span>' : (cmp.detected ? '<br><span style="color:#16a34a">Tags allowed</span>' : '')}
            ` : '<span style="color:#94a3b8">None</span>'}
          </td>`;

          // Pre-consent GDPR cell
          const gdprCell = `<td style="text-align:center;font-size:12px">
            ${pre.isGdprConcern
              ? `<span style="color:#dc2626;font-weight:700">🚨 Tags fired<br>before consent</span>`
              : `<span style="color:#16a34a">${cmp.detected ? '✅ OK' : 'No CMP'}</span>`}
          </td>`;

          // Blocked tracking URLs
          const blockedHTML = p.blockedRequests?.length
            ? p.blockedRequests.slice(0, 3).map((r) =>
                `<div class="blocked-url">${r.url.replace(/^https?:\/\//, '').replace(/\?.*/, '?…')}</div>`
              ).join('') + (p.blockedRequests.length > 3 ? `<div class="blocked-url">+${p.blockedRequests.length - 3} more</div>` : '')
            : '<span style="color:#94a3b8;font-size:11px">None</span>';

          return `<tr>
            <td class="small mono"><a href="${p.url}" target="_blank" style="color:#3b82f6">${p.url.replace(/^https?:\/\//, '')}</a></td>
            ${statusCell(p.conclusion?.status || 'unknown')}
            <td>${gtmCell.replace(/^<td[^>]*>|<\/td>$/g,'')}<br>${containerInfo}</td>
            <td>${adsCell.replace(/^<td[^>]*>|<\/td>$/g,'')}</td>
            <td>${metaCell.replace(/^<td[^>]*>|<\/td>$/g,'')}${metaIds}</td>
            ${cmpCell}
            ${gdprCell}
            <td class="small">${blockedHTML}</td>
            <td class="small" style="color:#94a3b8;text-align:center">${p.durationMs ? (p.durationMs/1000).toFixed(1)+'s' : '—'}</td>
          </tr>`;
        }).join('');

        return `
        <div class="card">
          <h3>${d.domain} &nbsp;${badge(d.summary.status)}</h3>
          ${d.summary.gdprConcern ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:13px">🚨 <strong>GDPR Concern:</strong> Tags are firing before consent is granted.</div>` : ''}
          ${d.summary.issues.length ? `<div class="issue-list">${d.summary.issues.map((i)=>`<div>⚠️ ${i}</div>`).join('')}</div>` : ''}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Page</th><th>Status</th>
                  <th>GTM<br><span style="font-weight:400;font-size:11px">JS config / Network</span></th>
                  <th>Google Ads<br><span style="font-weight:400;font-size:11px">JS config / Network</span></th>
                  <th>Meta Pixel<br><span style="font-weight:400;font-size:11px">JS config / Network</span></th>
                  <th>CMP Status</th><th>GDPR</th><th>Blocked Requests</th><th>Time</th>
                </tr>
              </thead>
              <tbody>${pageRows}</tbody>
            </table>
          </div>
          <p class="small" style="color:#94a3b8;margin-top:8px">${d.pages.length} page(s) · ${d.durationMs ? Math.round(d.durationMs/1000)+'s total' : ''}</p>
        </div>`;
      }).join('')
    : '<div class="card" style="color:#94a3b8;text-align:center;padding:30px">Run a scan to see results.</div>';

  // ── Real Visitor Data section ─────────────────────────────────────────────
  const vs = visitorStats || { byDomain: {}, totalVisits: 0, recentVisits: [] };
  const hasVisitorData = vs.totalVisits > 0;

  const visitorDomainRows = hasVisitorData
    ? Object.entries(vs.byDomain).map(([domain, s]) => `
        <tr>
          <td><strong>${domain}</strong></td>
          <td style="text-align:center">${s.visits.toLocaleString()}</td>
          <td style="text-align:center">${pct(s.gtm, s.visits)} <span class="small" style="color:#94a3b8">(${s.gtm})</span></td>
          <td style="text-align:center">${pct(s.meta, s.visits)} <span class="small" style="color:#94a3b8">(${s.meta})</span></td>
          <td style="text-align:center">${pct(s.ads, s.visits)} <span class="small" style="color:#94a3b8">(${s.ads})</span></td>
          <td style="text-align:center"><span style="color:#16a34a;font-weight:600">${pct(s.consentGiven, s.visits)}</span></td>
          <td style="text-align:center"><span style="color:#dc2626;font-weight:600">${pct(s.consentDenied, s.visits)}</span></td>
          <td style="text-align:center;color:#94a3b8">${pct(s.consentUnknown, s.visits)}</td>
          <td style="text-align:center;font-size:12px">${Object.keys(s.vendors).join(', ') || '—'}</td>
        </tr>`)
      .join('')
    : `<tr><td colspan="9" style="text-align:center;padding:30px;color:#94a3b8">
        No real visitor data yet.<br><br>
        <strong>To collect real visitor data:</strong><br>
        1. Run <code>node collector.js</code><br>
        2. Deploy it publicly (Railway, Render, etc.)<br>
        3. Add <code>gtm-tag.html</code> as a Custom HTML tag in GTM → All Pages trigger
       </td></tr>`;

  const recentVisitsRows = vs.recentVisits.slice(0, 15).map((v) => `
    <tr>
      <td class="small">${new Date(v.timestamp).toLocaleString('en-GB')}</td>
      <td class="small">${v.domain || '—'}</td>
      <td class="small mono" style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(v.path || v.url || '').replace(/^https?:\/\/[^/]+/, '')}</td>
      <td style="text-align:center;font-size:12px">${v.tags?.gtm ? '✅' : '❌'}</td>
      <td style="text-align:center;font-size:12px">${v.tags?.meta ? '✅' : '❌'}</td>
      <td style="text-align:center;font-size:12px">${v.tags?.googleAds ? '✅' : '❌'}</td>
      <td style="text-align:center;font-size:12px">${v.consent?.given === true ? '<span style="color:#16a34a">✅ Yes</span>' : v.consent?.given === false ? '<span style="color:#dc2626">❌ No</span>' : '<span style="color:#94a3b8">?</span>'}</td>
      <td class="small" style="color:#94a3b8">${v.consent?.vendor || '—'}</td>
    </tr>`).join('');

  // ── 30-run history ────────────────────────────────────────────────────────
  const historyRows = DOMAINS.map(({ domain }) => {
    const cells = logs.slice(0, 30).reverse().map((log) => {
      const d = log.domains?.find((x) => x.domain === domain);
      if (!d) return '<td style="background:#f1f5f9;text-align:center">—</td>';
      const colors = { ok: '#22c55e', warning: '#f59e0b', error: '#ef4444' };
      const ts = new Date(log.startedAt).toLocaleString('en-GB');
      return `<td style="background:${colors[d.summary.status]||'#94a3b8'};color:#fff;text-align:center;font-size:11px" title="${ts}: ${d.summary.status}">${d.summary.status[0].toUpperCase()}</td>`;
    }).join('');
    return `<tr><td style="white-space:nowrap;padding-right:12px"><strong>${domain}</strong></td>${cells}</tr>`;
  }).join('');

  const historyDates = logs.slice(0, 30).reverse().map((log) =>
    `<th style="font-size:10px;font-weight:400;white-space:nowrap">${new Date(log.startedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</th>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="refresh" content="300">
  <title>Tracking Health Dashboard</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b}
    .header{background:${headerBg[overallStatus]};color:#fff;padding:20px 32px;display:flex;justify-content:space-between;align-items:center}
    .header h1{font-size:22px;font-weight:700}
    .header .meta{font-size:13px;opacity:.85;margin-top:4px}
    .container{max-width:1400px;margin:0 auto;padding:24px 32px}
    .section-title{font-size:14px;font-weight:700;color:#475569;margin:28px 0 12px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0;padding-bottom:6px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
    .card h3{font-size:15px;margin-bottom:12px}
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f1f5f9;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;white-space:nowrap}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#fafafa}
    .badge{display:inline-block;padding:2px 10px;border-radius:999px;color:#fff;font-size:12px;font-weight:600}
    .small{font-size:12px}
    .mono{font-family:monospace}
    .issue-list{background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:13px;line-height:1.8}
    .blocked-url{font-family:monospace;font-size:11px;color:#dc2626;word-break:break-all;margin-bottom:2px}
    .explainer{background:#f0f9ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:16px;font-size:13px;line-height:1.7}
    .explainer h4{margin-bottom:8px;font-size:14px}
    .tag-row{padding:2px 6px;border-radius:4px;margin-bottom:2px;font-size:12px}
    .tag-js-ok{background:#dcfce7;color:#166534}
    .tag-js-missing{background:#fee2e2;color:#991b1b}
    .tag-net-ok{background:#dbeafe;color:#1e40af}
    .tag-net-blocked{background:#fef9c3;color:#92400e}
    .tag-net-missing{background:#f1f5f9;color:#64748b}
    .history-table td,.history-table th{padding:5px 7px;border:1px solid #e2e8f0}
    .history-table{border-collapse:collapse;width:100%}
    code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px}
    .footer{text-align:center;color:#94a3b8;font-size:12px;padding:32px}
  </style>
</head>
<body>
<div class="header">
  <div>
    <h1>📊 Tracking Health Dashboard</h1>
    <div class="meta">Last updated: ${genTime} &nbsp;·&nbsp; Auto-refreshes every 5 min</div>
    <div class="meta">Monitoring: ${DOMAINS.map((d)=>d.domain).join(' · ')}</div>
  </div>
  <div style="font-size:36px">${{ok:'✅',warning:'⚠️',error:'❌',unknown:'❓'}[overallStatus]}</div>
</div>

<div class="container">

  ${layerExplainer}

  <div class="section-title">Synthetic Monitor — Current Status (All Domains)</div>
  <div class="card">
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Domain</th><th>Overall</th><th>GTM</th><th>Google Ads</th><th>Meta Pixel</th>
          <th>CMP</th><th>GDPR</th><th>Blocked</th><th>Last Scanned</th>
        </tr></thead>
        <tbody>${domainRows}</tbody>
      </table>
    </div>
  </div>

  <div class="section-title">Page-by-Page Detail (JS Layer + Network Layer)</div>
  ${domainDetails}

  <div class="section-title">🌍 Real Visitor Data — Last 7 Days</div>
  <div class="card">
    <p class="small" style="color:#64748b;margin-bottom:12px">
      Data collected from real visitors via the GTM tag in <code>gtm-tag.html</code>.
      ${hasVisitorData ? `<strong>Total visits recorded: ${vs.totalVisits.toLocaleString()}</strong>` : 'Set up the GTM tag to start collecting.'}
    </p>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Domain</th><th>Visits</th><th>GTM Loaded</th><th>Meta Loaded</th>
          <th>Ads Loaded</th><th>Consent Given</th><th>Consent Denied</th><th>Unknown</th><th>CMP Vendor</th>
        </tr></thead>
        <tbody>${visitorDomainRows}</tbody>
      </table>
    </div>
    ${hasVisitorData ? `
    <h4 style="margin:20px 0 10px;font-size:14px">Most Recent Visits</h4>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Domain</th><th>Page</th><th>GTM</th><th>Meta</th><th>Ads</th><th>Consent</th><th>CMP</th></tr></thead>
        <tbody>${recentVisitsRows}</tbody>
      </table>
    </div>` : ''}
  </div>

  <div class="section-title">Scan History</div>
  <div class="card">
    ${logs.length === 0
      ? '<p style="color:#94a3b8;text-align:center;padding:20px">No history yet.</p>'
      : `<div class="table-wrap"><table class="history-table">
          <thead><tr><th>Domain</th>${historyDates}</tr></thead>
          <tbody>${historyRows}</tbody>
        </table></div>
        <p class="small" style="color:#94a3b8;margin-top:8px">🟢 OK &nbsp; 🟡 Warning &nbsp; 🔴 Error</p>`
    }
  </div>

</div>
<div class="footer">Tracking Monitor · ${genTime}</div>
</body>
</html>`;
}

// ── Export ────────────────────────────────────────────────────────────────────

async function generateReport(options = {}) {
  const outputPath = options.outputPath || path.join(REPORTS_DIR, 'index.html');
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const [logs, visitorStats] = await Promise.all([
    readRecentLogs(options.recentRuns || 48),
    readVisitorStats(),
  ]);

  await fs.writeFile(outputPath, buildHTML(logs, visitorStats), 'utf8');
  console.log(`[reporter] Report → ${outputPath}`);
}

module.exports = { generateReport };
