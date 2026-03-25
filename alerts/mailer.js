/**
 * alerts/mailer.js
 *
 * Real-time email alerts — no batching.
 * Fires immediately when a page scan reveals an issue.
 *
 * De-duplication: the same alert key (domain + url + summary) is suppressed
 * for DEDUP_HOURS hours to avoid repeated emails during continuous monitoring.
 *
 * Requires env vars (or falls back to config.js):
 *   EMAIL_FROM    — sender address
 *   EMAIL_TO      — recipient address
 *   EMAIL_HOST    — SMTP host
 *   EMAIL_PORT    — SMTP port
 *   EMAIL_USER    — SMTP username
 *   EMAIL_PASS    — SMTP password
 */

const nodemailer = require('nodemailer');

// How long to suppress duplicate alerts (hours)
const DEDUP_HOURS = 4;

// In-memory dedup store: key → expiry timestamp
const sentAlerts = new Map();

function dedupeKey(domain, url, summary) {
  return `${domain}|${url}|${summary}`;
}

function shouldSend(domain, url, summary) {
  const key = dedupeKey(domain, url, summary);
  const now = Date.now();
  const expiry = sentAlerts.get(key);
  if (expiry && now < expiry) return false;
  sentAlerts.set(key, now + DEDUP_HOURS * 60 * 60 * 1000);
  return true;
}

// Purge expired entries periodically to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of sentAlerts.entries()) {
    if (now > expiry) sentAlerts.delete(key);
  }
}, 30 * 60 * 1000);

// ── Transport ─────────────────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ── HTML email builder ────────────────────────────────────────────────────────

function buildEmailHtml(domain, pageReport) {
  const d    = pageReport.decision;
  const gdpr = d.gdprConcerns || [];

  const statusColor = d.overall === 'Working' ? '#166534' : d.overall === 'Partially Working' ? '#854d0e' : '#7f1d1d';
  const statusFg    = d.overall === 'Working' ? '#bbf7d0' : d.overall === 'Partially Working' ? '#fef08a' : '#fecaca';

  const tagRows = Object.entries(d.tags).map(([name, t]) => {
    const color = t.status === 'Working' ? '#bbf7d0' : t.status === 'Broken' ? '#fecaca' : t.status === 'Partially Working' ? '#fef08a' : '#bfdbfe';
    return `<tr>
      <td style="padding:8px 12px;font-weight:600;text-transform:uppercase;font-size:12px">${name}</td>
      <td style="padding:8px 12px"><span style="background:${statusColor};color:${color};padding:2px 8px;border-radius:4px;font-size:11px">${t.status}</span></td>
      <td style="padding:8px 12px;font-size:12px;color:#4b5563">${t.rootCause || '—'}</td>
    </tr>`;
  }).join('');

  const explanationItems = (pageReport.explanations || [])
    .filter((e) => e.level !== 'info')
    .map((e) => `
      <div style="border-left:4px solid ${e.level === 'error' ? '#dc2626' : '#ca8a04'};padding:10px 14px;margin:8px 0;background:#f9fafb">
        <strong>[${e.tag}] ${e.what}</strong><br>
        <span style="color:#6b7280;font-size:12px">${e.why}</span><br>
        <span style="font-size:12px"><strong>Impact:</strong> ${e.impact}</span><br>
        <span style="font-size:12px"><strong>Action:</strong> ${e.action}</span>
      </div>`).join('');

  return `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:20px">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">

    <!-- Header -->
    <div style="background:${statusColor};padding:20px 24px">
      <div style="color:${statusFg};font-size:20px;font-weight:700">
        ${d.overall === 'Broken' ? '🚨' : '⚠️'} Tracking Alert: ${domain}
      </div>
      <div style="color:${statusFg};opacity:0.8;font-size:13px;margin-top:4px">${d.summary}</div>
    </div>

    <div style="padding:24px">

      ${gdpr.length > 0 ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin-bottom:20px">
        <strong style="color:#991b1b">🚨 GDPR Concerns Detected:</strong>
        <ul style="margin:8px 0 0;padding-left:20px;color:#7f1d1d">
          ${gdpr.map((g) => `<li style="font-size:13px">${g}</li>`).join('')}
        </ul>
      </div>` : ''}

      <p style="margin:0 0 16px;color:#374151">
        <strong>URL:</strong> <a href="${pageReport.url}" style="color:#2563eb">${pageReport.url}</a><br>
        <strong>Scanned at:</strong> ${new Date(pageReport.scannedAt).toLocaleString('en-GB', { timeZone: 'Europe/Paris' })} CET<br>
        <strong>Scan duration:</strong> ${Math.round(pageReport.durationMs / 1000)}s
      </p>

      <!-- Tag status table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e2e8f0">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b">TAG</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b">STATUS</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b">ROOT CAUSE</th>
          </tr>
        </thead>
        <tbody>${tagRows}</tbody>
      </table>

      <!-- Explanations -->
      ${explanationItems ? `
      <div style="margin-bottom:20px">
        <strong style="font-size:14px">What needs fixing:</strong>
        ${explanationItems}
      </div>` : ''}

      <div style="color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px">
        Sent by Tracking Monitor v4 · Alert suppressed for ${DEDUP_HOURS}h after this email
      </div>

    </div>
  </div>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send an alert email for a page that has issues.
 * Silently skips if:
 *   - EMAIL_PASS is not set (email not configured)
 *   - The same alert was already sent within DEDUP_HOURS hours
 *   - The page decision is 'Working'
 *
 * @param {string}     domain
 * @param {PageReport} pageReport
 */
