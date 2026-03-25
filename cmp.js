/**
 * CMP (Consent Management Platform) detection.
 * Detects OneTrust, Cookiebot, Axeptio, TrustArc, Didomi and whether
 * consent has been given or banners are blocking tracking.
 */

const CMP_REQUEST_PATTERNS = {
  Axeptio:      ['axept.io', 'static.axept.io'],
  Didomi:       ['sdk.privacy-center.org', 'api.privacy-center.org', 'consent.privacy-center.org', 'didomi.io'],
  OneTrust:     ['cdn.cookielaw.org', 'optanon.blob.core.windows.net', 'onetrust.com'],
  Cookiebot:    ['consent.cookiebot.com', 'consentcdn.cookiebot.com'],
  TrustArc:     ['consent.trustarc.com', 'truste.com/notice'],
  Tarteaucitron:['tarteaucitron.io', 'tarteaucitron.js'],
  CookieYes:    ['app.cookieyes.com', 'cdn-cookieyes.com'],
  Iubenda:      ['cs.iubenda.com', 'cdn.iubenda.com'],
  Quantcast:    ['quantcast.mgr.consensu.org', 'cmp.quantcast.com'],
};

/**
 * Detects CMP vendor from captured network requests (URL pattern matching).
 * Returns vendor name string or null.
 */
function detectCMPFromRequests(requests) {
  for (const [vendor, patterns] of Object.entries(CMP_REQUEST_PATTERNS)) {
    const hit = requests.some((r) =>
      patterns.some((p) => r.url.toLowerCase().includes(p.toLowerCase()))
    );
    if (hit) return vendor;
  }
  return null;
}

/**
 * Runs inside the browser page to detect CMP presence, banner visibility,
 * and consent state.
 */
async function detectCMP(page, requests = []) {
  let result;

  try {
    result = await page.evaluate(() => {
      const w   = window;
      const doc = document;

      function elExists(selector) {
        return !!doc.querySelector(selector);
      }
      function isVisible(selector) {
        const el = doc.querySelector(selector);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }

      // ── OneTrust ─────────────────────────────────────────────────────────
      if (w.OneTrust || elExists('#onetrust-consent-sdk')) {
        let consentGiven = null;
        try {
          consentGiven = typeof w.OneTrust?.IsAlertBoxClosed === 'function'
            ? w.OneTrust.IsAlertBoxClosed()
            : null;
        } catch (_) {}
        return {
          detected:     true,
          vendor:       'OneTrust',
          bannerVisible: isVisible('#onetrust-banner-sdk') || isVisible('#onetrust-pc-sdk'),
          consentGiven,
        };
      }

      // ── Cookiebot ─────────────────────────────────────────────────────────
      if (w.Cookiebot || w.CookieConsent || elExists('#CybotCookiebotDialog')) {
        let consentGiven = null;
        try {
          consentGiven = w.Cookiebot?.consented ?? w.CookieConsent?.consent?.marketing ?? null;
        } catch (_) {}
        return {
          detected:     true,
          vendor:       'Cookiebot',
          bannerVisible: isVisible('#CybotCookiebotDialog'),
          consentGiven,
        };
      }

      // ── Axeptio ───────────────────────────────────────────────────────────
      if (w.axeptio || elExists('#axeptio_overlay') || elExists('.axeptio_widget')) {
        return {
          detected:     true,
          vendor:       'Axeptio',
          bannerVisible: isVisible('#axeptio_overlay') || isVisible('.axeptio_widget'),
          consentGiven: null,
        };
      }

      // ── Didomi ────────────────────────────────────────────────────────────
      if (w.Didomi || elExists('#didomi-popup') || elExists('#didomi-host')) {
        let consentGiven = null;
        try {
          consentGiven = w.Didomi?.getUserConsentStatusForAll?.() ?? null;
        } catch (_) {}
        return {
          detected:     true,
          vendor:       'Didomi',
          bannerVisible: isVisible('#didomi-popup') || isVisible('#didomi-notice'),
          consentGiven,
        };
      }

      // ── TrustArc ──────────────────────────────────────────────────────────
      if (w.truste || elExists('#truste-consent-content') || elExists('.truste_box_overlay')) {
        return {
          detected:     true,
          vendor:       'TrustArc',
          bannerVisible: isVisible('#truste-consent-track'),
          consentGiven: null,
        };
      }

      // ── Tarteaucitron (very common in France) ─────────────────────────────
      if (w.tarteaucitron || elExists('#tarteaucitronAlertBig') || elExists('#tarteaucitronRoot')) {
        return {
          detected:     true,
          vendor:       'Tarteaucitron',
          bannerVisible: isVisible('#tarteaucitronAlertBig') || isVisible('#tarteaucitronRoot'),
          consentGiven: null,
        };
      }

      // ── CookieYes ─────────────────────────────────────────────────────────
      if (w.getCkyConsent || elExists('.cky-consent-container') || elExists('#cookie-law-info-bar')) {
        return {
          detected:     true,
          vendor:       'CookieYes',
          bannerVisible: isVisible('.cky-consent-container') || isVisible('#cookie-law-info-bar'),
          consentGiven: null,
        };
      }

      // ── Generic: Google Consent Mode v2 signal ────────────────────────────
      // If Google Consent Mode is active (window.gtag with consent defaults),
      // a CMP is almost certainly present even if we don't recognise it.
      if (w.google_tag_data?.ics || w.__tcfapi || w.__cmp) {
        const anyBanner = !!(
          doc.querySelector('[class*="cookie"]') ||
          doc.querySelector('[class*="consent"]') ||
          doc.querySelector('[id*="cookie"]') ||
          doc.querySelector('[id*="consent"]') ||
          doc.querySelector('[class*="gdpr"]') ||
          doc.querySelector('[id*="gdpr"]')
        );
        if (anyBanner) {
          return { detected: true, vendor: 'Unknown (Consent Mode)', bannerVisible: true, consentGiven: null };
        }
      }

      return { detected: false, vendor: null, bannerVisible: false, consentGiven: null };
    });
  } catch (err) {
    result = { detected: false, vendor: null, bannerVisible: false, consentGiven: null };
  }

  // Supplement with network-based detection if page eval found nothing
  if (!result.detected) {
    const networkVendor = detectCMPFromRequests(requests);
    if (networkVendor) {
      result.detected = true;
      result.vendor   = networkVendor;
    }
  }

  // scriptsBlocked heuristic: banner is visible and consent not yet given
  result.scriptsBlocked =
    result.detected && result.bannerVisible && result.consentGiven === false;

  return result;
}

