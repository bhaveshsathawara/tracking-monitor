#!/usr/bin/env node
/**
 * collector.js — Real visitor data collection server.
 */

const http = require('http');
const fs   = require('fs/promises');
const path = require('path');

// ✅ Improved PORT handling (Railway + local compatible)
const PORT = Number(process.env.PORT) || Number(process.env.COLLECTOR_PORT) || 3001;

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
 * Read recent visitor logs and compute stats
 */
// Convert UTC ISO string to IST (UTC+5:30), with milliseconds
function toIST(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 23).replace('T', ' ') + ' IST';
}

async function readVisitorStats(days = 7, requesterIp = '') {
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
      try {
        visits.push(JSON.parse(line));
      } catch (_) {}
    }
  }

  const byDomain = {};

  for (const v of visits) {
    const d = v.domain || 'unknown';

    if (!byDomain[d]) {
      byDomain[d] = {
        visits: 0,
        gtmLoaded: 0,
        metaLoaded: 0,
        adsLoaded: 0,
        consentGiven: 0,
        consentDenied: 0,
        consentUnknown: 0,
      };
    }

    byDomain[d].visits++;
    if (v.tags?.gtmLoaded)  byDomain[d].gtmLoaded++;
    if (v.tags?.metaPixel)  byDomain[d].metaLoaded++;
    if (v.tags?.googleAds)  byDomain[d].adsLoaded++;

    if (v.consent?.given === true) byDomain[d].consentGiven++;
    else if (v.consent?.given === false) byDomain[d].consentDenied++;
    else byDomain[d].consentUnknown++;
  }

  // Sort newest-first before slicing so /visits shows the latest entries
  visits.sort((a, b) => {
    const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
    const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
    return tb - ta;
  });

  const recentVisits = visits.slice(0, 500).map((v) => ({
    ...v,
    timestampIST: toIST(v.receivedAt || v.timestamp),
    isYou: requesterIp && v.ip === requesterIp,
  }));

  return {
    byDomain,
    totalVisits: visits.length,
    recentVisits,
    yourIp: requesterIp,
  };
}

