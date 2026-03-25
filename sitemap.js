/**
 * sitemap.js — Auto-discovers pages from a domain's sitemap.
 *
 * Strategy:
 *  1. Read robots.txt → look for Sitemap: directive
 *  2. Try /sitemap.xml, /sitemap_index.xml
 *  3. If sitemap index → fetch first few sub-sitemaps
 *  4. Extract all <loc> URLs, de-duplicate
 *  5. Sample intelligently up to MAX_PAGES_PER_DOMAIN
 *     — always include homepage
 *     — prefer higher-priority / shallower pages
 *     — spread across distinct URL path patterns
 */

const https = require('https');
const http  = require('http');
const { MAX_PAGES_PER_DOMAIN } = require('./config');

// ── HTTP fetch helper ─────────────────────────────────────────────────────────

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const client  = url.startsWith('https') ? https : http;
    const parsed  = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  FETCH_HEADERS,
      timeout:  12000,
    };

    const req = client.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetchUrl(next, redirectCount + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    req.end();
  });
}

// ── XML parser (no dependencies — regex is reliable for well-formed sitemaps) ─

function extractLocs(xml) {
  const urls = [];
  const locRe = /<loc>([\s\S]*?)<\/loc>/gi;
  let m;
  while ((m = locRe.exec(xml)) !== null) {
    const u = m[1].trim();
    if (u.startsWith('http')) urls.push(u);
  }
  return urls;
}

function isSitemapIndex(xml) {
  return xml.includes('<sitemapindex') || xml.includes('<sitemap>');
}

// ── Sitemap fetching ──────────────────────────────────────────────────────────

async function fetchSitemapUrls(baseUrl, xml) {
  if (isSitemapIndex(xml)) {
    // It's a sitemap index — fetch each child sitemap
    const childUrls = extractLocs(xml).filter(
      (u) => u.endsWith('.xml') || u.includes('sitemap')
    );
    const allPages = [];
    for (const childUrl of childUrls.slice(0, 6)) { // max 6 sub-sitemaps
      try {
        const childXml = await fetchUrl(childUrl);
        allPages.push(...extractLocs(childXml));
      } catch (_) {}
    }
    return allPages;
  }
  return extractLocs(xml);
}

async function getSitemapXml(baseUrl) {
  // 1. Try robots.txt for Sitemap: directive
  try {
    const robots = await fetchUrl(`${baseUrl}/robots.txt`);
    const match  = robots.match(/^Sitemap:\s*(.+)$/mi);
    if (match) {
      const sitemapUrl = match[1].trim();
      const xml = await fetchUrl(sitemapUrl);
      return { xml, url: sitemapUrl };
    }
  } catch (_) {}

  // 2. Common sitemap locations
  for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml']) {
    try {
      const xml = await fetchUrl(`${baseUrl}${path}`);
      return { xml, url: `${baseUrl}${path}` };
    } catch (_) {}
  }

  return null;
}

// ── URL sampling ──────────────────────────────────────────────────────────────

/**
 * Samples up to `max` URLs from the sitemap.
 * Prioritises:
 *  - Homepage (always first)
 *  - Shallow paths (fewer slashes = more important pages)
 *  - Spread across distinct URL path prefixes
 */
function sampleUrls(allUrls, baseUrl, max) {
  // Deduplicate
  const unique = [...new Set(allUrls)];

  // Always include the homepage
  const homepage = baseUrl.replace(/\/$/, '');
  const rest = unique.filter((u) => {
    const clean = u.replace(/\/$/, '');
    return clean !== homepage;
  });

  // Sort by path depth (shallower first)
  rest.sort((a, b) => {
    const depthA = (a.match(/\//g) || []).length;
    const depthB = (b.match(/\//g) || []).length;
    return depthA - depthB;
  });

  // Take spread across distinct prefixes
  const selected = [homepage];
  const seenPrefixes = new Set(['']);
  const slots = max - 1;

  for (const url of rest) {
    if (selected.length >= max) break;
    try {
      const path   = new URL(url).pathname;
      const prefix = path.split('/').slice(0, 2).join('/'); // e.g. '/offres'
      if (!seenPrefixes.has(prefix)) {
        seenPrefixes.add(prefix);
        selected.push(url);
      }
    } catch (_) {}
  }

  // Fill remaining slots from sorted list
  for (const url of rest) {
    if (selected.length >= max) break;
    if (!selected.includes(url)) selected.push(url);
  }

  return selected.slice(0, max);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns an array of URLs to scan for the given domain.
 * Falls back to just the homepage if no sitemap is found.
 */
async function discoverPages(baseUrl, max) {
  const limit = max || MAX_PAGES_PER_DOMAIN;

  try {
    const result = await getSitemapXml(baseUrl);
    if (!result) {
      console.log(`[sitemap] No sitemap found for ${baseUrl} — using homepage only`);
      return [baseUrl];
    }

    const allUrls = await fetchSitemapUrls(baseUrl, result.xml);
    console.log(`[sitemap] ${baseUrl} → ${allUrls.length} URLs in sitemap`);

    if (allUrls.length === 0) return [baseUrl];

    // Filter to only URLs that belong to this domain
    const domainUrls = allUrls.filter((u) => {
      try { return new URL(u).hostname === new URL(baseUrl).hostname; }
      catch (_) { return false; }
    });

    const sampled = sampleUrls(domainUrls, baseUrl, limit);
    console.log(`[sitemap] ${baseUrl} → sampled ${sampled.length} pages`);
    return sampled;

  } catch (err) {
    console.warn(`[sitemap] Error for ${baseUrl}: ${err.message} — using homepage only`);
    return [baseUrl];
  }
}

module.exports = { discoverPages };
