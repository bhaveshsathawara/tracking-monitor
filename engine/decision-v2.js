/**
 * engine/decision-v2.js
 *
 * Pure function — takes three ScenarioResults and produces a Decision object.
 *
 * Decision shape:
 *   {
 *     overall:    'Working' | 'Partially Working' | 'Broken',
 *     tags: {
 *       gtm:        { status, rootCause },
 *       meta:       { status, rootCause },
 *       googleAds:  { status, rootCause },
 *       cmp:        { status, rootCause },
 *     },
 *     gdprConcerns: string[],   // GDPR-specific violations
 *     summary:    string,       // one-liner for email subject / dashboard header
 *   }
 *
 * Statuses:
 *   'Working'           — tag is behaving exactly as expected
 *   'Partially Working' — tag fires but with timing/configuration issues
 *   'Broken'            — tag is not working or causing a compliance issue
 *   'Not Configured'    — tag not installed on this site (not necessarily broken)
 */

function decide(acceptResult, rejectResult, noActionResult) {
  const A  = acceptResult;
  const R  = rejectResult;
  const NA = noActionResult;

  const gdprConcerns = [];

  // ── Helpers ───────────────────────────────────────────────────────────────

  const aGTM  = A?.jsDetection?.gtm?.loaded  || A?.detections?.gtm?.fired;
  const aAds  = A?.detections?.googleAds?.fired || A?.jsDetection?.googleAds?.loaded;
  const aMeta = A?.detections?.meta?.fired    || A?.jsDetection?.meta?.loaded;

  const rMeta = R?.detections?.meta?.fired;
  const rAds  = R?.detections?.googleAds?.fired;

  const naMeta = NA?.detections?.meta?.fired;
  const naAds  = NA?.detections?.googleAds?.fired;

  const cmpPresent = A?.cmpPresent || R?.cmpPresent || NA?.cmpPresent || false;
  const aAccepted  = A?.consentActed && A?.consentAction === 'accepted';
  const rRejected  = R?.consentActed && R?.consentAction === 'rejected';

  const aCMP_t  = timeOf(A?.timeline, 'cmpLoad');
  const aGTM_t  = timeOf(A?.timeline, 'gtmLoad');

  // ── GTM ───────────────────────────────────────────────────────────────────

  let gtmStatus    = 'Working';
  let gtmRootCause = null;

  if (!aGTM) {
    gtmStatus    = 'Broken';
    gtmRootCause = 'GTM container script did not load at all.';
  } else if (aCMP_t && aGTM_t && aGTM_t < aCMP_t) {
    gtmStatus    = 'Partially Working';
    gtmRootCause = `GTM loaded at ${aGTM_t}ms, before CMP was ready at ${aCMP_t}ms. Tags may fire without consent.`;
  }

  // ── CMP ───────────────────────────────────────────────────────────────────

  let cmpStatus    = 'Working';
  let cmpRootCause = null;

  if (!cmpPresent) {
    cmpStatus    = 'Not Configured';
    cmpRootCause = 'No consent banner detected. This may be intentional (non-EU site) or a misconfiguration.';
  } else if (!aAccepted) {
    cmpStatus    = 'Partially Working';
    cmpRootCause = 'CMP detected but the accept button could not be clicked automatically. Post-consent tag behaviour could not be verified.';
  }

  // ── Meta Pixel ────────────────────────────────────────────────────────────

  let metaStatus    = 'Working';
  let metaRootCause = null;

  if (aMeta && rMeta) {
    metaStatus    = 'Broken';
    metaRootCause = 'Meta Pixel fires even after consent is REFUSED — GDPR violation.';
    gdprConcerns.push('Meta Pixel fires on consent rejection');
  } else if (aMeta && naMeta) {
    metaStatus    = 'Broken';
    metaRootCause = 'Meta Pixel fires without ANY consent interaction — GDPR violation.';
    gdprConcerns.push('Meta Pixel fires before any consent decision');
  } else if (A?.preConsentFiring?.metaFired && cmpPresent) {
    metaStatus    = 'Broken';
    metaRootCause = 'Meta Pixel fires within 2.5s of page load, before user could interact with the consent banner.';
    gdprConcerns.push('Meta Pixel fires pre-consent (within 2.5s of page load)');
  } else if (!aMeta && aAccepted) {
    metaStatus    = 'Broken';
    metaRootCause = 'Meta Pixel did not fire after consent was accepted. Tag is missing, trigger is wrong, or pixel ID is incorrect.';
  } else if (!aMeta && !aAccepted) {
    metaStatus    = 'Not Configured';
    metaRootCause = 'Cannot determine — consent could not be simulated. Manual verification required.';
  }

  // ── Google Ads ────────────────────────────────────────────────────────────

  let adsStatus    = 'Working';
  let adsRootCause = null;

  if (aAds && rAds) {
    adsStatus    = 'Broken';
    adsRootCause = 'Google Ads tag fires even after consent is REFUSED — GDPR violation.';
    gdprConcerns.push('Google Ads fires on consent rejection');
  } else if (aAds && naAds) {
    adsStatus    = 'Broken';
    adsRootCause = 'Google Ads tag fires without ANY consent interaction — GDPR violation.';
    gdprConcerns.push('Google Ads fires before any consent decision');
  } else if (A?.preConsentFiring?.googleAdsFired && cmpPresent) {
    adsStatus    = 'Broken';
    adsRootCause = 'Google Ads fires within 2.5s of page load, before user could interact with the consent banner.';
    gdprConcerns.push('Google Ads fires pre-consent (within 2.5s of page load)');
  } else if (!aAds && aAccepted) {
    adsStatus    = 'Broken';
    adsRootCause = 'Google Ads tag did not fire after consent was accepted. Tag missing or wrong conversion ID.';
  } else if (!aAds && !aAccepted) {
    adsStatus    = 'Not Configured';
    adsRootCause = 'Cannot determine — consent could not be simulated. Manual verification required.';
  }

  // ── Overall decision ──────────────────────────────────────────────────────

  const statuses = [gtmStatus, cmpStatus, metaStatus, adsStatus];
  const hasBroken  = statuses.some((s) => s === 'Broken');
  const hasPartial = statuses.some((s) => s === 'Partially Working');

  let overall;
  if (hasBroken)       overall = 'Broken';
  else if (hasPartial) overall = 'Partially Working';
  else                 overall = 'Working';

  // ── Summary line ─────────────────────────────────────────────────────────

  let summary;
  if (gdprConcerns.length > 0) {
    summary = `GDPR VIOLATION: ${gdprConcerns[0]}`;
  } else if (overall === 'Broken') {
    const broken = [];
    if (gtmStatus   === 'Broken') broken.push('GTM');
    if (metaStatus  === 'Broken') broken.push('Meta Pixel');
    if (adsStatus   === 'Broken') broken.push('Google Ads');
    summary = `Broken: ${broken.join(', ')}`;
  } else if (overall === 'Partially Working') {
    summary = 'Configuration issues detected — review recommended';
  } else {
    summary = 'All tracking tags working correctly';
  }

  return {
    overall,
    tags: {
      gtm:       { status: gtmStatus,   rootCause: gtmRootCause },
      cmp:       { status: cmpStatus,   rootCause: cmpRootCause },
      meta:      { status: metaStatus,  rootCause: metaRootCause },
      googleAds: { status: adsStatus,   rootCause: adsRootCause },
    },
    gdprConcerns,
    summary,
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function timeOf(timeline, labelSubstring) {
  if (!Array.isArray(timeline)) return null;
  const ev = timeline.find((e) => e.label && e.label.includes(labelSubstring));
  return ev ? ev.msAfterNav : null;
}

module.exports = { decide };