// ── HTTP server ─────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // ✅ CORS (important for GTM/browser calls)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // ── POST /collect ────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/collect') {
    const chunks = [];

    req.on('data', (c) => chunks.push(c));

    req.on('end', async () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const data = raw ? JSON.parse(raw) : {};

        await saveVisit({
          ...data,
          receivedAt: new Date().toISOString(),
          ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
            .split(',')[0]
            .trim(),
        });

        res.writeHead(204);
        res.end();
      } catch (e) {
        console.error('[collector] ❌ Invalid payload', e.message);
        res.writeHead(400);
        res.end('Bad request');
      }
    });

    return;
  }

  // ── GET /stats ───────────────────────────────────────────
  if (req.method === 'GET' && req.url.startsWith('/stats')) {
    try {
      const requesterIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
      const stats = await readVisitorStats(7, requesterIp);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(stats, null, 2));
    } catch (e) {
      console.error('[collector] ❌ Stats error', e.message);
      res.writeHead(500);
      res.end(e.message);
    }
    return;
  }

  // ── GET /myip ─────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/myip') {
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ip }));
    return;
  }

  // ── GET /visits ───────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/visits') {
    try {
      const requesterIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
      const stats = await readVisitorStats(7, requesterIp);
      const rows = stats.recentVisits.map((v) => {
        const isYou = v.isYou;
        const rowStyle = isYou
          ? 'background:#1e3a1e;border-left:3px solid #22c55e;'
          : '';
        const consentColor = v.consent?.given === true ? '#22c55e' : v.consent?.given === false ? '#f87171' : '#94a3b8';
        const consentText = v.consent?.given === true ? '✅ Given' : v.consent?.given === false ? '❌ Denied' : '— Unknown';
        const ipCell = isYou
          ? `<td style="padding:6px 8px;color:#22c55e;font-weight:700;font-family:monospace;font-size:11px">${v.ip} 👈 You</td>`
          : `<td style="padding:6px 8px;color:#64748b;font-family:monospace;font-size:11px">${v.ip || '—'}</td>`;
        return `<tr style="${rowStyle}">
          <td style="padding:6px 8px;color:#94a3b8;font-size:11px;white-space:nowrap">${v.timestampIST || '—'}</td>
          ${ipCell}
          <td style="padding:6px 8px;color:#e2e8f0;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.domain || '—'}</td>
          <td style="padding:6px 8px;color:#94a3b8;font-size:11px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.path || ''}">${v.path || '—'}</td>
          <td style="padding:6px 8px;font-size:11px;color:${consentColor}">${consentText}</td>
          <td style="padding:6px 8px;font-size:11px;color:${v.tags?.gtmLoaded ? '#22c55e' : '#f87171'}">${v.tags?.gtmLoaded ? '✅' : '❌'}</td>
          <td style="padding:6px 8px;font-size:11px;color:${v.tags?.metaPixel ? '#22c55e' : '#f87171'}">${v.tags?.metaPixel ? '✅' : '❌'}</td>
          <td style="padding:6px 8px;font-size:11px;color:${v.tags?.googleAds ? '#22c55e' : '#f87171'}">${v.tags?.googleAds ? '✅' : '❌'}</td>
          <td style="padding:6px 8px;color:#64748b;font-size:11px">${v.consent?.vendor || '—'}</td>
        </tr>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Recent Visits</title>
  <style>
    body { margin:0; background:#020617; color:#e2e8f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    table { border-collapse:collapse; width:100%; }
    th { background:#0f172a; color:#64748b; font-size:11px; text-transform:uppercase; padding:8px 8px; text-align:left; position:sticky; top:0; }
    tr:hover { background:#0f172a; }
    .you-badge { background:#166534; color:#bbf7d0; border:1px solid #22c55e; padding:2px 6px; border-radius:4px; font-size:11px; margin-left:8px; }
  </style>
</head>
<body>
  <div style="max-width:1400px;margin:0 auto;padding:20px">
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
      <h2 style="margin:0;color:#f1f5f9">Recent Visits (last 7 days)</h2>
      <span style="color:#64748b;font-size:13px">${stats.totalVisits} total · showing ${stats.recentVisits.length}</span>
      <span style="color:#64748b;font-size:13px">Your IP: <code style="color:#22c55e">${requesterIp}</code></span>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>Time (IST)</th><th>IP</th><th>Domain</th><th>Path</th>
            <th>Consent</th><th>GTM</th><th>Meta</th><th>Ads</th><th>CMP Vendor</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html');
      res.writeHead(200);
      res.end(html);
    } catch (e) {
      res.writeHead(500);
      res.end(e.message);
    }
    return;
  }

  // ── GET /health ──────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ── START SERVER ───────────────────────────────────────────

(async () => {
  await ensureDir();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[collector] ✅ Visitor data collector running`);
    console.log(`[collector] Port:      ${PORT}`);
    console.log(`[collector] Endpoint:  http://localhost:${PORT}/collect`);
    console.log(`[collector] Stats:     http://localhost:${PORT}/stats`);
    console.log(`[collector] Data dir:  ${VISITOR_LOGS_DIR}`);
    console.log(`\n[collector] Add the GTM tag to your container.`);
    console.log(`[collector] Set COLLECTOR_URL to your deployed URL.\n`);
  });

  // ✅ Better error handling (especially for your current issue)
  server.on('error', (err) => {
    console.error('\n[collector] ❌ Server failed to start');
    console.error(err);

    if (err.code === 'EADDRINUSE') {
      console.error(`👉 Port ${PORT} is already in use.`);
      console.error(`👉 Run: lsof -i :${PORT}`);
      console.error(`👉 Then: kill -9 <PID> OR change port`);
    }

    process.exit(1);
  });
})();

module.exports = { readVisitorStats };