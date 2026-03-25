/**
 * engine/timing.js
 *
 * Injects JavaScript hooks into the page BEFORE any page scripts run.
 * Captures precise millisecond timing of:
 *   CMP load · GTM load · PageView · Meta Pixel fire · Google Ads fire
 *
 * Works alongside network request timestamps from capture.js.
 * The two sources together give the full picture:
 *   - JS hooks = what executed in the browser (like Pixel Helper sees)
 *   - Network   = what actually left the browser toward the ad platform
 */

// ── Injection script (runs inside the browser page) ──────────────────────────

const INJECT_SCRIPT = `
(function() {
  window.__tm = window.__tm || { events: [], navStart: performance.now() };

  function record(label, source, detail) {
    window.__tm.events.push({
      label,
      msAfterNav: Math.round(performance.now() - window.__tm.navStart),
      source,
      detail: detail || null,
    });
  }

  // ── Detect CMP globals ──────────────────────────────────────────────────
  ['Didomi','OneTrust','Cookiebot','axeptio','tarteaucitron','CookieYes'].forEach(function(name) {
    var _val;
    try {
      Object.defineProperty(window, name, {
        get: function() { return _val; },
        set: function(v) {
          if (!_val) record('cmpLoad:' + name, 'js-hook', null);
          _val = v;
        },
        configurable: true,
      });
    } catch(e) {}
  });

  // ── Intercept dataLayer (GTM events + PageView) ─────────────────────────
  var _dataLayer = [];
  function patchDataLayer(arr) {
    var _push = arr.push.bind(arr);
    arr.push = function() {
      var result = _push.apply(arr, arguments);
      for (var i = 0; i < arguments.length; i++) {
        var item = arguments[i];
        if (item && typeof item === 'object') {
          if (item.event === 'gtm.js') record('gtmLoad', 'dataLayer-poll', { uniqueId: item['gtm.uniqueEventId'] });
          if (item.event === 'gtm.load') record('gtmFired', 'dataLayer-poll', null);
          if (item.event) record('dataLayerEvent:' + item.event, 'dataLayer-poll', { event: item.event });
        }
      }
      return result;
    };
  }

  try {
    Object.defineProperty(window, 'dataLayer', {
      get: function() { return _dataLayer; },
      set: function(arr) {
        _dataLayer = arr;
        patchDataLayer(arr);
      },
      configurable: true,
    });
    patchDataLayer(_dataLayer);
  } catch(e) {}

  // ── Intercept google_tag_manager (GTM loaded) ───────────────────────────
  var _gtm;
  try {
    Object.defineProperty(window, 'google_tag_manager', {
      get: function() { return _gtm; },
      set: function(v) {
        if (!_gtm) record('gtmGlobalSet', 'js-hook', null);
        _gtm = v;
      },
      configurable: true,
    });
  } catch(e) {}

  // ── Intercept fbq (Meta Pixel) ──────────────────────────────────────────
  var _fbq;
  try {
    Object.defineProperty(window, 'fbq', {
      get: function() { return _fbq; },
      set: function(fn) {
        if (!_fbq) record('metaPixelLoaded', 'js-hook', null);
        // Wrap to capture every fbq() call
        var wrapped = function(action, eventName) {
          if (action === 'track' || action === 'trackCustom' || action === 'trackSingle') {
            record('metaPixelFire:' + (eventName || 'unknown'), 'js-hook', { action: action, event: eventName });
          }
          return fn.apply(this, arguments);
        };
        try { Object.assign(wrapped, fn); } catch(e) {}
        _fbq = wrapped;
      },
      configurable: true,
    });
  } catch(e) {}

  // ── Intercept gtag (Google Ads / GA4) ───────────────────────────────────
  var _gtag;
  try {
    Object.defineProperty(window, 'gtag', {
      get: function() { return _gtag; },
      set: function(fn) {
        if (!_gtag) record('gtagLoaded', 'js-hook', null);
        var wrapped = function(command, target) {
          record('gtagCall:' + command + ':' + (target || ''), 'js-hook', { command: command, target: target });
          return fn.apply(this, arguments);
        };
        try { Object.assign(wrapped, fn); } catch(e) {}
        _gtag = wrapped;
      },
      configurable: true,
    });
  } catch(e) {}

})();
`;

// ── Network-event classifier ──────────────────────────────────────────────────

const NETWORK_LABEL_MAP = [
  { label: 'cmpLoad',       patterns: ['axept.io', 'cookielaw.org', 'cookiebot.com', 'privacy-center.org', 'tarteaucitron', 'didomi.io', 'cdn-cookieyes.com'] },
  { label: 'gtmLoad',       patterns: ['googletagmanager.com/gtm.js', 'googletagmanager.com/gtag/js'] },
  { label: 'metaPixelLoad', patterns: ['connect.facebook.net'] },
  { label: 'metaPixelFire', patterns: ['facebook.com/tr'] },
  { label: 'googleAdsLoad', patterns: ['googleadservices.com', 'googleads.g.doubleclick.net', 'google.com/pagead', 'stats.g.doubleclick.net'] },
  { label: 'consentMode',   patterns: ['google.com/ccm/collect', 'consent_mode'] },
];

function classifyRequest(url) {
  const lower = url.toLowerCase();
  for (const { label, patterns } of NETWORK_LABEL_MAP) {
    if (patterns.some((p) => lower.includes(p))) return label;
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call BEFORE page.goto(). Injects timing hooks into the page.
 */
async function injectTimingHooks(page) {
  await page.evaluateOnNewDocument(INJECT_SCRIPT);
}

/**
 * Call AFTER page has settled. Extracts and merges JS + network timeline events.
 * Returns sorted TimingEvent[].
 */
async function extractTimeline(page, requests) {
  // JS-captured events
  let jsEvents = [];
  try {
    jsEvents = await page.evaluate(() => (window.__tm && window.__tm.events) || []);
  } catch (_) {}

  // Network-captured events
  const networkEvents = [];
  for (const r of requests) {
    const label = classifyRequest(r.url);
    if (!label) continue;
    networkEvents.push({
      label:     label + (r.blocked ? ':blocked' : ''),
      msAfterNav: r.msAfterNav,
      source:    'network',
      detail:    { url: r.url.replace(/\?.*/, '?…'), status: r.status, blocked: r.blocked, failureReason: r.failureReason },
    });
  }

  return [...jsEvents, ...networkEvents]
    .sort((a, b) => (a.msAfterNav || 0) - (b.msAfterNav || 0));
}

module.exports = { injectTimingHooks, extractTimeline };
