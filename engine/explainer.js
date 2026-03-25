/**
 * engine/explainer.js
 *
 * Produces human-readable explanations from scan results.
 * Designed for Marketing, Product, and Analytics teams — no technical jargon.
 *
 * Each explanation has:
 *   level:     'info' | 'warning' | 'error'
 *   tag:       'GTM' | 'Meta Pixel' | 'Google Ads' | 'CMP' | 'System'
 *   what:      What is happening (plain English)
 *   why:       Why it is happening
 *   impact:    Business impact
 *   action:    Who should fix it and how
 */

function explain(acceptResult, rejectResult, noActionResult) {
  const explanations = [];

  const A  = acceptResult;
  const R  = rejectResult;
  const NA = noActionResult;

  // Helpers
  const aGTM  = A?.jsDetection?.gtm?.loaded  || A?.detections?.gtm?.fired;
  const aAds  = A?.detections?.googleAds?.fired || A?.jsDetection?.googleAds?.loaded;
  const aMeta = A?.detections?.meta?.fired    || A?.jsDetection?.meta?.loaded;
  const rMeta = R?.detections?.meta?.fired;
  const rAds  = R?.detections?.googleAds?.fired;
  const naMeta = NA?.detections?.meta?.fired;
  const naAds  = NA?.detections?.googleAds?.fired;

  const cmp        = A?.cmp || R?.cmp || NA?.cmp || {};
  const cmpPresent = A?.cmpPresent || R?.cmpPresent || NA?.cmpPresent || false;
  const aAccepted  = A?.consentActed && A?.consentAction === 'accepted';
  const rRejected  = R?.consentActed && R?.consentAction === 'rejected';

  const aMeta_t = timeOf(A?.timeline, 'metaPixelFire');
  const aGTM_t  = timeOf(A?.timeline, 'gtmLoad');
  const aCMP_t  = timeOf(A?.timeline, 'cmpLoad');

  // ── GTM rules ─────────────────────────────────────────────────────────────

  if (!aGTM) {
    explanations.push({
      level:  'error', tag: 'GTM',
      what:   'Google Tag Manager did not load',
      why:    'The GTM container script is either missing from the page HTML, was blocked by the CMP before loading, or failed to download.',
      impact: 'Without GTM, no tracking tags can fire — Meta Pixel, Google Ads, and GA4 will all be silent.',
      action: 'Developer: verify the GTM snippet is in the <head> of every page. Check the browser console for script errors.',
    });
  } else if (aGTM && aCMP_t && aGTM_t && aGTM_t < aCMP_t) {
    explanations.push({
      level:  'warning', tag: 'GTM',
      what:   `GTM loaded at ${aGTM_t}ms — before the CMP initialised at ${aCMP_t}ms`,
      why:    'GTM is running before the consent platform is ready, which means tags inside GTM may fire briefly without checking consent state.',
      impact: 'Tracking data may be collected before consent is established — a potential GDPR concern.',
      action: 'Developer: load the CMP script before GTM, or configure GTM\'s consent initialisation trigger.',
    });
  } else {
    explanations.push({
      level: 'info', tag: 'GTM',
      what:   `GTM loaded successfully${aGTM_t ? ' at ' + aGTM_t + 'ms' : ''}`,
      why:    'The GTM container script was found and executed correctly.',
      impact: 'Tags configured in GTM are able to fire.',
      action: 'No action required.',
    });
  }

  // ── CMP rules ──────────────────────────────────────────────────────────────

  if (!cmpPresent) {
    explanations.push({
      level:  'warning', tag: 'CMP',
      what:   'No cookie consent banner was detected on this page',
      why:    'Either no CMP is installed, or the CMP is configured to show the banner only to EU visitors and your scan ran from a non-EU IP.',
      impact: 'Without a CMP, GDPR requires explicit consent before firing any tracking tags for EU users.',
      action: 'Marketing/Legal: verify your CMP setup is live for EU visitors.',
    });
  } else if (!aAccepted) {
    explanations.push({
      level:  'warning', tag: 'CMP',
      what:   `CMP detected (${cmp.vendor || 'unknown'}) but the accept button could not be clicked automatically`,
      why:    'The tool could not find a recognisable "Accept All" button. This may be due to a custom CMP design.',
      impact: 'Tag behaviour after consent could not be verified in this scan.',
      action: 'Developer: ensure the accept button is accessible. Share the CMP vendor name so the tool can be updated.',
    });
  } else {
    explanations.push({
      level: 'info', tag: 'CMP',
      what:   `CMP (${cmp.vendor || 'detected'}) is active and consent was successfully simulated`,
      why:    'The consent banner was found and accepted, allowing post-consent tags to fire.',
      impact: 'Tag behaviour shown below reflects a consenting user\'s experience.',
      action: 'No action required.',
    });
  }

  // ── Meta Pixel rules ───────────────────────────────────────────────────────

  if (!aMeta && !aAccepted) {
    explanations.push({
      level: 'warning', tag: 'Meta Pixel',
      what:  'Meta Pixel not detected — consent could not be given to test it',
      why:   'The CMP accept button was not found, so the pixel may be correctly waiting for consent.',
      impact: 'Unable to confirm if the pixel is configured correctly.',
      action: 'Manually verify: visit the page, accept the cookie banner, open the Meta Pixel Helper extension.',
    });
  } else if (aMeta && rMeta) {
    explanations.push({
      level: 'error', tag: 'Meta Pixel',
      what:  'Meta Pixel fires even when consent is REFUSED',
      why:   'The CMP rejected consent but the Meta Pixel still sent a network request to Meta\'s server.',
      impact: '🚨 GDPR violation — collecting user data without consent exposes the company to regulatory fines.',
      action: 'Developer: fix the CMP-to-GTM consent integration. The Meta Pixel tag in GTM must not fire when consent is denied.',
    });
  } else if (aMeta && naMeta) {
    explanations.push({
      level: 'error', tag: 'Meta Pixel',
      what:  'Meta Pixel fires WITHOUT any consent interaction (no-action scenario)',
      why:   'The pixel is firing immediately on page load before the user has made any consent decision.',
      impact: '🚨 GDPR violation — consent is required before any tracking for EU users.',
      action: 'Developer: the Meta Pixel tag in GTM needs a consent-based trigger. Audit the GTM container immediately.',
    });
  } else if (!aMeta && aAccepted) {
    explanations.push({
      level: 'error', tag: 'Meta Pixel',
      what:  'Meta Pixel did not fire even after consent was accepted',
      why:   'The pixel is either not configured in GTM, the GTM trigger conditions are wrong, or the CMP did not fully release consent.',
      impact: 'Meta advertising campaigns are not receiving conversion or audience data.',
      action: 'Marketing/Developer: check the Meta Pixel tag and its trigger in GTM. Ensure it has an "All Pages" or appropriate trigger. Verify the pixel ID is correct.',
    });
  } else if (aMeta && !rMeta && !naMeta) {
    const mt = aMeta_t ? ` at ${aMeta_t}ms` : '';
    const gt = aGTM_t  ? ` (GTM loaded at ${aGTM_t}ms)` : '';
    explanations.push({
      level: 'info', tag: 'Meta Pixel',
      what:  `Meta Pixel is working correctly${mt}${gt}`,
      why:   'Pixel fires after consent acceptance and is correctly blocked when consent is refused or not given.',
      impact: 'Meta campaigns are receiving accurate data from consenting users.',
      action: 'No action required.',
    });
  }

  // ── Google Ads rules ───────────────────────────────────────────────────────

  if (!aAds && !aAccepted) {
    explanations.push({
      level: 'warning', tag: 'Google Ads',
      what:  'Google Ads tag not detected — consent could not be given to test it',
      why:   'CMP accept button was not found. The tag may be correctly waiting for consent.',
      impact: 'Unable to confirm Google Ads tag is working.',
      action: 'Manually verify via Google Tag Assistant extension.',
    });
  } else if (aAds && rAds) {
    explanations.push({
      level: 'error', tag: 'Google Ads',
      what:  'Google Ads tag fires even when consent is REFUSED',
      why:   'CMP rejected consent but Google Ads still sent data.',
      impact: '🚨 GDPR violation — collecting ad data without consent.',
      action: 'Developer: fix consent integration in GTM for the Google Ads tag.',
    });
  } else if (!aAds && aAccepted) {
    explanations.push({
      level: 'error', tag: 'Google Ads',
      what:  'Google Ads tag did not fire after consent was accepted',
      why:   'The tag may be missing from GTM, have an incorrect trigger, or use a wrong Conversion ID.',
      impact: 'Google Ads campaigns are not receiving conversion data — bid optimisation and remarketing are affected.',
      action: 'Developer: check the Google Ads conversion tag in GTM. Verify the AW-XXXXXXXXX conversion ID.',
    });
  } else if (aAds && !rAds) {
    explanations.push({
      level: 'info', tag: 'Google Ads',
      what:  'Google Ads tag is working correctly',
      why:   'Tag fires after consent and is blocked when consent is refused.',
      impact: 'Google Ads campaigns are receiving accurate data.',
      action: 'No action required.',
    });
  }

  // ── Cross-scenario timing issues ───────────────────────────────────────────

  if (A?.preConsentFiring?.isGdprConcern) {
    explanations.push({
      level: 'error', tag: 'System',
      what:  'Tracking tags are firing BEFORE consent is given (within 2.5 seconds of page load)',
      why:   'Tags are executing before any user could read and interact with the consent banner.',
      impact: '🚨 GDPR violation — EU law requires consent before any tracking data is collected.',
      action: 'Developer: audit all GTM tags. No tracking tag should have a trigger that fires before consent is granted.',
    });
  }

  return explanations;
}

// ── Helper: find first timeline event matching a label ────────────────────────

function timeOf(timeline, labelSubstring) {
  if (!Array.isArray(timeline)) return null;
  const ev = timeline.find((e) => e.label && e.label.includes(labelSubstring));
  return ev ? ev.msAfterNav : null;
}

module.exports = { explain };
