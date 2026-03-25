/**
 * scanner.js — Two-layer, two-phase page scan.
 *
 * LAYER 1 — JavaScript detection (like Pixel Helper / Tag Assistant):
 *   Inspects window globals set by GTM and its tags.
 *   This tells you what is CONFIGURED and EXECUTED in the browser.
 *
 * LAYER 2 — Network detection:
 *   Captures actual HTTP requests.
 *   This tells you whether data actually REACHED Meta/Google servers.
 *
 * PHASE 1 — Pre-consent: navigate, snapshot early requests
 * PHASE 2 — Post-consent: accept CMP, wait for tags to fire, full detection
 *
 * The combination answers: "Is the tag set up? Did it fire? Did the data deliver?"
 */

const { createCapture }                                = require('./capture');
const { detectGTM, detectGoogleAds, detectMeta,
        detectTagsViaJS }                              = require('./detector');
const { validateGTM, validateGoogleAds, validateMeta } = require('./validator');
const { conclude }                                     = require('./decision');
const { detectCMP, tryAcceptConsent }                  = require('./cmp');

const PRE_CONSENT_WINDOW_MS = 2500;

async function scanPage(page, url) {
  const startedAt = new Date().toISOString();
  const startMs   = Date.now();

  // ── Phase 1: Navigate & snapshot pre-consent state ───────────────────────
  const session = await createCapture(page);
  await session.navigate(url);
  await session.settle(PRE_CONSENT_WINDOW_MS);

  const preConsentRequests = session.getRequests();
  const cmp = await detectCMP(page, preConsentRequests);

  // ── Phase 2: Accept CMP → wait for tags to fire ──────────────────────────
  let consentAccepted = false;

  const hasConsentModeSignal = preConsentRequests.some(
    (r) => r.url.includes('ccm/collect') || r.url.includes('consent_mode')
  );
  const shouldTryAccept = cmp.detected || hasConsentModeSignal;

  if (shouldTryAccept) {
    consentAccepted = await tryAcceptConsent(page);
    if (consentAccepted) {
      const vendor = cmp.vendor || (hasConsentModeSignal ? 'Consent Mode v2' : 'unknown');
      console.log(`[scanner]     ✓ Consent accepted (${vendor}) — waiting for tags…`);
      await session.settle(7000);
    } else {
      console.log(`[scanner]     ⚠ CMP present — accept button not found, tags may be blocked`);
      await session.settle(3000);
    }
  } else {
    await session.settle(4000);
  }

  // ── Layer 1: JavaScript detection (what GTM / Pixel Helper sees) ─────────
  const jsDetection = await detectTagsViaJS(page);

  // ── Layer 2: Network detection (what actually reached servers) ────────────
  const allRequests = session.getRequests();
  const gtmDet  = detectGTM(allRequests);
  const adsDet  = detectGoogleAds(allRequests);
  const metaDet = detectMeta(allRequests);

  const gtmRes  = validateGTM(gtmDet);
  const adsRes  = validateGoogleAds(adsDet);
  const metaRes = validateMeta(metaDet);

  // ── Conclusion ────────────────────────────────────────────────────────────
  // Use JS detection as fallback — if GTM loaded via JS but network was blocked,
  // that's a warning (CMP blocking), not an error (tag missing).
  let conclusion = conclude(gtmRes, adsRes, metaRes, gtmDet, adsDet, metaDet);

  const gtmOk   = gtmRes.loaded        || jsDetection.gtm.loaded;
  const metaOk  = metaDet.fired        || jsDetection.meta.loaded;
  const adsOk   = adsDet.fired         || jsDetection.googleAds.loaded;

  if (conclusion.status === 'error') {
    if (cmp.detected && !consentAccepted) {
      // CMP blocked everything and we couldn't accept — not an infrastructure error
      conclusion = {
        status:  'warning',
        message: `CMP (${cmp.vendor || 'unknown'}) is blocking tags — could not auto-accept consent`,
      };
    } else if (gtmOk && (!metaOk || !adsOk)) {
      // GTM is working but a specific tag inside it isn't delivering
      const missing = [!metaOk && 'Meta Pixel', !adsOk && 'Google Ads'].filter(Boolean);
      conclusion = {
        status:  'warning',
        message: `GTM loaded OK, but ${missing.join(' and ')} not delivering data to server`,
      };
    }
  }

  // ── CMP blocking assessment ───────────────────────────────────────────────
  const anyNetworkFailed = !gtmRes.loaded || !adsRes.scriptDelivered || !metaRes.scriptDelivered;
  const cmpBlocking      = shouldTryAccept && anyNetworkFailed;

  // ── Pre-consent GDPR check ────────────────────────────────────────────────
  const earlyRequests = allRequests.filter((r) => r.msAfterNav <= PRE_CONSENT_WINDOW_MS);
  const adsPre        = detectGoogleAds(earlyRequests);
  const metaPre       = detectMeta(earlyRequests);

  const preConsentFiring = {
    windowMs:                 PRE_CONSENT_WINDOW_MS,
    gtmFiredPreConsent:       detectGTM(earlyRequests).fired,
    googleAdsFiredPreConsent: adsPre.fired,
    metaFiredPreConsent:      metaPre.fired,
    isGdprConcern:            cmp.detected && (adsPre.fired || metaPre.fired),
  };

  return {
    url,
    scannedAt:         startedAt,
    durationMs:        Date.now() - startMs,
    requests:          allRequests,
    preConsentRequests,
    cmp,
    consentAccepted,
    cmpBlocking,
    preConsentFiring,
    jsDetection,                              // Layer 1: what GTM/JS sees
    detections:  { gtm: gtmDet, googleAds: adsDet, meta: metaDet },   // Layer 2: network
    validations: { gtm: gtmRes, googleAds: adsRes, meta: metaRes },
    conclusion,
    blockedRequests: allRequests.filter((r) => r.blocked),
  };
}

module.exports = { scanPage };
