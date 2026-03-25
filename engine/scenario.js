/**
 * engine/scenario.js
 *
 * Runs ONE consent scenario on a single URL in an isolated browser context.
 * Three scenarios: accept · reject · no-action
 *
 * Each returns a ScenarioResult with full timeline, JS detection, network
 * detection, validation, and blocked request data.
 */

const { setupPage }                                    = require('../browser');
const { createCapture }                                = require('../capture');
const { injectTimingHooks, extractTimeline }           = require('./timing');
const { detectCMP, tryAcceptConsent, tryRejectConsent } = require('../cmp');
const { detectGTM, detectGoogleAds, detectMeta,
        detectTagsViaJS }                              = require('../detector');
const { validateGTM, validateGoogleAds, validateMeta } = require('../validator');

const PRE_CONSENT_MS      = 2500;
const SETTLE_ACCEPT_MS    = 7000;
const SETTLE_REJECT_MS    = 5000;
const SETTLE_NOACTION_MS  = 5000;

/**
 * @param {object} browser - Puppeteer browser instance
 * @param {string} url
 * @param {'accept'|'reject'|'no-action'} scenario
 * @returns {Promise<ScenarioResult>}
 */
async function runScenario(browser, url, scenario) {
  const startedAt = new Date().toISOString();
  const startMs   = Date.now();

  const context = await browser.createBrowserContext();
  const page    = await context.newPage();
  await setupPage(page);

  try {
    // ── Step 1: Inject timing hooks BEFORE navigation ───────────────────────
    await injectTimingHooks(page);

    // ── Step 2: Start capture session ───────────────────────────────────────
    const session = await createCapture(page);
    await session.navigate(url);

    // ── Step 3: Pre-consent snapshot (2.5s window) ───────────────────────────
    await session.settle(PRE_CONSENT_MS);
    const preRequests = session.getRequests();

    // ── Step 4: Detect CMP ───────────────────────────────────────────────────
    const cmp = await detectCMP(page, preRequests);
    const hasConsentSignal = preRequests.some((r) =>
      r.url.includes('ccm/collect') || r.url.includes('consent_mode')
    );
    const cmpPresent = cmp.detected || hasConsentSignal;

    // ── Step 5: Act on consent banner per scenario ──────────────────────────
    let consentActed = false;
    let consentAction = 'none';

    if (scenario === 'accept') {
      if (cmpPresent) {
        consentActed = await tryAcceptConsent(page);
        consentAction = consentActed ? 'accepted' : 'could-not-accept';
      }
      await session.settle(SETTLE_ACCEPT_MS);

    } else if (scenario === 'reject') {
      if (cmpPresent) {
        consentActed = await tryRejectConsent(page);
        consentAction = consentActed ? 'rejected' : 'could-not-reject';
      }
      await session.settle(SETTLE_REJECT_MS);

    } else {
      // no-action: do nothing, just wait
      await session.settle(SETTLE_NOACTION_MS);
    }

    // ── Step 6: Collect all requests + JS timeline ───────────────────────────
    const allRequests = session.getRequests();
    const timeline    = await extractTimeline(page, allRequests);

    // ── Step 7: JS detection (what Pixel Helper / Tag Assistant sees) ────────
    const jsDetection = await detectTagsViaJS(page);

    // ── Step 8: Network detection ────────────────────────────────────────────
    const gtmDet  = detectGTM(allRequests);
    const adsDet  = detectGoogleAds(allRequests);
    const metaDet = detectMeta(allRequests);

    const gtmRes  = validateGTM(gtmDet);
    const adsRes  = validateGoogleAds(adsDet);
    const metaRes = validateMeta(metaDet);

    // ── Step 9: Pre-consent firing (GDPR check) ─────────────────────────────
    const earlyReqs  = allRequests.filter((r) => r.msAfterNav <= PRE_CONSENT_MS);
    const adsPre     = detectGoogleAds(earlyReqs);
    const metaPre    = detectMeta(earlyReqs);

    const preConsentFiring = {
      googleAdsFired: adsPre.fired,
      metaFired:      metaPre.fired,
      isGdprConcern:  cmp.detected && (adsPre.fired || metaPre.fired),
    };

    return {
      scenario,
      url,
      startedAt,
      durationMs:    Date.now() - startMs,
      cmp,
      cmpPresent,
      consentActed,
      consentAction,
      timeline,
      requests:      allRequests,
      preConsentFiring,
      jsDetection,
      detections:    { gtm: gtmDet, googleAds: adsDet, meta: metaDet },
      validations:   { gtm: gtmRes, googleAds: adsRes, meta: metaRes },
      blockedRequests: allRequests.filter((r) => r.blocked),
    };

  } catch (err) {
    return {
      scenario,
      url,
      startedAt,
      durationMs:    Date.now() - startMs,
      error:         err.message,
      cmp:           { detected: false, vendor: null, bannerVisible: false },
      cmpPresent:    false,
      consentActed:  false,
      consentAction: 'error',
      timeline:      [],
      requests:      [],
      preConsentFiring: { googleAdsFired: false, metaFired: false, isGdprConcern: false },
      jsDetection:   { gtm: { loaded: false }, meta: { loaded: false }, googleAds: { loaded: false } },
      detections:    { gtm: { fired: false }, googleAds: { fired: false }, meta: { fired: false } },
      validations:   { gtm: { loaded: false }, googleAds: { scriptDelivered: false }, meta: { scriptDelivered: false } },
      blockedRequests: [],
    };
  } finally {
    await context.close().catch(() => {});
  }
}

module.exports = { runScenario };
