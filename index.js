#!/usr/bin/env node
'use strict';

/**
 * index.js — Single scan, one run only, then exit.
 * Scans all configured domains once, prints a summary,
 * writes a log, and generates the HTML report.
 *
 * Usage:
 *   node index.js
 *   TARGET_URL=https://fr.igraal.com node index.js   (single URL override)
 */

const { DOMAINS }                     = require('./config');
const { launchBrowser }               = require('./browser');
const { scanDomain }                  = require('./multi-page');
const { makeRunId, writeRunLog }      = require('./logger');
const { generateReport }              = require('./reporter');

(async () => {
  const runId     = makeRunId();
  const startedAt = new Date().toISOString();

  let browser;
  const domainResults = [];

  try {
    browser = (await launchBrowser()).browser;

    for (const domainConfig of DOMAINS) {
      console.log(`Scanning ${domainConfig.domain}…`);
      const result = await scanDomain(browser, domainConfig);
      domainResults.push(result);
    }
  } finally {
    if (browser) await browser.close();
  }

  const finishedAt = new Date().toISOString();
  const runLog = { runId, startedAt, finishedAt, domains: domainResults };

  await writeRunLog(runLog);
  await generateReport();

  // ── Console output ──────────────────────────────────────────────────────
  console.log('\n=== Tracking Health Report ===\n');

  for (const d of domainResults) {
    const s    = d.summary;
    const icon = { ok: '✅', warning: '⚠️ ', error: '❌' }[s.status] || '❓';
    console.log(`${icon}  ${d.domain}`);
    console.log(`    GTM:        ${s.gtmHealthy       ? '✅ Healthy' : '❌ Issue'}`);
    console.log(`    Google Ads: ${s.googleAdsHealthy ? '✅ Healthy' : '❌ Issue'}`);
    console.log(`    Meta Pixel: ${s.metaHealthy      ? '✅ Healthy' : '❌ Issue'}`);
    if (s.cmpDetected) console.log(`    CMP:        ${s.cmpVendor || 'Detected'}`);
    if (s.totalBlockedRequests) console.log(`    Blocked:    ${s.totalBlockedRequests} request(s)`);
    if (s.issues.length) s.issues.forEach((i) => console.log(`    ⚠️  ${i}`));
    console.log('');
  }

  console.log(`HTML report saved → reports/index.html`);
  console.log('Open it in your browser to see the full dashboard.\n');

  const hasError = domainResults.some((d) => d.summary.status === 'error');
  process.exit(hasError ? 1 : 0);
})();
