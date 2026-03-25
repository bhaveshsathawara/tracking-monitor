/**
 * multi-page.js — Scans multiple pages for one domain.
 *
 * Auto-discovers pages from the domain's sitemap unless a urls[] list
 * is explicitly provided in domainConfig.
 *
 * Reuses the same browser context (same cookies) across all pages of a domain
 * so CMP consent set on page 1 carries forward.
 */

const { setupPage }    = require('./browser');
const { scanPage }     = require('./scanner');
const { discoverPages } = require('./sitemap');

async function scanDomain(browser, domainConfig) {
  const { domain, baseUrl, urls: explicitUrls } = domainConfig;
  const startedAt = new Date().toISOString();
  const startMs   = Date.now();

  // Auto-discover pages from sitemap if no explicit list provided
  const urls = explicitUrls && explicitUrls.length > 0
    ? explicitUrls
    : await discoverPages(baseUrl);

  const pages = [];

  // One browser context per domain → shared cookies / localStorage
  const context = await browser.createBrowserContext();

  for (let i = 0; i < urls.length; i++) {
    const url  = urls[i];
    const page = await context.newPage();
    await setupPage(page);

    console.log(`[scanner]     Page ${i + 1}/${urls.length}: ${url}`);

    try {
      const result = await scanPage(page, url);
      pages.push(result);
    } catch (err) {
      pages.push({
        url,
        scannedAt:        new Date().toISOString(),
        durationMs:       0,
        requests:         [],
        cmp:              { detected: false, vendor: null, bannerVisible: false, consentGiven: null, scriptsBlocked: false },
        cmpBlocking:      false,
        preConsentFiring: { gtmFiredPreConsent: false, googleAdsFiredPreConsent: false, metaFiredPreConsent: false, isGdprConcern: false },
        detections:       {},
        validations:      {},
        conclusion:       { status: 'error', message: `Scan failed: ${err.message}` },
        blockedRequests:  [],
        error:            err.message,
      });
    } finally {
      await page.close();
    }

    // Short pause between pages — avoids triggering rate limits
    if (i < urls.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  await context.close();

  // ── Aggregate summary ────────────────────────────────────────────────────
  const statusOrder  = { ok: 0, warning: 1, error: 2 };
  const worstStatus  = pages.reduce((worst, p) =>
    statusOrder[p.conclusion?.status] > statusOrder[worst] ? p.conclusion.status : worst, 'ok'
  );

  const issues = [...new Set(
    pages.filter((p) => p.conclusion?.status !== 'ok').map((p) => p.conclusion?.message)
  )].filter(Boolean);

  const goodPages     = pages.filter((p) => !p.error);
  const cmpDetected   = pages.some((p) => p.cmp?.detected);
  const cmpVendor     = pages.find((p) => p.cmp?.vendor)?.cmp?.vendor || null;
  const cmpBlocking   = pages.some((p) => p.cmpBlocking);
  const gdprConcern   = pages.some((p) => p.preConsentFiring?.isGdprConcern);

  const totalBlockedRequests = pages.reduce((s, p) => s + (p.blockedRequests?.length || 0), 0);

  const gtmHealthy       = goodPages.length > 0 && goodPages.every((p) => p.validations?.gtm?.loaded);
  const googleAdsHealthy = goodPages.length > 0 && goodPages.every((p) => p.validations?.googleAds?.scriptDelivered || p.detections?.googleAds?.fired);
  const metaHealthy      = goodPages.length > 0 && goodPages.every((p) => p.validations?.meta?.scriptDelivered || p.detections?.meta?.fired);

  return {
    domain,
    scannedAt:  startedAt,
    durationMs: Date.now() - startMs,
    pages,
    summary: {
      status: worstStatus,
      gtmHealthy,
      googleAdsHealthy,
      metaHealthy,
      cmpDetected,
      cmpVendor,
      cmpBlocking,
      gdprConcern,
      totalBlockedRequests,
      issues,
    },
  };
}

module.exports = { scanDomain };
