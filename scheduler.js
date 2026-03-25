#!/usr/bin/env node
'use strict';

/**
 * scheduler.js — Continuous monitoring entry point.
 * Runs a full multi-domain scan on an interval, writes logs,
 * generates the HTML report, and fires alerts.
 *
 * Usage:
 *   node scheduler.js
 *   SCAN_INTERVAL_MS=300000 node scheduler.js   # every 5 min
 *   SLACK_WEBHOOK=https://... node scheduler.js
 */

const { DOMAINS, SCAN_INTERVAL_MS }  = require('./config');
const { launchBrowser }              = require('./browser');
const { scanDomain }                 = require('./multi-page');
const { makeRunId, writeRunLog, readRecentLogs } = require('./logger');
const { checkAndAlert }              = require('./alerter');
const { generateReport }             = require('./reporter');

let isRunning  = false;
let shouldStop = false;

async function runScan() {
  if (isRunning) {
    console.log('[scheduler] Previous scan still running — skipping this tick.');
    return;
  }
  isRunning = true;

  const runId     = makeRunId();
  const startedAt = new Date().toISOString();
  console.log(`\n[scheduler] ▶ Scan started  — ${startedAt}`);

  let browser;
  const domainResults = [];

  try {
    browser = (await launchBrowser()).browser;

    for (const domainConfig of DOMAINS) {
      console.log(`[scheduler]   Scanning ${domainConfig.domain}…`);
      try {
        const result = await scanDomain(browser, domainConfig);
        domainResults.push(result);
        const statusIcon = { ok: '✅', warning: '⚠️ ', error: '❌' }[result.summary.status] || '❓';
        console.log(`[scheduler]   ${statusIcon} ${domainConfig.domain}: ${result.summary.status.toUpperCase()}`);
        if (result.summary.issues.length) {
          result.summary.issues.forEach((issue) => console.log(`[scheduler]      → ${issue}`));
        }
      } catch (err) {
        console.error(`[scheduler]   ${domainConfig.domain}: FATAL — ${err.message}`);
        domainResults.push({
          domain:    domainConfig.domain,
          scannedAt: new Date().toISOString(),
          durationMs: 0,
          pages:     [],
          summary:   {
            status:              'error',
            gtmHealthy:          false,
            googleAdsHealthy:    false,
            metaHealthy:         false,
            cmpDetected:         false,
            cmpVendor:           null,
            totalBlockedRequests: 0,
            issues:              [`Scan crashed: ${err.message}`],
          },
        });
      }

      // Pause between domains to avoid looking like a bot
      await new Promise((r) => setTimeout(r, 3000));
    }
  } finally {
    if (browser) await browser.close();
  }

  const finishedAt = new Date().toISOString();
  const runLog = { runId, startedAt, finishedAt, domains: domainResults };

  // Write log
  await writeRunLog(runLog).catch((e) => console.error('[scheduler] Log write failed:', e.message));

  // Read previous run for alert comparison
  const recentLogs = await readRecentLogs(2).catch(() => []);
  const prevDomains = recentLogs[1]?.domains || null;

  // Fire alerts
  await checkAndAlert(domainResults, prevDomains).catch((e) =>
    console.error('[scheduler] Alert error:', e.message)
  );

  // Generate HTML report
  await generateReport().catch((e) =>
    console.error('[scheduler] Report error:', e.message)
  );

  console.log(`[scheduler] ✓ Scan complete — ${finishedAt}`);
  printConsoleSummary(domainResults);

  isRunning = false;
}

function printConsoleSummary(domains) {
  console.log('\n=== Tracking Health Summary ===');
  for (const d of domains) {
    const s    = d.summary;
    const icon = { ok: '✅', warning: '⚠️ ', error: '❌' }[s.status] || '❓';
    console.log(`${icon} ${d.domain.padEnd(20)} GTM:${s.gtmHealthy?'✓':'✗'} Ads:${s.googleAdsHealthy?'✓':'✗'} Meta:${s.metaHealthy?'✓':'✗'} CMP:${s.cmpDetected?(s.cmpVendor||'Yes'):'—'} Blocked:${s.totalBlockedRequests}`);
    if (s.issues.length) s.issues.forEach((i) => console.log(`   └─ ${i}`));
  }
  console.log('');
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown() {
  console.log('\n[scheduler] Stopping… (waiting for current scan to finish)');
  shouldStop = true;
  const wait = setInterval(() => {
    if (!isRunning) { clearInterval(wait); process.exit(0); }
  }, 500);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

// ── Start ─────────────────────────────────────────────────────────────────────

const intervalMin = Math.round(SCAN_INTERVAL_MS / 60000);
console.log(`[scheduler] Starting — scanning ${DOMAINS.length} domain(s) every ${intervalMin} min`);
console.log(`[scheduler] Open reports/index.html in your browser to view the dashboard`);
console.log('[scheduler] Press Ctrl+C to stop\n');

// Run immediately on startup
runScan();

// Then run on interval
const intervalHandle = setInterval(() => {
  if (!shouldStop) runScan();
}, SCAN_INTERVAL_MS);

// Keep process alive
intervalHandle.unref && intervalHandle.ref();
