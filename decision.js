/**
 * High-level conclusion rules.
 * Returns { status: 'ok' | 'warning' | 'error', message }
 */

function conclude(gtmResult, adsResult, metaResult, gtmDet, adsDet, metaDet) {
  const issues = [];

  // ── GTM ──────────────────────────────────────────────────────────────────
  if (!gtmDet.fired) {
    issues.push('GTM script not found — tag may be missing from the page');
  } else if (!gtmResult.loaded) {
    issues.push(
      gtmResult.blocked
        ? 'GTM blocked (ad blocker or CMP)'
        : `GTM request failed (HTTP ${gtmResult.status})`
    );
  }

  // ── Google Ads ───────────────────────────────────────────────────────────
  if (!adsDet.fired) {
    issues.push('Google Ads script not detected');
  } else if (!adsResult.scriptDelivered) {
    issues.push(
      adsResult.blocked
        ? 'Google Ads blocked (ad blocker or CMP)'
        : `Google Ads script failed (HTTP ${adsResult.scriptStatus})`
    );
  } else if (adsDet.conversionFired && !adsResult.conversionDelivered) {
    issues.push(
      `Google Ads conversion ping failed (HTTP ${adsResult.conversionStatus})`
    );
  }

  // ── Meta Pixel ───────────────────────────────────────────────────────────
  if (!metaDet.fired) {
    issues.push('Meta Pixel script not detected');
  } else if (!metaResult.scriptDelivered) {
    issues.push(
      metaResult.blocked
        ? 'Meta Pixel blocked (ad blocker or CMP)'
        : `Meta Pixel script failed (HTTP ${metaResult.scriptStatus})`
    );
  } else if (metaDet.eventFired && !metaResult.eventDelivered) {
    issues.push(
      `Meta Pixel event not delivered (HTTP ${metaResult.eventStatus}) — ` +
      'possible ad blocker or CMP blocking'
    );
  }

  if (issues.length === 0) {
    return { status: 'ok', message: 'All tracking tags loaded and delivered successfully' };
  }

  // Distinguish hard errors from soft warnings
  const isBlocked = issues.some(
    (i) => i.includes('blocked') || i.includes('not delivered')
  );
  const isMissing = issues.some(
    (i) => i.includes('not found') || i.includes('not detected')
  );

  if (isMissing) {
    return { status: 'error', message: issues.join('; ') };
  }
  if (isBlocked) {
    return { status: 'warning', message: issues.join('; ') };
  }
  return { status: 'error', message: issues.join('; ') };
}

module.exports = { conclude };
