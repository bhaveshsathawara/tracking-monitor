#!/usr/bin/env node
/**
 * monitor.js — Continuous tight-loop tracking monitor (v4)
 *
 * Scans all configured domains page-by-page with no fixed interval.
 * After completing a full cycle across all domains, it immediately starts
 * the next cycle. Each page is scanned with three consent scenarios.
 *
 * Usage:
 *   node monitor.js                      # start continuous monitoring
 *   node monitor.js --once               # scan once then exit
 *   node monitor.js --url https://...    # scan a single URL
 */

const puppeteer = require('puppeteer');
const path      = require('path');

const { scanPage }         = require('./engine/page-scan');
const { buildDashboard }   = require('./report/builder');
const { sendAlert, sendRecoveryAlert } = require('./alerts/mailer');

// ── Config ────────────────────────────────────────────────────────────────────

const DOMAINS = [
  { domain: 'fr.igraal.com', baseUrl: 'https://fr.igraal.com' },
  { domain: 'es.igraal.com', baseUrl: 'https://es.igraal.com' },
  { domain: 'igraal.pl',     baseUrl: 'https://igraal.pl'     },
];

const MAX_PAGES_PER_DOMAIN = 5;   // Keep low for continuous mode
const PAUSE_BETWEEN_PAGES  = 2000; // ms pause between pages (politeness)
const PAUSE_BETWEEN_CYCLES = 60 * 1000; // 60s rest between full cycles

// ── Sitemap / URL discovery ───────────────────────────────────────────────────

const { discoverPages } = require('./sitemap');

async function getUrlsForDomain(domainConfig) {
  try {
    const urls = await discoverPages(domainConfig.baseUrl, MAX_PAGES_PER_DOMAIN);
    if (urls && urls.length > 0) return urls;
  } catch (_) {}
  // Fallback to homepage only
  return [domainConfig.baseUrl];
}

// ── State tracking (for recovery alerts) ─────────────────────────────────────

// domain → last overall status string
const lastStatus = new Map();

// ── Single scan cycle ─────────────────────────────────────────────────────────

async function runCycle(browser, domainReports) {
  for (const domainConfig of DOMAINS) {
    console.log(`\n[monitor] ── Scanning ${domainConfig.domain} ──`);

    const urls = await getUrlsForDomain(domainConfig);
    console.log(`[monitor] ${urls.length} URL(s) to scan`);

    const pages = [];

    for (const url of urls) {
      try {
        const pageReport = await scanPage(browser, url);
        pages.push(pageReport);

        // Fire alert immediately if issues found
        await sendAlert(domainConfig.domain, pageReport);

        // Small pause between pages
        await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_PAGES));

      } catch (err) {
        console.error(`  [monitor] ❌ Error scanning ${url}: ${err.message}`);
      }
    }

    // Compute domain-level status
    const hasBroken  = pages.some((p) => p.decision?.overall === 'Broken');
    const hasPartial = pages.some((p) => p.decision?.overall === 'Partially Working');
    const domainStatus = hasBroken ? 'Broken' : hasPartial ? 'Partially Working' : 'Working';

    // Recovery alert: if domain was broken last cycle and is now working
    const prev = lastStatus.get(domainConfig.domain);
    if (prev && prev !== 'Working' && domainStatus === 'Working') {
      await sendRecoveryAlert(domainConfig.domain, prev);
    }
    lastStatus.set(domainConfig.domain, domainStatus);

    // Update the domain in the reports array
    const existing = domainReports.findIndex((r) => r.domain === domainConfig.domain);
    const report = {
      domain:    domainConfig.domain,
      baseUrl:   domainConfig.baseUrl,
      pages,
      scannedAt: new Date().toISOString(),
    };

    if (existing >= 0) domainReports[existing] = report;
    else               domainReports.push(report);
  }

  // Rebuild dashboard after every cycle
  try {
    const outFile = await buildDashboard(domainReports);
    console.log(`\n[monitor] 📊 Dashboard updated: ${outFile}`);
  } catch (err) {
    console.error(`[monitor] ❌ Dashboard error: ${err.message}`);
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const once    = args.includes('--once');
  const urlArg  = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;

  console.log('\n[monitor] ══════════════════════════════════════════');
  console.log('[monitor]   Tracking Monitor v4 — starting');
  if (once)   console.log('[monitor]   Mode: single scan');
  else        console.log('[monitor]   Mode: continuous tight-loop');
  console.log('[monitor] ══════════════════════════════════════════\n');

  // Single-URL mode
  if (urlArg) {
    const browser = await launchBrowser();
    try {
      const pageReport = await scanPage(browser, urlArg);
      console.log('\n[monitor] Decision:', JSON.stringify(pageReport.decision, null, 2));
      console.log('\n[monitor] Explanations:');
      pageReport.explanations.forEach((e) => {
        console.log(`  [${e.level.toUpperCase()}] [${e.tag}] ${e.what}`);
      });
    } finally {
      await browser.close();
    }
    return;
  }

  const browser      = await launchBrowser();
  const domainReports = [];
  let   cycleCount   = 0;

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[monitor] Shutting down…');
    await browser.close().catch(() => {});
    process.exit(0);
  });

  try {
    do {
      cycleCount++;
      console.log(`[monitor] ── Cycle ${cycleCount} starting at ${new Date().toLocaleTimeString()} ──`);

      const cycleStart = Date.now();
      await runCycle(browser, domainReports);
      const cycleDuration = Math.round((Date.now() - cycleStart) / 1000);

      console.log(`[monitor] ── Cycle ${cycleCount} complete in ${cycleDuration}s ──`);

      if (!once) {
        console.log(`[monitor] Resting ${PAUSE_BETWEEN_CYCLES / 1000}s before next cycle…\n`);
        await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_CYCLES));
      }

    } while (!once);

  } finally {
    await browser.close().catch(() => {});
  }
}

async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
}

main().catch((err) => {
  console.error('[monitor] Fatal error:', err);
  process.exit(1);
});
