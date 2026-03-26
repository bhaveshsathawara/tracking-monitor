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
html{overflow-x:hidden}
body{background:#020617;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;height:100vh;display:flex;flex-direction:column;overflow-x:hidden}
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
#detail-pane{width:420px;background:#0f172a;border-left:1px solid #1e293b;overflow-y:auto;display:none;flex-shrink:0}

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
table{width:100%;border-collapse:collapse;table-layout:fixed}
thead th{position:sticky;top:0;background:#020617;padding:6px 8px;text-align:left;color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #1e293b;z-index:10;white-space:nowrap;overflow:hidden}
tbody tr{border-bottom:1px solid #0f172a;cursor:pointer;transition:background .1s}
tbody tr:hover{background:#0f172a}
tbody tr.selected{background:#1e3a5f}
tbody tr.you-row{border-left:3px solid #22c55e}
td{padding:6px 8px;vertical-align:middle;overflow:hidden}
.cell-ts{white-space:nowrap;font-family:'SF Mono','Fira Code',monospace;font-size:10px}
.cell-ip{font-family:'SF Mono','Fira Code',monospace;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cell-path{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.cell-tags{white-space:normal;line-height:1.8}

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

/* Detail tabs */
.dp-tabs{display:flex;border-bottom:1px solid #1e293b;padding:0 16px;background:#0a1628;flex-shrink:0}
.dp-tab{background:none;border:none;border-bottom:2px solid transparent;color:#64748b;padding:10px 14px;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap}
.dp-tab.active{color:#f1f5f9;border-bottom-color:#3b82f6}
.dp-tab:hover:not(.active){color:#e2e8f0}
#myip-input{background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:4px 10px;border-radius:6px;font-size:12px;width:190px;outline:none}
#myip-input:focus{border-color:#22c55e}

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
  <span style="color:#475569;font-size:11px">Dashboard IP: <code id="your-ip-display" style="color:#22c55e">—</code></span>
  <input id="myip-input" type="text" placeholder="fr.igraal.com IP if different" title="If your browsing IP differs from your dashboard IP, enter it here. Both IPs are searched." style="width:170px">
  <input id="search" type="text" placeholder="Search domain / path / IP…">
  <button class="filter-btn" onclick="reload()" style="margin-left:auto">↻ Refresh</button>
  <span id="countdown-display" style="color:#475569;font-size:11px">Auto-refresh in <span id="countdown-num">30</span>s</span>
</div>

<!-- Main -->
<div id="main">
  <div id="list-pane">
    <table>
      <thead>
        <tr>
          <th style="width:148px">Time (IST)</th>
          <th style="width:88px">IP</th>
          <th style="min-width:0">Domain / Path</th>
          <th style="width:52px">Event</th>
          <th style="width:108px">Consent</th>
          <th style="width:170px">Tag Status</th>
          <th style="width:72px">Issues</th>
          <th style="width:28px"></th>
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
var myIp = '';       // IP set manually by user to find their own visits
var byDomain = {};
var activeFilter = 'all';
var activeSearch = '';
var activeDomain = '';
var selectedIdx = -1;
var refreshTimer = null;
var refreshCountdown = 30;
var DOMAINS = ['fr.igraal.com', 'es.igraal.com', 'de.igraal.com', 'igraal.pl'];

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

// Extract path+query from full URL, fall back to path field
function fullPath(v) {
  if (v.url) {
    try { return new URL(v.url).pathname + new URL(v.url).search; } catch(e) {}
  }
  return v.path || '/';
}

function isMyVisit(v) {
  if (!v || !v.ip) return false;
  // Check auto-detected dashboard IP AND any manually entered IP
  if (yourIp && v.ip === yourIp) return true;
  if (myIp && v.ip === myIp) return true;
  return false;
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
function tagMini(label, val) {
  return '<span style="display:inline-block;font-size:10px;padding:1px 6px;border-radius:3px;margin-right:3px;margin-bottom:2px;background:' + (val ? '#14532d' : '#450a0a') + ';color:' + (val ? '#86efac' : '#fca5a5') + ';font-weight:600">' + (val ? '✓' : '✗') + ' ' + label + '</span>';
}

/* ── Issue analysis ──────────────────────── */
function analyzeIssues(pv, pc) {
  var issues = [];
  var pvTags = (pv && pv.tags) || {};
  var pcTags = (pc && pc.tags) || {};
  var consent = (pc && pc.consent) || (pv && pv.consent) || {};
  var given = consent.given;

  // No page-view beacon (only post-consent arrived)
  if (!pv && pc) {
    issues.push({ level: 'warning', tag: 'Page View',
      message: 'Page view beacon was not received — only post-consent beacon paired',
      rootCause: 'Most likely cause: consentmanager is lazy-loading GTM (class="cmplazyload" on the GTM script tag). This means GTM only initialises AFTER consent is resolved. The "All Pages" trigger fires at the same moment as cmpEventLoadFinished, and the page-view beacon either lost the race or failed (sendBeacon blocked by an ad-blocker). Less likely: the Tracking Health Monitor tag is missing the "All Pages" trigger.',
      fix: 'In GTM → Tracking Health Monitor tag → confirm two triggers are set: (1) All Pages  (2) cmpEventLoadFinished. If consentmanager controls GTM loading, both beacons will arrive within milliseconds of each other — this is expected and the dashboard handles it.' });
  }

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
      rootCause: 'New visitor whose consent banner is still open. The post-consent beacon arrives once they accept or decline. If this is a repeat visitor, check GTM → Tracking Health Monitor → confirm cmpEventLoadFinished trigger is present.',
      fix: 'Wait for the visitor to interact with the consent banner. If never arriving for repeat visitors, update GTM script to latest version.' });
  } else {
    // Meta Pixel
    if (given === true && !pcTags.metaPixel) {
      issues.push({ level: 'error', tag: 'Meta Pixel',
        message: 'Meta Pixel did not fire after consent accepted',
        rootCause: 'Most likely: RACE CONDITION — consentmanager lazy-loads GTM, so Meta_Pageview and the monitoring tag both fire on cmpEventLoadFinished at the same time. The monitoring script captures window.fbq BEFORE Meta_Pageview tag has executed. Fix: update GTM script to use 800ms delay for post-consent tag capture. Less likely: missing cmpEventLoadFinished trigger on Meta_Pageview, or wrong pixel ID.',
        fix: 'Update Tracking Health Monitor GTM script to latest version (adds 800ms setTimeout before capturing tag status on post-consent beacon). This is the most common cause when pixel ID and trigger are confirmed correct.' });
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
  // Split into typed buckets
  var pvs = [], pcs = [], legacy = [];
  visits.forEach(function(v) {
    if (v.eventType === 'post-consent') pcs.push(v);
    else if (v.eventType === 'page-view') pvs.push(v);
    else legacy.push(v); // old GTM script — no eventType field
  });

  var groups = [];
  var usedPc  = {};
  var usedLeg = {};

  // Match explicit page-views → post-consents by absolute time diff.
  // This handles the case where cmpEventLoadFinished fires quickly and
  // the post-consent beacon arrives at the server BEFORE the page-view beacon.
  pvs.forEach(function(pv) {
    var pvTime = new Date(pv.receivedAt || pv.timestamp || 0).getTime();
    var bestIdx = -1, bestDiff = Infinity;
    pcs.forEach(function(pc, ci) {
      if (usedPc[ci]) return;
      if (pc.ip !== pv.ip || pc.domain !== pv.domain || pc.path !== pv.path) return;
      var diff = Math.abs(new Date(pc.receivedAt || pc.timestamp || 0).getTime() - pvTime);
      if (diff < 300000 && diff < bestDiff) { bestDiff = diff; bestIdx = ci; }
    });
    var g = { pageView: pv, postConsent: null };
    if (bestIdx >= 0) { g.postConsent = pcs[bestIdx]; usedPc[bestIdx] = true; }
    groups.push(g);
  });

  // Orphaned post-consents (arrived with no matching page-view)
  pcs.forEach(function(pc, ci) {
    if (!usedPc[ci]) groups.push({ pageView: null, postConsent: pc });
  });

  // Legacy beacons (old GTM script, no eventType): pair sequentially by time
  legacy.sort(function(a, b) {
    return new Date(a.receivedAt||a.timestamp||0) - new Date(b.receivedAt||b.timestamp||0);
  });
  for (var i = 0; i < legacy.length; i++) {
    if (usedLeg[i]) continue;
    var v = legacy[i];
    var vTime = new Date(v.receivedAt || v.timestamp || 0).getTime();
    var g2 = { pageView: v, postConsent: null };
    usedLeg[i] = true;
    for (var j = i + 1; j < legacy.length; j++) {
      if (usedLeg[j]) continue;
      var v2 = legacy[j];
      if (v2.ip !== v.ip || v2.domain !== v.domain || v2.path !== v.path) continue;
      var d = new Date(v2.receivedAt || v2.timestamp || 0).getTime() - vTime;
      if (d > 0 && d < 300000) { g2.postConsent = v2; usedLeg[j] = true; break; }
    }
    groups.push(g2);
  }

  return groups.sort(function(a, b) {
    var va = a.pageView || a.postConsent;
    var vb = b.pageView || b.postConsent;
    return new Date(vb.receivedAt||vb.timestamp||0) - new Date(va.receivedAt||va.timestamp||0);
  });
}

/* ── Render domain cards ─────────────────── */
function renderDomainCards() {
  var bar = document.getElementById('domain-bar');
  var totalVisits = allVisits.length;
  var html = '<div class="dcard' + (!activeDomain ? ' active' : '') + '" onclick="setDomain(\\'\\')"><h3>All Domains</h3><div class="val">' + totalVisits + '</div><div class="sub">visits total</div></div>';
  DOMAINS.forEach(function(d) {
    var s = byDomain[d] || { visits: 0, consentGiven: 0, gtmLoaded: 0 };
    var pct = s.visits ? Math.round(s.consentGiven / s.visits * 100) : 0;
    var gtmPct = s.visits ? Math.round(s.gtmLoaded / s.visits * 100) : 0;
    html += '<div class="dcard' + (activeDomain === d ? ' active' : '') + '" onclick="setDomain(\\'' + d + '\\')"><h3>' + d + '</h3><div class="val">' + s.visits + '</div><div class="sub">↑' + pct + '% consent · GTM ' + gtmPct + '%</div></div>';
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
      if (!v || !isMyVisit(v)) return false;
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

    var isYou = v && isMyVisit(v);
    var ts = toIST(v && (v.receivedAt || v.timestamp));
    var eventBadge = pc && pv ? '<span class="badge bg-green">Both</span>'
                   : pc ? '<span class="badge bg-blue">Post</span>'
                   : '<span class="badge bg-gray">Page</span>';
    var issueBadge = hasError ? '<span class="badge bg-red">' + issues.filter(function(i){return i.level==='error'||i.level==='critical';}).length + ' Error</span>'
                  : hasWarn ? '<span class="badge bg-yellow">Warn</span>'
                  : issues.length > 0 ? '<span class="badge bg-blue">Info</span>'
                  : '<span style="color:#22c55e;font-size:11px">✓ OK</span>';
    var ipDisplay = isYou ? '<span style="color:#22c55e;font-weight:700">' + (v.ip||'—') + ' 👈</span>' : '<span style="color:#64748b">' + (v.ip||'—') + '</span>';
    var fp = fullPath(v || {});
    var consentCell = '<span style="color:' + consentColor(consent.given) + ';font-size:11px;font-weight:600">' + consentLabel(consent.given) + '</span>';
    if (consent.vendor) consentCell += '<br><span style="color:#475569;font-size:10px">' + consent.vendor + '</span>';
    var tagCell = tagMini('GTM', tags.gtmLoaded) + tagMini('Meta', tags.metaPixel) + tagMini('Ads', tags.googleAds) + tagMini('TTK', tags.tiktok);

    // Short timestamp: strip year → "03-26 10:15:32.543"
    var tsShort = ts.length > 10 ? ts.slice(5, 23) : ts;
    html += '<tr data-idx="' + idx + '" class="' + (isYou ? 'you-row' : '') + (selectedIdx === idx ? ' selected' : '') + '" onclick="showDetail(' + idx + ')" style="cursor:pointer">';
    html += '<td class="cell-ts" title="' + ts + '">' + tsShort + '</td>';
    html += '<td class="cell-ip">' + ipDisplay + '</td>';
    html += '<td class="cell-path"><span style="color:#e2e8f0;font-size:12px">' + (v&&v.domain||'—') + '</span><span style="color:#475569;margin-left:3px;font-family:monospace;font-size:10px" title="' + (v&&v.url||'') + '">' + fp + '</span></td>';
    html += '<td>' + eventBadge + '</td>';
    html += '<td style="line-height:1.6">' + consentCell + '</td>';
    html += '<td class="cell-tags">' + tagCell + '</td>';
    html += '<td>' + issueBadge + '</td>';
    html += '<td style="text-align:center"><button onclick="event.stopPropagation();showDetail(' + idx + ')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:11px">→</button></td>';
    html += '</tr>';
  });

  tbody.innerHTML = html || '<tr><td colspan="8" style="padding:40px;text-align:center;color:#475569">No visits match the current filter.</td></tr>';

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

  var errorCount = issues.filter(function(i){return i.level==='error'||i.level==='critical';}).length;
  var html = '';

  /* Tab nav */
  html += '<div class="dp-tabs">';
  html += '<button class="dp-tab active" data-tab="timeline" onclick="switchTab(\\'timeline\\')">Timeline</button>';
  html += '<button class="dp-tab" data-tab="issues" onclick="switchTab(\\'issues\\')">Issues' + (errorCount > 0 ? ' <span style="color:#f87171;font-size:10px">● ' + errorCount + '</span>' : '') + '</button>';
  html += '<button class="dp-tab" data-tab="consent" onclick="switchTab(\\'consent\\')">Consent</button>';
  html += '<button class="dp-tab" data-tab="pageview" onclick="switchTab(\\'pageview\\')">Payload</button>';
  html += '<button class="dp-tab" data-tab="datalayer" onclick="switchTab(\\'datalayer\\')">DataLayer</button>';
  html += '<button class="dp-tab" data-tab="raw" onclick="switchTab(\\'raw\\')">Raw JSON</button>';
  html += '</div>';

  /* ── Tab: Timeline (default visible) ── */
  html += '<div id="dp-tab-timeline">';

  /* Visit Info */
  html += '<div class="dp-section"><h3>Visit Info</h3>';
  html += row_(null, 'Time (IST)', toIST(v && (v.receivedAt || v.timestamp)));
  html += row_(null, 'IP', (v&&v.ip||'—') + (isMyVisit(v) ? ' <span class="badge bg-green" style="font-size:9px">You</span>' : ''));
  html += row_(null, 'Domain', v&&v.domain||'—');
  html += row_(null, 'URL', '<code style="font-size:10px;word-break:break-all">' + (v&&v.url||v&&v.path||'—') + '</code>');
  html += row_(null, 'Referrer', (v&&v.referrer) ? '<code style="font-size:10px">' + v.referrer + '</code>' : '<span style="color:#475569">Direct / None</span>');
  html += row_(null, 'Language', v&&v.language||'—');
  html += row_(null, 'CMP Vendor', (v&&v.consent&&v.consent.vendor) || '<span style="color:#475569">Not detected</span>');
  html += '</div>';

  /* Debug Timeline */
  html += '<div class="dp-section"><h3>Debug Timeline</h3>';

  // Build ms-precision event list
  var baseTs = pv ? new Date(pv.receivedAt || pv.timestamp || 0).getTime()
                  : pc ? new Date(pc.receivedAt || pc.timestamp || 0).getTime() : 0;

  function relMs(iso) {
    if (!iso || !baseTs) return '—';
    var d = new Date(iso).getTime() - baseTs;
    return (d >= 0 ? '+' : '') + d.toLocaleString() + ' ms';
  }
  function msLabel(ms) {
    if (ms === null || ms === undefined) return '';
    return '<span style="font-family:monospace;font-size:11px;color:#94a3b8;min-width:80px;display:inline-block">T + ' + ms.toLocaleString() + ' ms</span>';
  }

  // Event: Page navigation start (if timing data from beacon)
  if (pv && pv.timing && pv.timing.pageLoadMs !== undefined) {
    html += '<div class="tl-item"><div class="tl-dot tl-dot-gray"></div><div class="tl-content">';
    html += '<div class="tl-time">' + msLabel(0) + ' · Page navigation start</div>';
    html += '<div style="font-size:11px;color:#475569;margin-top:2px">Browser began loading the page</div>';
    html += '</div></div>';
  }

  // Event 1: Page View beacon
  if (pv) {
    var pvTags = pv.tags || {};
    var pvTimeIST = toIST(pv.receivedAt || pv.timestamp);
    var pvPageLoadMs = (pv.timing && pv.timing.pageLoadMs !== undefined) ? pv.timing.pageLoadMs : null;
    html += '<div class="tl-item"><div class="tl-dot tl-dot-blue"></div><div class="tl-content">';
    html += '<div class="tl-time">';
    if (pvPageLoadMs !== null) {
      html += msLabel(Math.round(pvPageLoadMs)) + ' · ';
    } else {
      html += '<span style="font-family:monospace;font-size:11px;color:#94a3b8;min-width:80px;display:inline-block">T + 0 ms</span> · ';
    }
    html += '<span style="color:#64748b;font-size:10px">' + pvTimeIST + '</span></div>';
    html += '<div class="tl-title">📄 Page View — GTM fired "All Pages"</div>';
    html += '<div class="tl-tags" style="margin-top:4px">';
    html += tagBadge('GTM', pvTags.gtmLoaded, 'Loaded', 'Not loaded');
    html += tagBadge('Meta', pvTags.metaPixel, 'Pre-loaded', 'Not yet (expected pre-consent)');
    html += tagBadge('Ads', pvTags.googleAds, 'Restricted mode', 'Not loaded');
    html += tagBadge('TikTok', pvTags.tiktok, 'Pre-loaded', 'Not yet (expected)');
    html += '</div>';
    html += '<div style="margin-top:5px;font-size:11px;color:' + consentColor(pv.consent&&pv.consent.given) + '">Consent snapshot: ' + consentLabel(pv.consent&&pv.consent.given) + (pv.consent&&pv.consent.vendor ? ' · <span style="color:#64748b">' + pv.consent.vendor + '</span>' : '') + '</div>';
    html += '</div></div>';
  }

  // Event 2: Post-consent beacon (cmpEventLoadFinished)
  if (pc) {
    var pcTags = pc.tags || {};
    var pcTimeIST = toIST(pc.receivedAt || pc.timestamp);
    var serverDeltaMs = pv ? timeDiffMs(pv.receivedAt||pv.timestamp, pc.receivedAt||pc.timestamp) : 0;
    var pcPageLoadMs = (pc.timing && pc.timing.pageLoadMs !== undefined) ? pc.timing.pageLoadMs : null;
    html += '<div class="tl-item"><div class="tl-dot tl-dot-green"></div><div class="tl-content">';
    html += '<div class="tl-time">';
    if (pcPageLoadMs !== null) {
      html += msLabel(Math.round(pcPageLoadMs)) + ' · ';
    } else if (pv) {
      html += '<span style="font-family:monospace;font-size:11px;color:#22c55e;min-width:80px;display:inline-block">+' + serverDeltaMs.toLocaleString() + ' ms</span> · ';
    }
    html += '<span style="color:#64748b;font-size:10px">' + pcTimeIST + '</span></div>';
    html += '<div class="tl-title">🔔 cmpEventLoadFinished — Consent resolved</div>';
    html += '<div class="tl-tags" style="margin-top:4px">';
    html += tagBadge('Meta', pcTags.metaPixel, 'Fired ✅', 'Not fired ❌');
    html += tagBadge('Ads', pcTags.googleAds, pc.consent&&pc.consent.given ? 'Full mode ✅' : 'Restricted mode (no consent)', 'Not fired ❌');
    html += tagBadge('TikTok', pcTags.tiktok, 'Fired ✅', 'Not fired ❌');
    html += '</div>';
    html += '<div style="margin-top:5px;font-size:11px;color:' + consentColor(pc.consent&&pc.consent.given) + '"><strong>Consent decision: ' + consentLabel(pc.consent&&pc.consent.given) + '</strong>' + (pc.consent&&pc.consent.vendor ? ' · <span style="color:#64748b">' + pc.consent.vendor + '</span>' : '') + '</div>';
    if (pv && serverDeltaMs > 0) {
      html += '<div style="margin-top:3px;font-size:10px;color:#475569">Server received this beacon <strong style="color:#94a3b8">' + serverDeltaMs.toLocaleString() + ' ms</strong> after the page-view beacon</div>';
    }
    if (pc.tagIds) {
      if (pc.tagIds.meta && pc.tagIds.meta.length)
        html += '<div style="margin-top:3px;font-size:11px;color:#64748b">Meta IDs: <code>' + pc.tagIds.meta.join(', ') + '</code></div>';
      if (pc.tagIds.googleAds && pc.tagIds.googleAds.length)
        html += '<div style="margin-top:2px;font-size:11px;color:#64748b">Ads IDs: <code>' + pc.tagIds.googleAds.join(', ') + '</code></div>';
    }
    html += '</div></div>';
  } else {
    html += '<div class="tl-item"><div class="tl-dot tl-dot-gray"></div><div class="tl-content">';
    html += '<div class="tl-title" style="color:#475569">cmpEventLoadFinished — second beacon not paired</div>';
    html += '<div style="font-size:11px;color:#64748b;margin-top:4px">Most likely: new visitor whose consent banner is still open (no prior consent cookie). The post-consent beacon will arrive once they accept/decline.</div>';
    html += '<div style="font-size:11px;color:#64748b;margin-top:3px">Less likely: if this is a repeat visitor, the server may have received the beacons out of order. The pairing window is 5 minutes.</div>';
    html += '</div></div>';
  }
  html += '</div>'; // dp-section timeline

  html += '</div>'; // dp-tab-timeline

  /* ── Tab: Issues ── */
  html += '<div id="dp-tab-issues" style="display:none">';
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
  html += '</div>'; // dp-tab-issues

  /* ── Tab: Consent ── */
  html += '<div id="dp-tab-consent" style="display:none">';

  var pvConsent = (pv && pv.consent) || {};
  var pcConsent = (pc && pc.consent) || {};
  var pvPurposes = pvConsent.purposeConsents || {};
  var pcPurposes = pcConsent.purposeConsents || {};
  var pvVendors  = pvConsent.vendorConsents  || {};
  var pcVendors  = pcConsent.vendorConsents  || {};

  var purposeNames = {
    '1':  'Store / access information on device',
    '2':  'Select basic ads',
    '3':  'Create a personalised ads profile',
    '4':  'Select personalised ads',
    '5':  'Create a personalised content profile',
    '6':  'Select personalised content',
    '7':  'Measure ad performance',
    '8':  'Measure content performance',
    '9':  'Apply market research to generate audience insights',
    '10': 'Develop and improve products'
  };

  var finalConsent = pcConsent.given !== undefined ? pcConsent.given : pvConsent.given;

  // Summary
  html += '<div class="dp-section"><h3>Consent Summary</h3>';
  html += row_(null, 'CMP Vendor',      (pcConsent.vendor || pvConsent.vendor || '<span style="color:#475569">—</span>'));
  html += row_(null, 'Final Decision',  '<span style="color:' + consentColor(finalConsent) + ';font-weight:700;font-size:13px">' + consentLabel(finalConsent) + '</span>');
  html += row_(null, 'Page View Snapshot', '<span style="color:' + consentColor(pvConsent.given) + '">' + consentLabel(pvConsent.given) + '</span>');
  html += row_(null, 'Post-Consent Snapshot', pc ? '<span style="color:' + consentColor(pcConsent.given) + '">' + consentLabel(pcConsent.given) + '</span>' : '<span style="color:#475569">— not received yet</span>');
  var consentExists = pcConsent.consentExists !== undefined ? pcConsent.consentExists : pvConsent.consentExists;
  html += row_(null, 'Consent Cookie Exists',
    consentExists === true  ? '<span style="color:#22c55e">✅ Yes — returning visitor</span>' :
    consentExists === false ? '<span style="color:#f59e0b">⚠ No — new visitor / cookie cleared</span>' :
    '<span style="color:#475569">— update GTM script to capture</span>');
  html += '</div>';

  // Google Consent Mode v2
  var GCM_KEYS = ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization'];
  var pvGcm = (pv && pv.googleConsentMode) || {};
  var pcGcm = (pc && pc.googleConsentMode) || {};
  var hasGcm = GCM_KEYS.some(function(k){ return pvGcm[k] || pcGcm[k]; });

  html += '<div class="dp-section"><h3>Google Consent Mode v2</h3>';
  if (!hasGcm) {
    html += '<div style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:12px;font-size:12px;color:#94a3b8">Not captured yet. Update the GTM tag with the latest script.</div>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<thead><tr>'
          + '<th style="padding:6px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">Parameter</th>'
          + '<th style="padding:6px 10px;text-align:center;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">Page View</th>'
          + '<th style="padding:6px 10px;text-align:center;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">Post-Consent</th>'
          + '</tr></thead><tbody>';
    GCM_KEYS.forEach(function(k) {
      var pvVal = pvGcm[k] || null;
      var pcVal = pcGcm[k] || null;
      function fmtGcm(val) {
        if (!val) return '<span style="color:#475569">—</span>';
        var granted = val === 'granted';
        return '<span style="color:' + (granted ? '#22c55e' : '#f87171') + ';font-weight:700">'
             + (granted ? '✅ granted' : '❌ denied') + '</span>';
      }
      var changed = pvVal && pcVal && pvVal !== pcVal;
      html += '<tr style="border-bottom:1px solid #0f172a' + (changed ? ';background:#1a1a0a' : '') + '">'
            + '<td style="padding:6px 10px;font-family:monospace;font-size:11px;color:#e2e8f0">' + k + (changed ? ' <span style="color:#f59e0b;font-size:10px">↕ changed</span>' : '') + '</td>'
            + '<td style="padding:6px 10px;text-align:center">' + fmtGcm(pvVal) + '</td>'
            + '<td style="padding:6px 10px;text-align:center">' + fmtGcm(pcVal) + '</td>'
            + '</tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';

  // Purpose consents table
  var hasPurposeData = Object.keys(pvPurposes).length > 0 || Object.keys(pcPurposes).length > 0;
  var allPurposeKeys = hasPurposeData
    ? Object.keys(Object.assign({}, pvPurposes, pcPurposes)).sort(function(a,b){ return parseInt(a)-parseInt(b); })
    : ['1','2','3','4','5','6','7','8','9','10'];

  html += '<div class="dp-section"><h3>IAB TCF Purpose Consents</h3>';
  if (!hasPurposeData) {
    html += '<div style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:12px;font-size:12px;color:#94a3b8;margin-bottom:10px">Purpose-level data not yet captured. Update the GTM tag with the latest script to see per-purpose values.</div>';
  }
  html += '<table style="width:100%;border-collapse:collapse">';
  html += '<thead><tr>'
        + '<th style="padding:6px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">#</th>'
        + '<th style="padding:6px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">Purpose</th>'
        + '<th style="padding:6px 10px;text-align:center;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">Page View</th>'
        + '<th style="padding:6px 10px;text-align:center;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">Post-Consent</th>'
        + '</tr></thead><tbody>';
  allPurposeKeys.forEach(function(k) {
    var pvVal = pvPurposes[k] !== undefined ? pvPurposes[k] : null;
    var pcVal = pcPurposes[k] !== undefined ? pcPurposes[k] : null;
    function fmtBool(val) {
      return val === true  ? '<span style="color:#22c55e;font-weight:700">✅ true</span>'
           : val === false ? '<span style="color:#f87171;font-weight:700">❌ false</span>'
           : '<span style="color:#475569">—</span>';
    }
    var changed = pvVal !== null && pcVal !== null && pvVal !== pcVal;
    html += '<tr style="border-bottom:1px solid #0f172a' + (changed ? ';background:#1a1a0a' : '') + '">'
          + '<td style="padding:6px 10px;font-family:monospace;font-size:11px;color:#64748b">' + k + '</td>'
          + '<td style="padding:6px 10px;font-size:11px;color:#e2e8f0">' + (purposeNames[k] || 'Purpose ' + k) + (changed ? ' <span style="color:#f59e0b;font-size:10px">↕ changed</span>' : '') + '</td>'
          + '<td style="padding:6px 10px;text-align:center">' + fmtBool(pvVal) + '</td>'
          + '<td style="padding:6px 10px;text-align:center">' + fmtBool(pcVal) + '</td>'
          + '</tr>';
  });
  html += '</tbody></table></div>';

  // Vendor consents
  var allVendorKeys = Object.keys(Object.assign({}, pvVendors, pcVendors)).sort(function(a,b){ return parseInt(a)-parseInt(b); });
  if (allVendorKeys.length > 0) {
    html += '<div class="dp-section"><h3>Vendor Consents</h3>';
    html += '<table style="width:100%;border-collapse:collapse">';
    html += '<thead><tr>'
          + '<th style="padding:5px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">Vendor ID</th>'
          + '<th style="padding:5px 10px;text-align:center;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">Page View</th>'
          + '<th style="padding:5px 10px;text-align:center;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #1e293b">Post-Consent</th>'
          + '</tr></thead><tbody>';
    allVendorKeys.slice(0, 30).forEach(function(k) {
      var pvVal = pvVendors[k] !== undefined ? pvVendors[k] : null;
      var pcVal = pcVendors[k] !== undefined ? pcVendors[k] : null;
      function fmtV(val) {
        return val === true ? '<span style="color:#22c55e">✅</span>' : val === false ? '<span style="color:#f87171">❌</span>' : '<span style="color:#475569">—</span>';
      }
      html += '<tr style="border-bottom:1px solid #0f172a">'
            + '<td style="padding:5px 10px;font-family:monospace;font-size:11px;color:#94a3b8">Vendor ' + k + '</td>'
            + '<td style="padding:5px 10px;text-align:center">' + fmtV(pvVal) + '</td>'
            + '<td style="padding:5px 10px;text-align:center">' + fmtV(pcVal) + '</td>'
            + '</tr>';
    });
    html += '</tbody></table>';
    if (allVendorKeys.length > 30) html += '<div style="color:#64748b;font-size:11px;padding:8px 10px">+ ' + (allVendorKeys.length - 30) + ' more vendors</div>';
    html += '</div>';
  }

  html += '</div>'; // dp-tab-consent

  /* ── Tab: Pageview Data ── */
  html += '<div id="dp-tab-pageview" style="display:none">';
  function beaconFields(b, title) {
    if (!b) {
      var notReceivedMsg = title === 'Page View Beacon'
        ? '<div class="dp-section"><div style="color:#f59e0b;font-weight:600;margin-bottom:8px">⚠ ' + title + ' — not received</div><div style="font-size:12px;color:#94a3b8;line-height:1.6"><strong>Why does this happen?</strong><br>consentmanager lazy-loads GTM (the <code>cmplazyload</code> class on your GTM script tag). GTM only initialises after consent is resolved. This means the "All Pages" trigger and <code>cmpEventLoadFinished</code> both fire within milliseconds of each other. The page-view beacon either:<br>• Arrived at the server after the post-consent beacon (out-of-order network delivery)<br>• Was blocked by an ad-blocker (sendBeacon call failed)<br>• The monitoring tag is missing the "All Pages" trigger<br><br><strong>Action:</strong> Go to GTM → Tracking Health Monitor → verify both triggers exist: <strong>All Pages</strong> + <strong>cmpEventLoadFinished</strong>.</div></div>'
        : '<div class="dp-section" style="color:#475569">' + title + ' — not received</div>';
      return notReceivedMsg;
    }
    var t = b.tags || {};
    var ids = b.tagIds || {};
    var c = b.consent || {};
    var s = '<div class="dp-section"><h3>' + title + '</h3>';
    s += row_(null, 'eventType', '<code>' + (b.eventType || 'page-view') + '</code>');
    s += row_(null, 'receivedAt', '<code style="font-size:10px">' + (b.receivedAt || b.timestamp || '—') + '</code>');
    s += row_(null, 'url', '<code style="font-size:10px;word-break:break-all">' + (b.url || '—') + '</code>');
    s += row_(null, 'domain', b.domain || '—');
    s += row_(null, 'path', '<code>' + (b.path || '—') + '</code>');
    s += row_(null, 'referrer', b.referrer || '<span style="color:#475569">—</span>');
    s += row_(null, 'language', b.language || '—');
    s += row_(null, 'ip', '<code>' + (b.ip || '—') + '</code>');
    s += '<div style="margin:8px 0 4px;font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.5px">Tags</div>';
    s += row_(null, 'gtmLoaded', t.gtmLoaded ? '<span style="color:#22c55e">✅ true</span>' : '<span style="color:#f87171">❌ false</span>');
    s += row_(null, 'metaPixel', t.metaPixel ? '<span style="color:#22c55e">✅ true</span>' : '<span style="color:#f87171">❌ false</span>');
    s += row_(null, 'googleAds', t.googleAds ? '<span style="color:#22c55e">✅ true</span>' : '<span style="color:#f87171">❌ false</span>');
    s += row_(null, 'tiktok', t.tiktok ? '<span style="color:#22c55e">✅ true</span>' : '<span style="color:#f87171">❌ false</span>');
    if (ids.meta && ids.meta.length) {
      s += row_(null, 'meta pixel IDs', '<code>' + ids.meta.join(', ') + '</code>');
    }
    if (ids.googleAds && ids.googleAds.length) {
      s += row_(null, 'google ads IDs', '<code>' + ids.googleAds.join(', ') + '</code>');
    }
    s += '<div style="margin:8px 0 4px;font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.5px">Consent</div>';
    s += row_(null, 'vendor', c.vendor || '<span style="color:#475569">—</span>');
    s += row_(null, 'given', c.given === true ? '<span style="color:#22c55e">✅ true</span>' : c.given === false ? '<span style="color:#f87171">❌ false</span>' : '<span style="color:#64748b">— unknown</span>');
    // timing (if available from updated GTM script)
    if (b.timing && b.timing.pageLoadMs !== undefined) {
      s += '<div style="margin:8px 0 4px;font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.5px">Timing</div>';
      s += row_(null, 'pageLoadMs', '<code>' + Math.round(b.timing.pageLoadMs) + ' ms</code> <span style="color:#475569;font-size:10px">after page navigation start</span>');
    }
    s += '</div>';
    // dataLayer pageView event (if captured by updated GTM script)
    if (b.dataLayerPayload) {
      s += '<div class="dp-section"><h3>dataLayer pageView Payload</h3>';
      s += '<div style="font-size:11px;color:#64748b;margin-bottom:8px">Event pushed to GTM dataLayer by the website (event: \\'pageView\\')</div>';
      s += '<pre style="display:block">' + JSON.stringify(b.dataLayerPayload, null, 2) + '</pre>';
      s += '</div>';
    }
    return s;
  }
  html += beaconFields(pv, 'Page View Beacon');
  html += beaconFields(pc, 'Post-Consent Beacon');
  html += '</div>'; // dp-tab-pageview

  /* ── Tab: Raw JSON ── */
  html += '<div id="dp-tab-raw" style="display:none">';
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
  html += '</div>'; // dp-tab-raw

  /* ── Tab: DataLayer ── */
  html += '<div id="dp-tab-datalayer" style="display:none">';
  var dlSnap = (pv && pv.dataLayerSnapshot) || (pc && pc.dataLayerSnapshot);
  if (dlSnap && dlSnap.length) {
    html += '<div class="dp-section"><h3>window.dataLayer Snapshot</h3>';
    html += '<div style="font-size:11px;color:#64748b;margin-bottom:10px">' + dlSnap.length + ' entries captured at time of beacon · click any row to expand</div>';
    dlSnap.forEach(function(entry, i) {
      var ev = entry.event || '';
      var isPageView = ev === 'pageView' || ev === 'page_view' || ev === 'virtualPageview';
      var isConsent  = ev.toLowerCase().indexOf('consent') >= 0 || ev.toLowerCase().indexOf('cmp') >= 0;
      var isGtm      = ev.indexOf('gtm.') === 0;
      var rowBg = isPageView ? '#052e16' : isConsent ? '#0c1a30' : isGtm ? '#1a1a2e' : '#0f172a';
      var evColor = isPageView ? '#86efac' : isConsent ? '#93c5fd' : isGtm ? '#a78bfa' : '#94a3b8';
      var rowId = 'dl-row-' + i;
      html += '<div style="border:1px solid #1e293b;border-radius:4px;margin-bottom:4px;overflow:hidden">';
      html += '<div style="background:' + rowBg + ';padding:6px 10px;cursor:pointer;display:flex;align-items:center;gap:8px" onclick="var el=document.getElementById(\\'' + rowId + '\\');el.style.display=el.style.display===\\'none\\'?\\'block\\':\\'none\\'">';
      html += '<span style="font-family:monospace;font-size:10px;color:#475569;width:24px;flex-shrink:0">[' + i + ']</span>';
      html += '<span style="font-size:11px;font-weight:600;color:' + evColor + '">' + (ev || '<span style="color:#475569">no event</span>') + '</span>';
      var keys = Object.keys(entry).filter(function(k){ return k !== 'event'; });
      if (keys.length) html += '<span style="font-size:10px;color:#475569;margin-left:auto">' + keys.slice(0,3).join(', ') + (keys.length > 3 ? ' +' + (keys.length-3) : '') + '</span>';
      html += '</div>';
      html += '<pre id="' + rowId + '" style="display:none;margin:0;border:none;border-top:1px solid #1e293b;border-radius:0">' + JSON.stringify(entry, null, 2) + '</pre>';
      html += '</div>';
    });
    html += '</div>';
  } else {
    html += '<div class="dp-section"><h3>window.dataLayer Snapshot</h3>';
    html += '<div style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:16px;font-size:12px;color:#94a3b8">';
    html += '<div style="font-weight:600;margin-bottom:8px;color:#f1f5f9">No dataLayer snapshot captured yet</div>';
    html += '<div style="margin-bottom:4px">Update the <strong>Tracking Health Monitor</strong> GTM tag with the latest script.</div>';
    html += '<div>The new script captures <code>window.dataLayer</code> at the time each beacon fires and sends it as <code>dataLayerSnapshot</code>.</div>';
    html += '</div>';
    html += '</div>';
  }
  html += '</div>'; // dp-tab-datalayer

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
  var inp = document.getElementById('myip-input');
  if (inp) inp.placeholder = (d || 'fr.igraal.com') + ' IP if different';
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

/* ── Tab switching ──────────────────────── */
function switchTab(tab) {
  var tabs = ['timeline', 'issues', 'consent', 'pageview', 'datalayer', 'raw'];
  tabs.forEach(function(t) {
    var el = document.getElementById('dp-tab-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.dp-tab').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
}

/* ── Auto-refresh countdown ─────────────── */
function startCountdown() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshCountdown = 30;
  var numEl = document.getElementById('countdown-num');
  if (numEl) numEl.textContent = refreshCountdown;
  refreshTimer = setInterval(function() {
    refreshCountdown--;
    var el = document.getElementById('countdown-num');
    if (el) el.textContent = Math.max(0, refreshCountdown);
    if (refreshCountdown <= 0) {
      clearInterval(refreshTimer);
      refreshTimer = null;
      reload(true); // silent — no overlay flicker
    }
  }, 1000);
}

/* ── Load data ──────────────────────────── */
function reload(silent) {
  if (!silent) document.getElementById('loading').style.display = 'flex';
  fetch('/stats')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allVisits = data.recentVisits || [];
      yourIp    = data.yourIp || '';
      byDomain  = data.byDomain || {};
      // Show auto-detected IP in the label (always updated)
      var ipDisplay = document.getElementById('your-ip-display');
      if (ipDisplay) ipDisplay.textContent = yourIp || '—';
      var now = new Date();
      document.getElementById('header-meta').innerHTML =
        'Last updated: ' + toIST(now.toISOString()) + '<br>Dashboard IP: <code style="color:#22c55e">' + yourIp + '</code>';
      renderDomainCards();
      renderList();
      if (!silent) document.getElementById('loading').style.display = 'none';
      startCountdown();
    })
    .catch(function(e) {
      if (!silent) document.getElementById('loading').innerHTML = 'Error loading data: ' + e.message;
    });
}

document.getElementById('myip-input').addEventListener('input', function() {
  myIp = this.value.trim();
  renderList();
});

reload();
</script>
</body>
</html>`;
}

module.exports = { getDashboardHtml };
