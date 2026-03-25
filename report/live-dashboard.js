'use strict';

function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tracking Monitor — Live</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;height:100vh;display:flex;flex-direction:column}
a{color:inherit;text-decoration:none}
code{font-family:'SF Mono','Fira Code',monospace;font-size:11px}

/* Layout */
#header{background:#0f172a;border-bottom:1px solid #1e293b;padding:14px 20px;display:flex;align-items:center;gap:20px;flex-shrink:0}
#header h1{font-size:18px;color:#f1f5f9;font-weight:700}
#header .meta{color:#64748b;font-size:12px;margin-left:auto;text-align:right;line-height:1.6}
#domain-bar{background:#0f172a;border-bottom:1px solid #1e293b;padding:10px 20px;display:flex;gap:10px;flex-wrap:wrap;flex-shrink:0}
#filters{background:#0f172a;border-bottom:1px solid #1e293b;padding:8px 20px;display:flex;gap:10px;align-items:center;flex-shrink:0;flex-wrap:wrap}
#main{display:flex;flex:1;overflow:hidden}
#list-pane{flex:1;overflow-y:auto;min-width:0}
#detail-pane{width:520px;background:#0f172a;border-left:1px solid #1e293b;overflow-y:auto;display:none;flex-shrink:0}

/* Domain cards */
.dcard{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px;cursor:pointer;white-space:nowrap}
.dcard.active{border-color:#3b82f6;background:#1e3a5f}
.dcard h3{font-size:12px;color:#94a3b8;margin-bottom:4px}
.dcard .val{font-size:16px;font-weight:700;color:#f1f5f9}
.dcard .sub{font-size:10px;color:#64748b;margin-top:2px}

/* Filters */
.filter-btn{background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;transition:all .15s}
.filter-btn.active,.filter-btn:hover{background:#334155;color:#f1f5f9;border-color:#475569}
#search{background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:4px 10px;border-radius:6px;font-size:12px;width:200px;outline:none}
#search:focus{border-color:#3b82f6}

/* Table */
table{width:100%;border-collapse:collapse}
thead th{position:sticky;top:0;background:#020617;padding:8px 10px;text-align:left;color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #1e293b;z-index:10;white-space:nowrap}
tbody tr{border-bottom:1px solid #0f172a;cursor:pointer;transition:background .1s}
tbody tr:hover{background:#0f172a}
tbody tr.selected{background:#1e3a5f}
tbody tr.you-row{border-left:3px solid #22c55e}
td{padding:8px 10px;vertical-align:middle}

/* Badges */
.badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;border:1px solid;white-space:nowrap}
.bg-green{background:#166534;color:#bbf7d0;border-color:#15803d}
.bg-red{background:#7f1d1d;color:#fecaca;border-color:#dc2626}
.bg-yellow{background:#713f12;color:#fef08a;border-color:#ca8a04}
.bg-blue{background:#1e3a5f;color:#bfdbfe;border-color:#3b82f6}
.bg-gray{background:#1e293b;color:#94a3b8;border-color:#334155}

/* Status dots */
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}
.dot-green{background:#22c55e}
.dot-red{background:#ef4444}
.dot-yellow{background:#eab308}
.dot-gray{background:#475569}

/* Detail pane */
#detail-pane .dp-header{padding:16px 20px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between}
#detail-pane .dp-header h2{font-size:15px;color:#f1f5f9}
#detail-close{background:none;border:none;color:#64748b;font-size:20px;cursor:pointer;padding:0 4px;line-height:1}
#detail-close:hover{color:#f1f5f9}
.dp-section{padding:14px 20px;border-bottom:1px solid #1e293b}
.dp-section h3{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin-bottom:10px}
.dp-row{display:flex;gap:8px;margin-bottom:6px;align-items:flex-start}
.dp-row .label{color:#64748b;width:100px;flex-shrink:0;font-size:12px}
.dp-row .value{color:#e2e8f0;font-size:12px;word-break:break-all}

/* Timeline */
.tl-item{display:flex;gap:12px;margin-bottom:12px}
.tl-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:3px}
.tl-dot-blue{background:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.2)}
.tl-dot-green{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.2)}
.tl-dot-gray{background:#475569}
.tl-content .tl-time{font-size:11px;color:#64748b;font-family:monospace}
.tl-content .tl-title{font-size:13px;font-weight:600;color:#f1f5f9;margin:2px 0 6px}
.tl-tags{display:flex;flex-wrap:wrap;gap:4px}

/* Issues */
.issue{border-radius:6px;padding:10px 12px;margin-bottom:8px;border:1px solid}
.issue-critical{background:#3b0000;border-color:#dc2626}
.issue-error{background:#3b0000;border-color:#ef4444}
.issue-warning{background:#3b1a00;border-color:#f59e0b}
.issue-info{background:#0c1a30;border-color:#3b82f6}
.issue-ok{background:#052e16;border-color:#22c55e}
.issue h4{font-size:12px;font-weight:700;margin-bottom:4px}
.issue-critical h4,.issue-error h4{color:#fca5a5}
.issue-warning h4{color:#fde68a}
.issue-info h4{color:#93c5fd}
.issue-ok h4{color:#86efac}
.issue p{font-size:11px;line-height:1.5;color:#94a3b8;margin-bottom:3px}
.issue .fix{color:#64748b;font-style:italic}

/* Raw JSON */
.raw-toggle{background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:11px;width:100%}
.raw-toggle:hover{background:#334155}
pre{background:#020617;border:1px solid #1e293b;border-radius:6px;padding:12px;font-size:10px;color:#64748b;overflow-x:auto;margin-top:6px;line-height:1.5;max-height:300px;overflow-y:auto}

/* Loading */
#loading{position:fixed;inset:0;background:#020617;display:flex;align-items:center;justify-content:center;z-index:100;font-size:16px;color:#64748b}
</style>
</head>
<body>

<div id="loading">Loading visits…</div>

<!-- Header -->
<div id="header">
  <div>
    <h1>📡 Tracking Monitor</h1>
    <div style="color:#64748b;font-size:12px;margin-top:2px">Live visit data · GTM tag debug view</div>
  </div>
  <div id="header-stats" style="display:flex;gap:20px;align-items:center">
    <div style="text-align:center"><div id="stat-total" style="font-size:22px;font-weight:700;color:#f1f5f9">—</div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Visits</div></div>
    <div style="text-align:center"><div id="stat-consent" style="font-size:22px;font-weight:700;color:#22c55e">—</div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Consent Given</div></div>
    <div style="text-align:center"><div id="stat-issues" style="font-size:22px;font-weight:700;color:#f87171">—</div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Issues</div></div>
  </div>
  <div class="meta" id="header-meta">Fetching…</div>
</div>

<!-- Domain cards -->
<div id="domain-bar"></div>

<!-- Filters -->
<div id="filters">
  <span style="color:#64748b;font-size:11px">Filter:</span>
  <button class="filter-btn active" data-filter="all">All</button>
  <button class="filter-btn" data-filter="page-view">Page View only</button>
  <button class="filter-btn" data-filter="post-consent">Post-Consent only</button>
  <button class="filter-btn" data-filter="issues">Issues only</button>
  <button class="filter-btn" data-filter="you">My visits</button>
  <input id="search" type="text" placeholder="Search domain / path / IP…">
  <button class="filter-btn" onclick="reload()" style="margin-left:auto">↻ Refresh</button>
</div>

<!-- Main -->
<div id="main">
  <div id="list-pane">
    <table>
      <thead>
        <tr>
          <th style="width:170px">Time (IST)</th>
          <th style="width:90px">IP</th>
          <th>Domain / Path</th>
          <th style="width:90px">Event</th>
          <th style="width:70px">Consent</th>
          <th style="width:40px" title="GTM">GTM</th>
          <th style="width:40px" title="Meta Pixel">Meta</th>
          <th style="width:40px" title="Google Ads">Ads</th>
          <th style="width:40px" title="TikTok">TTK</th>
          <th style="width:80px">Issues</th>
        </tr>
      </thead>
      <tbody id="visit-tbody"></tbody>
    </table>
  </div>
  <div id="detail-pane">
    <div class="dp-header">
      <h2>Visit Details</h2>
      <button id="detail-close" onclick="closeDetail()">✕</button>
    </div>
    <div id="detail-content"></div>
  </div>
</div>

<script>
var allVisits = [];
var yourIp = '';
var byDomain = {};
var activeFilter = 'all';
var activeSearch = '';
var activeDomain = '';
var selectedIdx = -1;

/* ── Helpers ─────────────────────────────── */
function toIST(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  var ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 23).replace('T', ' ') + ' IST';
}

function timeDiffMs(a, b) {
  return new Date(b).getTime() - new Date(a).getTime();
}

function consentColor(given) {
  if (given === true)  return '#22c55e';
  if (given === false) return '#f87171';
  return '#64748b';
}
function consentLabel(given) {
  if (given === true)  return '✅ Given';
  if (given === false) return '❌ Denied';
  return '— Unknown';
}
function tagDot(val) {
  return '<span class="dot ' + (val ? 'dot-green' : 'dot-red') + '"></span>';
}

/* ── Issue analysis ──────────────────────── */
function analyzeIssues(pv, pc) {
  var issues = [];
  var pvTags = (pv && pv.tags) || {};
  var pcTags = (pc && pc.tags) || {};
  var consent = (pc && pc.consent) || (pv && pv.consent) || {};
  var given = consent.given;

  // GTM not loaded
  if (pv && !pvTags.gtmLoaded) {
    issues.push({ level: 'critical', tag: 'GTM',
      message: 'GTM container did not load',
      rootCause: 'GTM script blocked by ad blocker, CSP policy, or snippet missing from page.',
      fix: 'Check network tab for GTM-K46FQXLS request. Verify snippet in <head>.' });
  }

  // No post-consent beacon
  if (!pc) {
    issues.push({ level: 'info', tag: 'CMP',
      message: 'No post-consent beacon received',
      rootCause: 'Either (1) new visitor with no prior consent cookie, or (2) the GTM script still uses the old version which does not set eventType — both beacons look identical so they cannot be paired.',
      fix: 'Update the Tracking Health Monitor GTM script to the latest version (detects {{Event}} variable and sends eventType: post-consent on cmpEventLoadFinished).' });
  } else {
    // Meta Pixel
    if (given === true && !pcTags.metaPixel) {
      issues.push({ level: 'error', tag: 'Meta Pixel',
        message: 'Meta Pixel did not fire after consent accepted',
        rootCause: 'Meta_Pageview tag is missing the cmpEventLoadFinished trigger, has wrong pixel ID, or a JS error is preventing it from loading.',
        fix: 'GTM → Meta_Pageview → verify trigger = cmpEventLoadFinished. Check Meta Business Manager for correct pixel ID.' });
    } else if (given === false && pcTags.metaPixel) {
      issues.push({ level: 'critical', tag: 'Meta Pixel',
        message: '🚨 GDPR VIOLATION: Meta Pixel fired after consent was REFUSED',
        rootCause: 'Meta Pixel tag has All Pages or Initialization trigger without a consent check.',
        fix: 'GTM → Meta_Pageview → remove All Pages trigger → keep only cmpEventLoadFinished.' });
    }

    // Google Ads
    if (given === true && !pcTags.googleAds) {
      issues.push({ level: 'error', tag: 'Google Ads',
        message: 'Google Ads did not fire after consent accepted',
        rootCause: 'Consent Mode may be blocking the tag, or Initialization - All Pages trigger is missing.',
        fix: 'GTM → Google_Ads_PageView → verify Initialization - All Pages trigger is present.' });
    } else if (given === false && pcTags.googleAds) {
      issues.push({ level: 'info', tag: 'Google Ads',
        message: 'Firing in restricted mode (Consent Mode v2)',
        rootCause: 'Expected behaviour. Google Ads fires without cookies for conversion modelling. This is NOT a GDPR violation.',
        fix: 'No action needed.' });
    }

    // TikTok
    if (given === true && !pcTags.tiktok) {
      issues.push({ level: 'warning', tag: 'TikTok',
        message: 'TikTok Pixel not firing after consent accepted',
        rootCause: 'TikTok_Pageview tag may be missing the cmpEventLoadFinished trigger.',
        fix: 'GTM → TikTok_Pageview → add cmpEventLoadFinished trigger.' });
    } else if (given === false && pcTags.tiktok) {
      issues.push({ level: 'critical', tag: 'TikTok',
        message: '🚨 GDPR VIOLATION: TikTok fired after consent was REFUSED',
        rootCause: 'TikTok tag fires without waiting for consent.',
        fix: 'GTM → TikTok_Pageview → remove All Pages trigger → keep only cmpEventLoadFinished.' });
    }
  }

  return issues;
}

/* ── Group page-view + post-consent pairs ── */
function groupVisits(visits) {
  var sorted = visits.slice().sort(function(a, b) {
    return new Date(a.receivedAt || a.timestamp || 0) - new Date(b.receivedAt || b.timestamp || 0);
  });
  var groups = [];
  var used = {};

  for (var i = 0; i < sorted.length; i++) {
    if (used[i]) continue;
    var v = sorted[i];
    var group = { pageView: null, postConsent: null };

    // Explicit post-consent beacon with no matching page-view
    if (v.eventType === 'post-consent') {
      group.postConsent = v;
      used[i] = true;
      groups.push(group);
      continue;
    }

    group.pageView = v;

    // Look for a second beacon from the same session (same IP+domain+path within 3 min).
    // Accept regardless of eventType — old GTM script doesn't set it.
    // Prefer explicit 'post-consent', otherwise take any second beacon that arrived later.
    for (var j = i + 1; j < sorted.length; j++) {
      if (used[j]) continue;
      var v2 = sorted[j];
      if (v2.ip !== v.ip || v2.domain !== v.domain || v2.path !== v.path) continue;
      var diff = new Date(v2.receivedAt || 0) - new Date(v.receivedAt || 0);
      if (diff <= 0 || diff > 180000) continue;
      group.postConsent = v2;
      used[j] = true;
      break;
    }

    used[i] = true;
    groups.push(group);
  }
  return groups.reverse(); // newest first
}

/* ── Render domain cards ─────────────────── */
function renderDomainCards() {
  var bar = document.getElementById('domain-bar');
  var html = '<div class="dcard' + (!activeDomain ? ' active' : '') + '" onclick="setDomain(\\'\\')"><h3>All Domains</h3><div class="val">' + allVisits.length + '</div><div class="sub">visits</div></div>';
  Object.keys(byDomain).sort().forEach(function(d) {
    var s = byDomain[d];
    var pct = s.visits ? Math.round(s.consentGiven / s.visits * 100) : 0;
    html += '<div class="dcard' + (activeDomain === d ? ' active' : '') + '" onclick="setDomain(\\'' + d + '\\')"><h3>' + d + '</h3><div class="val">' + s.visits + '</div><div class="sub">↑' + pct + '% consent · GTM ' + Math.round(s.gtmLoaded/s.visits*100) + '%</div></div>';
  });
  bar.innerHTML = html;
}

/* ── Filter logic ───────────────────────── */
function getFilteredGroups() {
  var filtered = allVisits.filter(function(v) {
    if (activeDomain && v.domain !== activeDomain) return false;
    if (activeSearch) {
      var q = activeSearch.toLowerCase();
      if ((v.domain || '').indexOf(q) < 0 && (v.path || '').indexOf(q) < 0 && (v.ip || '').indexOf(q) < 0) return false;
    }
    return true;
  });
  var groups = groupVisits(filtered);
  return groups.filter(function(g) {
    var pv = g.pageView, pc = g.postConsent;
    if (activeFilter === 'page-view' && !pv) return false;
    if (activeFilter === 'post-consent' && !pc) return false;
    if (activeFilter === 'you') {
      var v = pv || pc;
      if (!v || !v.isYou) return false;
    }
    if (activeFilter === 'issues') {
      var iss = analyzeIssues(pv, pc);
      if (!iss.some(function(i) { return i.level === 'error' || i.level === 'critical' || i.level === 'warning'; })) return false;
    }
    return true;
  });
}

/* ── Render visit list ──────────────────── */
function renderList() {
  var groups = getFilteredGroups();
  var tbody = document.getElementById('visit-tbody');
  var issueCount = 0;
  var html = '';

  groups.forEach(function(g, idx) {
    var pv = g.pageView, pc = g.postConsent;
    var v = pv || pc;
    var tags = (pc && pc.tags) || (pv && pv.tags) || {};
    var consent = (pc && pc.consent) || (pv && pv.consent) || {};
    var issues = analyzeIssues(pv, pc);
    var hasError = issues.some(function(i) { return i.level === 'error' || i.level === 'critical'; });
    var hasWarn = !hasError && issues.some(function(i) { return i.level === 'warning'; });
    if (hasError) issueCount++;

    var isYou = v && v.isYou;
    var ts = toIST(v && (v.receivedAt || v.timestamp));
    var eventBadge = pc && pv ? '<span class="badge bg-green">Both</span>'
                   : pc ? '<span class="badge bg-blue">Post</span>'
                   : '<span class="badge bg-gray">Page</span>';
    var issueBadge = hasError ? '<span class="badge bg-red">' + issues.filter(function(i){return i.level==='error'||i.level==='critical';}).length + ' Error</span>'
                  : hasWarn ? '<span class="badge bg-yellow">Warn</span>'
                  : issues.length > 0 ? '<span class="badge bg-blue">Info</span>'
                  : '<span style="color:#22c55e;font-size:11px">✓ OK</span>';
    var ipDisplay = isYou ? '<span style="color:#22c55e;font-weight:700">' + (v.ip||'—') + ' 👈</span>' : '<span style="color:#64748b">' + (v.ip||'—') + '</span>';

    html += '<tr data-idx="' + idx + '" class="' + (isYou ? 'you-row' : '') + (selectedIdx === idx ? ' selected' : '') + '" onclick="showDetail(' + idx + ')">';
    html += '<td><code>' + ts + '</code></td>';
    html += '<td>' + ipDisplay + '</td>';
    html += '<td><span style="color:#e2e8f0">' + (v&&v.domain||'—') + '</span><span style="color:#475569;margin-left:4px">' + (v&&v.path||'') + '</span></td>';
    html += '<td>' + eventBadge + '</td>';
    html += '<td><span style="color:' + consentColor(consent.given) + ';font-size:11px">' + consentLabel(consent.given) + '</span></td>';
    html += '<td style="text-align:center">' + tagDot(tags.gtmLoaded) + '</td>';
    html += '<td style="text-align:center">' + tagDot(tags.metaPixel) + '</td>';
    html += '<td style="text-align:center">' + tagDot(tags.googleAds) + '</td>';
    html += '<td style="text-align:center">' + tagDot(tags.tiktok) + '</td>';
    html += '<td>' + issueBadge + '</td>';
    html += '</tr>';
  });

  tbody.innerHTML = html || '<tr><td colspan="10" style="padding:40px;text-align:center;color:#475569">No visits match the current filter.</td></tr>';

  // Update header stats
  document.getElementById('stat-total').textContent = allVisits.length;
  var totalConsent = Object.values(byDomain).reduce(function(s, d) { return s + d.consentGiven; }, 0);
  document.getElementById('stat-consent').textContent = totalConsent;
  document.getElementById('stat-issues').textContent = issueCount;
}

/* ── Detail pane ─────────────────────────── */
var _groups = [];
function showDetail(idx) {
  var groups = getFilteredGroups();
  _groups = groups;
  selectedIdx = idx;
  var g = groups[idx];
  if (!g) return;
  var pv = g.pageView, pc = g.postConsent;
  var v = pv || pc;
  var issues = analyzeIssues(pv, pc);

  // Highlight row
  document.querySelectorAll('#visit-tbody tr').forEach(function(r) { r.classList.remove('selected'); });
  var row = document.querySelector('#visit-tbody tr[data-idx="' + idx + '"]');
  if (row) row.classList.add('selected');

  var html = '';

  /* Meta info */
  html += '<div class="dp-section"><h3>Visit Info</h3>';
  html += row_(pv, 'Time (IST)', toIST(v && (v.receivedAt || v.timestamp)));
  html += row_(pv, 'IP', (v&&v.ip||'—') + (v&&v.isYou ? ' <span class="badge bg-green" style="font-size:9px">You</span>' : ''));
  html += row_(pv, 'Domain', v&&v.domain||'—');
  html += row_(pv, 'Path', '<code>' + (v&&v.path||'—') + '</code>');
  html += row_(pv, 'Referrer', (v&&v.referrer) ? '<code style="font-size:10px">' + v.referrer + '</code>' : '<span style="color:#475569">Direct / None</span>');
  html += row_(pv, 'Language', v&&v.language||'—');
  html += row_(pv, 'CMP Vendor', (v&&v.consent&&v.consent.vendor) || '<span style="color:#475569">Not detected</span>');
  html += '</div>';

  /* Timeline */
  html += '<div class="dp-section"><h3>Debug Timeline</h3>';

  if (pv) {
    var pvTags = pv.tags || {};
    var pvTime = toIST(pv.receivedAt || pv.timestamp);
    html += '<div class="tl-item"><div class="tl-dot tl-dot-blue"></div><div class="tl-content">';
    html += '<div class="tl-time">' + pvTime + '</div>';
    html += '<div class="tl-title">Page View · GTM fired "All Pages"</div>';
    html += '<div class="tl-tags">';
    html += tagBadge('GTM', pvTags.gtmLoaded, 'Loaded', 'Not loaded');
    html += tagBadge('Meta Pixel', pvTags.metaPixel, 'Loaded', 'Not yet (expected)');
    html += tagBadge('Google Ads', pvTags.googleAds, 'Loaded (restricted)', 'Not loaded');
    html += tagBadge('TikTok', pvTags.tiktok, 'Loaded', 'Not yet (expected)');
    html += '</div>';
    html += '<div style="margin-top:6px;font-size:11px;color:' + consentColor(pv.consent&&pv.consent.given) + '">Consent at this moment: ' + consentLabel(pv.consent&&pv.consent.given) + (pv.consent&&pv.consent.vendor ? ' (' + pv.consent.vendor + ')' : '') + '</div>';
    html += '</div></div>';
  }

  if (pc) {
    var pcTags = pc.tags || {};
    var pcTime = toIST(pc.receivedAt || pc.timestamp);
    var delay = pv ? '+' + timeDiffMs(pv.receivedAt||pv.timestamp, pc.receivedAt||pc.timestamp) + 'ms' : '';
    html += '<div class="tl-item"><div class="tl-dot tl-dot-green"></div><div class="tl-content">';
    html += '<div class="tl-time">' + pcTime + (delay ? ' <span style="color:#64748b">(' + delay + ' after page view)</span>' : '') + '</div>';
    html += '<div class="tl-title">cmpEventLoadFinished · Consent resolved</div>';
    html += '<div class="tl-tags">';
    html += tagBadge('Meta Pixel', pcTags.metaPixel, 'Fired ✅', 'Not fired ❌');
    html += tagBadge('Google Ads', pcTags.googleAds, pc.consent&&pc.consent.given ? 'Full mode ✅' : 'Restricted mode', 'Not fired ❌');
    html += tagBadge('TikTok', pcTags.tiktok, 'Fired ✅', 'Not fired ❌');
    html += '</div>';
    html += '<div style="margin-top:6px;font-size:11px;color:' + consentColor(pc.consent&&pc.consent.given) + '">Consent: ' + consentLabel(pc.consent&&pc.consent.given) + (pc.consent&&pc.consent.vendor ? ' via ' + pc.consent.vendor : '') + '</div>';

    // Tag IDs
    if (pc.tagIds) {
      if (pc.tagIds.meta && pc.tagIds.meta.length) {
        html += '<div style="margin-top:4px;font-size:11px;color:#64748b">Meta Pixel IDs: <code>' + pc.tagIds.meta.join(', ') + '</code></div>';
      }
      if (pc.tagIds.googleAds && pc.tagIds.googleAds.length) {
        html += '<div style="margin-top:2px;font-size:11px;color:#64748b">Google Ads IDs: <code>' + pc.tagIds.googleAds.join(', ') + '</code></div>';
      }
    }
    html += '</div></div>';
  } else {
    html += '<div class="tl-item"><div class="tl-dot tl-dot-gray"></div><div class="tl-content">';
    html += '<div class="tl-title" style="color:#475569">cmpEventLoadFinished — second beacon not paired</div>';
    html += '<div style="font-size:11px;color:#f59e0b;margin-top:4px">⚠ If you already added cmpEventLoadFinished trigger: the GTM script needs updating — it must detect <code>{{Event}}</code> and send <code>eventType: "post-consent"</code> so the two beacons can be matched. Copy the latest script below.</div>';
    html += '</div></div>';
  }
  html += '</div>';

  /* Issues */
  html += '<div class="dp-section"><h3>Issues & Analysis</h3>';
  if (issues.length === 0) {
    html += '<div class="issue issue-ok"><h4>✓ No issues detected</h4><p>All tags fired correctly relative to consent state.</p></div>';
  } else {
    issues.forEach(function(iss) {
      html += '<div class="issue issue-' + iss.level + '">';
      var icon = iss.level === 'critical' ? '🚨' : iss.level === 'error' ? '❌' : iss.level === 'warning' ? '⚠️' : 'ℹ️';
      html += '<h4>' + icon + ' [' + iss.tag + '] ' + iss.message + '</h4>';
      html += '<p><strong>Root cause:</strong> ' + iss.rootCause + '</p>';
      if (iss.fix && iss.fix !== 'No action needed.') {
        html += '<p class="fix">→ Fix: ' + iss.fix + '</p>';
      } else if (iss.fix) {
        html += '<p style="color:#22c55e;font-size:11px">✓ ' + iss.fix + '</p>';
      }
      html += '</div>';
    });
  }
  html += '</div>';

  /* Raw payload */
  html += '<div class="dp-section"><h3>Raw Payload</h3>';
  if (pv) {
    html += '<button class="raw-toggle" onclick="toggleRaw(\\'raw-pv\\')">▶ Page View beacon</button>';
    html += '<pre id="raw-pv" style="display:none">' + JSON.stringify(pv, null, 2) + '</pre>';
  }
  if (pc) {
    html += '<button class="raw-toggle" onclick="toggleRaw(\\'raw-pc\\')" style="margin-top:6px">▶ Post-Consent beacon</button>';
    html += '<pre id="raw-pc" style="display:none">' + JSON.stringify(pc, null, 2) + '</pre>';
  }
  html += '</div>';

  document.getElementById('detail-content').innerHTML = html;
  document.getElementById('detail-pane').style.display = 'block';
}

function row_(v, label, val) {
  return '<div class="dp-row"><span class="label">' + label + '</span><span class="value">' + val + '</span></div>';
}
function tagBadge(name, val, trueLabel, falseLabel) {
  return '<span class="badge ' + (val ? 'bg-green' : 'bg-red') + '" title="' + name + '">' + name + ': ' + (val ? trueLabel : falseLabel) + '</span> ';
}
function toggleRaw(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function closeDetail() {
  document.getElementById('detail-pane').style.display = 'none';
  selectedIdx = -1;
  document.querySelectorAll('#visit-tbody tr').forEach(function(r) { r.classList.remove('selected'); });
}

/* ── Filter handlers ────────────────────── */
function setDomain(d) {
  activeDomain = d;
  renderDomainCards();
  renderList();
}
document.querySelectorAll('.filter-btn[data-filter]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderList();
  });
});
document.getElementById('search').addEventListener('input', function() {
  activeSearch = this.value.trim();
  renderList();
});

/* ── Load data ──────────────────────────── */
function reload() {
  document.getElementById('loading').style.display = 'flex';
  fetch('/stats')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allVisits = data.recentVisits || [];
      yourIp    = data.yourIp || '';
      byDomain  = data.byDomain || {};
      var now = new Date();
      document.getElementById('header-meta').innerHTML =
        'Last updated: ' + toIST(now.toISOString()) + '<br>Your IP: <code style="color:#22c55e">' + yourIp + '</code>';
      renderDomainCards();
      renderList();
      document.getElementById('loading').style.display = 'none';
    })
    .catch(function(e) {
      document.getElementById('loading').innerHTML = 'Error loading data: ' + e.message;
    });
}

reload();
</script>
</body>
</html>`;
}

module.exports = { getDashboardHtml };
