#!/usr/bin/env node
/**
 * debug.js — Shows every network request captured on a single page.
 * Use this to diagnose why tags show as "not detected".
 *
 * Usage:
 *   node debug.js https://fr.igraal.com
 *   node debug.js https://es.igraal.com
 */

const { launchBrowser }            = require('./browser');
const { createCapture }            = require('./capture');
const { detectCMP, tryAcceptConsent } = require('./cmp');

const TRACKING_KEYWORDS = [
  'google', 'facebook', 'meta', 'doubleclick', 'analytics',
  'gtm', 'gtag', 'adservice', 'pixel', 'connect.', 'tag',
  'fbevents', 'googleads', 'googletag', 'axept', 'onetrust',
  'cookiebot', 'didomi', 'trustarcpardon',
];

const url = process.argv[2] || 'https://fr.igraal.com';

(async () => {
  console.log(`\n🔍 Debug scan: ${url}\n`);

  const { browser, page } = await launchBrowser();
  try {
    const session = await createCapture(page);
    await session.navigate(url);
    await session.settle(2500);

    const preRequests = session.getRequests();
    const cmp = await detectCMP(page, preRequests);

    let consentAccepted = false;
    if (cmp.detected) {
      console.log(`🍪 CMP detected: ${cmp.vendor || 'unknown'} — trying to accept…`);
      consentAccepted = await tryAcceptConsent(page);
      if (consentAccepted) {
        console.log('✅ Consent accepted — waiting 7s for tags to fire…\n');
        await session.settle(7000);
      } else {
        console.log('⚠️  Could not click accept — showing pre-consent requests only\n');
        await session.settle(2000);
      }
    } else {
      await session.settle(3000);
    }

    const requests = session.getRequests();

    // ── All requests summary ─────────────────────────────────────────────
    console.log(`📦 Total requests captured: ${requests.length}`);
    const blocked = requests.filter((r) => r.blocked);
    console.log(`🚫 Blocked requests: ${blocked.length}\n`);

    // ── CMP ───────────────────────────────────────────────────────────────
    console.log('🍪 CMP Detection:');
    console.log(`   Detected:      ${cmp.detected}`);
    console.log(`   Vendor:        ${cmp.vendor || '—'}`);
    console.log(`   Banner visible: ${cmp.bannerVisible}`);
    console.log(`   Consent given: ${cmp.consentGiven}`);
    console.log(`   Blocking:      ${cmp.scriptsBlocked}\n`);

    // ── Tracking-related requests ─────────────────────────────────────────
    const trackingRequests = requests.filter((r) =>
      TRACKING_KEYWORDS.some((kw) => r.url.toLowerCase().includes(kw))
    );

    console.log(`🎯 Tracking-related requests (${trackingRequests.length} found):\n`);

    if (trackingRequests.length === 0) {
      console.log('   ⚠️  No tracking requests found at all.');
      console.log('   This usually means:');
      console.log('   • CMP is blocking all tags until consent is given');
      console.log('   • Tags are loaded differently (server-side, lazy-load)');
      console.log('   • The page didn\'t fully render\n');
    } else {
      for (const r of trackingRequests) {
        const status  = r.blocked ? '🚫 BLOCKED' : r.status ? `HTTP ${r.status}` : '⏳ pending';
        const timing  = `+${r.msAfterNav}ms`;
        console.log(`   [${status}] [${timing}] ${r.url.substring(0, 120)}`);
        if (r.failureReason) console.log(`             ↳ Reason: ${r.failureReason}`);
      }
    }

    // ── Blocked tracking requests ─────────────────────────────────────────
    const blockedTracking = trackingRequests.filter((r) => r.blocked);
    if (blockedTracking.length > 0) {
      console.log(`\n🚫 Blocked tracking requests (${blockedTracking.length}):`);
      for (const r of blockedTracking) {
        console.log(`   ${r.url.substring(0, 100)}`);
        console.log(`   Reason: ${r.failureReason || 'unknown'}`);
      }
    }

    // ── Sample of ALL request URLs (first 30 non-tracking) ───────────────
    console.log('\n📋 All non-tracking requests (first 20):');
    const nonTracking = requests.filter((r) =>
      !TRACKING_KEYWORDS.some((kw) => r.url.toLowerCase().includes(kw))
    ).slice(0, 20);
    for (const r of nonTracking) {
      console.log(`   [${r.status || (r.blocked ? 'BLOCKED' : '?')}] ${r.url.substring(0, 100)}`);
    }

  } finally {
    await browser.close();
  }
})();
