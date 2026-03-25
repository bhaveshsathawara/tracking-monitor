const fs      = require('fs/promises');
const https   = require('https');
const { ALERTS_LOG_PATH, SLACK_WEBHOOK, EMAIL } = require('./config');

// nodemailer is optional — only loaded if email is configured
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (_) {}

// ── Main ──────────────────────────────────────────────────────────────────────

async function checkAndAlert(currentDomains, previousDomains) {
  const alerts = [];
  const prevMap = new Map(
    (previousDomains || []).map((d) => [d.domain, d.summary.status])
  );

  for (const domain of currentDomains) {
    const currentStatus  = domain.summary.status;
    const previousStatus = prevMap.get(domain.domain) || null;
    const s              = domain.summary;

    const entry = {
      timestamp:      new Date().toISOString(),
      domain:         domain.domain,
      currentStatus,
      previousStatus,
      issues:         s.issues || [],
      cmpBlocking:    s.cmpBlocking || false,
      gdprConcern:    s.gdprConcern || false,
      blockedCount:   s.totalBlockedRequests || 0,
    };

    if (currentStatus === 'error') {
      alerts.push({ ...entry, severity: 'error' });
    } else if (currentStatus === 'warning' && (!previousStatus || previousStatus === 'ok')) {
      alerts.push({ ...entry, severity: 'warning' });
    } else if (currentStatus === 'ok' && previousStatus === 'error') {
      alerts.push({ ...entry, severity: 'recovery' });
    }

    // Always alert on GDPR concern (pre-consent firing)
    if (s.gdprConcern) {
      alerts.push({
        ...entry,
        severity: 'gdpr',
        issues: ['Tags firing before CMP consent granted — potential GDPR violation'],
      });
    }
  }

  // Log and notify
  for (const alert of alerts) {
    await appendAlertLog(alert);
    const icon = { error: '❌', warning: '⚠️ ', recovery: '✅', gdpr: '🚨' }[alert.severity] || '⚪';
    console.log(`[alert] ${icon} ${alert.severity.toUpperCase()} — ${alert.domain}: ${alert.issues.join('; ') || alert.currentStatus}`);
  }

  if (alerts.length > 0) {
    if (SLACK_WEBHOOK) {
      await sendSlackAlert(alerts).catch((e) =>
        console.error('[alerter] Slack send failed:', e.message)
      );
    }
    if (EMAIL.enabled) {
      await sendEmailAlert(alerts).catch((e) =>
        console.error('[alerter] Email send failed:', e.message)
      );
    } else if (EMAIL.to && !EMAIL.smtpUser) {
      console.log(`[alerter] Email not sent — set SMTP_USER and SMTP_PASS to enable email alerts to ${EMAIL.to}`);
    }
  }

  return { alertsFired: alerts.length, alerts };
}

// ── Log writer ────────────────────────────────────────────────────────────────

async function appendAlertLog(entry) {
  await fs.appendFile(ALERTS_LOG_PATH, JSON.stringify(entry) + '\n', 'utf8').catch(() => {});
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendEmailAlert(alerts) {
  if (!nodemailer) {
    console.warn('[alerter] nodemailer not installed. Run: npm install nodemailer');
    return;
  }

  const transporter = nodemailer.createTransport({
    host:   EMAIL.smtpHost,
    port:   EMAIL.smtpPort,
    secure: EMAIL.smtpPort === 465,
    auth:   { user: EMAIL.smtpUser, pass: EMAIL.smtpPass },
  });

  const icon  = { error: '🔴', warning: '🟡', recovery: '🟢', gdpr: '🚨' };
  const rows  = alerts.map((a) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:10px 14px">${icon[a.severity] || '⚪'} <strong>${a.domain}</strong></td>
      <td style="padding:10px 14px;text-transform:uppercase;font-weight:600;color:${a.severity === 'error' ? '#dc2626' : a.severity === 'recovery' ? '#16a34a' : '#d97706'}">${a.severity}</td>
      <td style="padding:10px 14px">${a.issues.join('<br>') || a.currentStatus}</td>
    </tr>`).join('');

  const html = `
  <div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto">
    <div style="background:#1e293b;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
      <h2 style="margin:0">📊 Tracking Monitor Alert</h2>
      <p style="margin:6px 0 0;opacity:.7;font-size:13px">${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</p>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 14px;text-align:left">Domain</th>
            <th style="padding:10px 14px;text-align:left">Severity</th>
            <th style="padding:10px 14px;text-align:left">Issue</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px;font-size:13px;color:#64748b">
        Open <code>reports/index.html</code> for the full dashboard.<br>
        This alert was sent by your Tracking Monitor running on your computer.
      </p>
    </div>
  </div>`;

  await transporter.sendMail({
    from:    EMAIL.from || EMAIL.smtpUser,
    to:      EMAIL.to,
    subject: `[Tracking Monitor] ${alerts.length} alert(s) — ${alerts.map((a) => a.domain).join(', ')}`,
    html,
  });

  console.log(`[alerter] Email sent to ${EMAIL.to}`);
}

// ── Slack ─────────────────────────────────────────────────────────────────────

function formatSlackPayload(alerts) {
  const icon = { error: '🔴', warning: '🟡', recovery: '🟢', gdpr: '🚨' };
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '📊 Tracking Monitor Alert' } },
  ];
  for (const a of alerts) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${icon[a.severity] || '⚪'} *${a.domain}* — ${a.severity.toUpperCase()}\n• ${a.issues.join('\n• ') || a.currentStatus}`,
      },
    });
  }
  return { blocks };
}

function sendSlackAlert(alerts) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(formatSlackPayload(alerts));
    const url     = new URL(SLACK_WEBHOOK);
    const req     = https.request(
      { hostname: url.hostname, path: url.pathname + url.search, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => { res.resume(); resolve(res.statusCode); }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { checkAndAlert, appendAlertLog };
