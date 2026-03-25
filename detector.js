const { RULES } = require('./config');

// ── Network-based helpers ─────────────────────────────────────────────────────

function findAll(requests, patterns) {
  return requests.filter((r) =>
    patterns.some((pat) => r.url.toLowerCase().includes(pat.toLowerCase()))
  );
}

function findFirst(requests, patterns) {
  return findAll(requests, patterns)[0] || null;
}

// ── Network detectors (what actually reached servers) ────────────────────────

function detectGTM(requests) {
  const matches = findAll(requests, RULES.gtm.patterns);
  return { fired: matches.length > 0, request: matches[0] || null, requests: matches };
}

function detectGoogleAds(requests) {
  const scriptMatches     = findAll(requests, RULES.googleAds.patterns);
  const conversionMatches = findAll(requests, RULES.googleAds.conversionPatterns);
  const unique = [...new Map([...scriptMatches, ...conversionMatches].map((r) => [r.id, r])).values()];
  return {
    fired:             unique.length > 0,
    conversionFired:   conversionMatches.length > 0,
    request:           scriptMatches[0] || conversionMatches[0] || null,
    conversionRequest: conversionMatches[0] || null,
    requests:          unique,
  };
}

function detectMeta(requests) {
  const scriptMatches = findAll(requests, RULES.meta.patterns);
  const eventMatches  = findAll(requests, RULES.meta.eventPatterns);
  return {
    fired:        scriptMatches.length > 0 || eventMatches.length > 0,
    eventFired:   eventMatches.length > 0,
    request:      scriptMatches[0] || null,
    eventRequest: eventMatches[0]  || null,
    requests:     [...scriptMatches, ...eventMatches],
  };
}

// ── JavaScript-based detection (what Pixel Helper / Tag Assistant sees) ───────
//
// Runs INSIDE the browser page context.
// Checks window globals that GTM tags inject when they execute.
// A tag can be "configured in GTM" (JS present) but the network request can still
// be blocked by CMP — this layer shows the CONFIGURATION side.
//
async function detectTagsViaJS(page) {
  try {
    return await page.evaluate(() => {
      // ── GTM ────────────────────────────────────────────────────────────────
      const gtmLoaded = !!(window.google_tag_manager);
      const containerIds = gtmLoaded
        ? Object.keys(window.google_tag_manager).filter((k) =>
            /^(GTM-|G-|AW-|UA-)/.test(k)
          )
        : [];
      const dataLayerLength = Array.isArray(window.dataLayer) ? window.dataLayer.length : 0;

      // Scan dataLayer for tag fire evidence
      const dataLayerEvents = Array.isArray(window.dataLayer)
        ? window.dataLayer
            .filter((e) => e && e.event)
            .map((e) => e.event)
            .slice(-20) // last 20 events
        : [];

      // ── Meta Pixel ────────────────────────────────────────────────────────
      const metaPixelLoaded = typeof window.fbq === 'function';
      let metaPixelIds = [];
      try {
        if (window._fbq && window._fbq.pixelsByID) {
          metaPixelIds = Object.keys(window._fbq.pixelsByID);
        } else if (window.fbq && window.fbq.getState) {
          const state = window.fbq.getState();
          metaPixelIds = (state.pixels || []).map((p) => p.id);
        }
      } catch (_) {}
      const metaPageViewFired = dataLayerEvents.includes('fbPageView') ||
        !!(window._fbq && window._fbq.loaded);

      // ── Google Ads / gtag ─────────────────────────────────────────────────
      const gtagLoaded = typeof window.gtag === 'function';
      let googleAdsIds = [];
      try {
        // gtag stores config in google_tag_data
        const tagData = window.google_tag_data;
        if (tagData && tagData.ics && tagData.ics.entries) {
          googleAdsIds = Object.keys(tagData.ics.entries)
            .filter((id) => id.startsWith('AW-'));
        }
        // Also check dataLayer for gtag config calls
        if (Array.isArray(window.dataLayer)) {
          window.dataLayer.forEach((entry) => {
            if (Array.isArray(entry) && entry[0] === 'config' && typeof entry[1] === 'string' && entry[1].startsWith('AW-')) {
              googleAdsIds.push(entry[1]);
            }
          });
        }
      } catch (_) {}
      googleAdsIds = [...new Set(googleAdsIds)];

      // ── Google Analytics 4 ────────────────────────────────────────────────
      const ga4Ids = [];
      try {
        if (Array.isArray(window.dataLayer)) {
          window.dataLayer.forEach((entry) => {
            if (Array.isArray(entry) && entry[0] === 'config' && typeof entry[1] === 'string' && entry[1].startsWith('G-')) {
              ga4Ids.push(entry[1]);
            }
          });
        }
      } catch (_) {}

      return {
        gtm: {
          loaded:           gtmLoaded,
          containerIds,
          dataLayerLength,
          dataLayerEvents,
        },
        meta: {
          loaded:          metaPixelLoaded,
          pixelIds:        metaPixelIds,
          pageViewFired:   metaPageViewFired,
        },
        googleAds: {
          loaded:          gtagLoaded,
          conversionIds:   googleAdsIds,
        },
        ga4: {
          loaded:          gtagLoaded,
          measurementIds:  ga4Ids,
        },
      };
    });
  } catch (err) {
    return {
      gtm:       { loaded: false, containerIds: [], dataLayerLength: 0, dataLayerEvents: [] },
      meta:      { loaded: false, pixelIds: [], pageViewFired: false },
      googleAds: { loaded: false, conversionIds: [] },
      ga4:       { loaded: false, measurementIds: [] },
      error:     err.message,
    };
  }
}

module.exports = { detectGTM, detectGoogleAds, detectMeta, detectTagsViaJS, findAll, findFirst };