/**
 * Tries to click "Accept All" on whatever CMP is present.
 * Tries platform-specific selectors first, then falls back to
 * multilingual text matching (French, Spanish, Polish, English).
 * Returns true if a button was successfully clicked.
 */
async function tryAcceptConsent(page) {
  // Platform-specific selectors
  const selectors = [
    '#onetrust-accept-btn-handler',          // OneTrust
    '#CybotCookiebotDialogBodyButtonAccept', // Cookiebot
    '#didomi-notice-agree-button',           // Didomi
    '.didomi-accept-all',
    '[data-testid="didomi-accept-all"]',
    '.axeptio_btn_acceptAll',                // Axeptio
    '[data-axeptio-button="acceptAll"]',
    '.trustarc-agree-btn',                   // TrustArc
    '#truste-consent-button',
    '.cc-allow',                             // Cookie Consent (Osano)
    '#tarteaucitronAllDenied2',              // Tarteaucitron
    '#tarteaucitronPersonalize2',
    '#tarteaucitronAllDenied',
    '.tarteaucitronAllow',
    '[id*="accept"][id*="cookie" i]',        // Generic id patterns
    '[id*="cookie"][id*="accept" i]',
    '.cky-btn-accept',                       // CookieYes
    '#cookie-law-info-bar .cli_action_button',
    'button[data-gdpr-action="accept"]',
    'button[data-consent-action="acceptAll"]',
  ];

  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        return true;
      }
    } catch (_) {}
  }

  // Text-based fallback — covers any CMP in any language
  const acceptTexts = [
    // French
    'tout accepter', 'accepter tout', 'accepter et fermer',
    "j'accepte tout", "j'accepte", 'accepter',
    // Spanish
    'aceptar todo', 'aceptar todas', 'aceptar',
    // Polish
    'zaakceptuj wszystkie', 'zaakceptuj wszystko', 'akceptuję wszystkie', 'akceptuję',
    // English
    'accept all cookies', 'accept all', 'accept cookies', 'i accept', 'allow all',
    'allow cookies', 'agree to all',
  ];

  try {
    const clicked = await page.evaluate((texts) => {
      const candidates = [
        ...document.querySelectorAll('button'),
        ...document.querySelectorAll('a[role="button"]'),
        ...document.querySelectorAll('[role="button"]'),
      ];
      for (const btn of candidates) {
        const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase().trim();
        if (texts.some((t) => text.includes(t))) {
          btn.click();
          return true;
        }
      }
      return false;
    }, acceptTexts);
    return clicked;
  } catch (_) {
    return false;
  }
}

module.exports = { detectCMP, detectCMPFromRequests, tryAcceptConsent };