async function sendAlert(domain, pageReport) {
  const d = pageReport.decision;

  // Only alert on issues
  if (d.overall === 'Working') return;

  // Check dedup
  if (!shouldSend(domain, pageReport.url, d.summary)) {
    console.log(`  [alert] ⏭  Suppressed duplicate alert for ${pageReport.url}`);
    return;
  }

  // Email must be configured
  if (!process.env.EMAIL_PASS && !process.env.EMAIL_FROM) {
    console.log(`  [alert] ⚠  Email not configured (set EMAIL_PASS). Alert suppressed.`);
    return;
  }

  const to      = process.env.EMAIL_TO   || 'bhavesh.sathawara@atolls.com';
  const from    = process.env.EMAIL_FROM || 'tracking-monitor@atolls.com';
  const subject = `[Tracking Monitor] ${d.overall}: ${domain} — ${d.summary}`;

  try {
    const transport = createTransport();
    await transport.sendMail({
      from,
      to,
      subject,
      html: buildEmailHtml(domain, pageReport),
    });
    console.log(`  [alert] ✉  Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`  [alert] ❌ Failed to send email: ${err.message}`);
  }
}

/**
 * Send a recovery email when a previously-broken domain is now working.
 */
async function sendRecoveryAlert(domain, previousSummary) {
  if (!process.env.EMAIL_PASS && !process.env.EMAIL_FROM) return;

  const to      = process.env.EMAIL_TO   || 'bhavesh.sathawara@atolls.com';
  const from    = process.env.EMAIL_FROM || 'tracking-monitor@atolls.com';
  const subject = `[Tracking Monitor] ✅ RECOVERED: ${domain}`;

  const html = `
    <div style="font-family:sans-serif;padding:20px">
      <h2 style="color:#166534">✅ ${domain} is now working correctly</h2>
      <p>Previous issue: <em>${previousSummary}</em></p>
      <p>All tracking tags are now behaving as expected.</p>
      <p style="color:#94a3b8;font-size:12px">Tracking Monitor v4</p>
    </div>`;

  try {
    const transport = createTransport();
    await transport.sendMail({ from, to, subject, html });
    console.log(`  [alert] ✉  Recovery alert sent for ${domain}`);
  } catch (err) {
    console.error(`  [alert] ❌ Failed to send recovery email: ${err.message}`);
  }
}

module.exports = { sendAlert, sendRecoveryAlert };
