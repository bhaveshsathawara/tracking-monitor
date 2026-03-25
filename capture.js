const { TARGET_URL, NETWORK_IDLE_TIMEOUT } = require('./config');

/**
 * Creates a capture session that continuously records all network requests
 * for the lifetime of the page. Requests are accessible at any point via
 * session.getRequests().
 *
 * Usage:
 *   const session = await createCapture(page);
 *   await session.navigate(url);
 *   const earlyRequests = session.getRequests();   // snapshot anytime
 *   // ... do things on the page (click accept, etc.) ...
 *   await session.settle(5000);
 *   const allRequests = session.getRequests();     // includes post-consent
 */
async function createCapture(page) {
  const requestMap      = new Map();
  let   counter         = 0;
  let   navigationStart = Date.now();

  await page.setRequestInterception(true);

  page.on('request', (req) => {
    const now = Date.now();
    requestMap.set(req, {
      id:            ++counter,
      url:           req.url(),
      method:        req.method(),
      resourceType:  req.resourceType(),
      status:        null,
      blocked:       false,
      failureReason: null,
      startedAt:     now,
      durationMs:    null,
      msAfterNav:    now - navigationStart,
    });
    req.continue();
  });

  page.on('requestfailed', (req) => {
    const e = requestMap.get(req);
    if (e) {
      e.blocked       = true;
      e.failureReason = req.failure()?.errorText || 'unknown';
      e.durationMs    = Date.now() - e.startedAt;
    }
  });

  page.on('response', (res) => {
    const e = requestMap.get(res.request());
    if (e) {
      e.status     = res.status();
      e.durationMs = Date.now() - e.startedAt;
    }
  });

  return {
    async navigate(url) {
      navigationStart = Date.now();
      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout:   NETWORK_IDLE_TIMEOUT + 15000,
        });
      } catch (err) {
        console.warn(`[capture] Navigation warning: ${err.message}`);
      }
      // Recalculate msAfterNav now that we have the real navigationStart
      for (const e of requestMap.values()) {
        e.msAfterNav = e.startedAt - navigationStart;
      }
    },

    getRequests() {
      return Array.from(requestMap.values());
    },

    settle(ms = 3000) {
      return new Promise((r) => setTimeout(r, ms));
    },

    get navigationStartMs() { return navigationStart; },
  };
}

// ── Backwards-compat wrapper used by debug.js ─────────────────────────────────
async function captureRequests(page, url, options = {}) {
  const session = await createCapture(page);
  await session.navigate(url || TARGET_URL);
  await session.settle(Math.min(options.timeout || 5000, 5000));
  return { requests: session.getRequests(), navigationStartMs: session.navigationStartMs };
}

module.exports = { createCapture, captureRequests };
