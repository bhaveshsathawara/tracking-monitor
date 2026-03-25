#!/usr/bin/env node
/**
 * collector.js — Real visitor data collection server.
 *
 * Real visitors' browsers POST a small JSON payload here every page load.
 * Data is stored in logs/visitors/YYYY-MM-DD.jsonl (one line per visit).
 *
 * Deploy this server publicly (Railway, Render, etc.) so production visitors
 * can reach it. Then put the COLLECTOR_URL in the GTM tag.
 *
 * Usage:
 *   node collector.js
 *   PORT=3001 node collector.js
 */

const http = require('http');
const fs   = require('fs/promises');
const path = require('path');

const PORT             = parseInt(process.env.PORT || process.env.COLLECTOR_PORT) || 3001;
const VISITOR_LOGS_DIR = path.join(__dirname, 'logs', 'visitors');

async function ensureDir() {
  await fs.mkdir(VISITOR_LOGS_DIR, { recursive: true });
}

async function saveVisit(data) {
  const date = new Date().toISOString().split('T')[0];
  const file = path.join(VISITOR_LOGS_DIR, `${date}.jsonl`);
  await fs.appendFile(file, JSON.stringify(data) + '\n', 'utf8');
}

/**
 * Read recent visitor logs and compute daily summary stats.
 * Returns { byDomain, byDay, totals }
 */
async function readVisitorStats(days = 7) {
  await ensureDir();
  const files = (await fs.readdir(VISITOR_LOGS_DIR))
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .reverse()
    .slice(0, days);

  const visits = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(VISITOR_LOGS_DIR, file), 'utf8').catch(() => '');
    for (const line of raw.split('\n').filter(Boolean)) {
      try { visits.push(JSON.parse(line)); } catch (_) {}
    }
  }

  // Aggregate
  const byDomain = {};
  for (const v of visits) {
    const d = v.domain || 'unknown';
    if (!byDomain[d]) byDomain[d] = { visits: 0, gtmLoaded: 0, metaLoaded: 0, adsLoaded: 0, consentGiven: 0, consentDenied: 0, consentUnknown: 0 };
    byDomain[d].visits++;
    if (v.tags?.gtm)       byDomain[d].gtmLoaded++;
    if (v.tags?.meta)      byDomain[d].metaLoaded++;
    if (v.tags?.googleAds) byDomain[d].adsLoaded++;
    if (v.consent?.given === true)  byDomain[d].consentGiven++;
    else if (v.consent?.given === false) byDomain[d].consentDenied++;
    else                   byDomain[d].consentUnknown++;
  }

  return { byDomain, totalVisits: visits.length, recentVisits: visits.slice(0, 100) };
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS — allow all origins so any domain can POST here
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); return res.end();
  }

  // ── POST /collect — receive a visit beacon ────────────────────────────────
  if (req.method === 'POST' && req.url === '/collect') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      try {
        const raw  = Buffer.concat(chunks).toString('utf8');
        const data = JSON.parse(raw);
        await saveVisit({
          ...data,
          receivedAt: new Date().toISOString(),
          ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
        });
        res.writeHead(204); res.end();
      } catch (e) {
        res.writeHead(400); res.end('Bad request');
      }
    });
    return;
  }

  // ── GET /stats — return aggregated stats as JSON (for dashboard) ──────────
  if (req.method === 'GET' && req.url.startsWith('/stats')) {
    try {
      const stats = await readVisitorStats(7);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(stats, null, 2));
    } catch (e) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }

  // ── GET /health — uptime check ────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200); res.end('OK');
    return;
  }

  res.writeHead(404); res.end('Not found');
});

(async () => {
  await ensureDir();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[collector] ✅ Visitor data collector running`);
    console.log(`[collector] Endpoint:  http://localhost:${PORT}/collect`);
    console.log(`[collector] Stats:     http://localhost:${PORT}/stats`);
    console.log(`[collector] Data dir:  ${VISITOR_LOGS_DIR}`);
    console.log(`\n[collector] Add the GTM tag from gtm-tag.html to your GTM container.`);
    console.log(`[collector] Set COLLECTOR_URL to where this server is deployed.\n`);
  });
})();

module.exports = { readVisitorStats };
