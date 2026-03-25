// ── Domains & pages ───────────────────────────────────────────────────────────
// Pages are auto-discovered from each domain's sitemap.
// You do NOT need to add pages manually.

const DOMAINS = [
  { domain: 'fr.igraal.com', baseUrl: 'https://fr.igraal.com' },
  { domain: 'es.igraal.com', baseUrl: 'https://es.igraal.com' },
  { domain: 'igraal.pl',     baseUrl: 'https://igraal.pl'     },
];

// How many pages to scan per domain per run (sampled from sitemap)
const MAX_PAGES_PER_DOMAIN = parseInt(process.env.MAX_PAGES) || 15;

// ── Tracking detection rules ──────────────────────────────────────────────────
// Patterns use URL substring matching.
// Broad patterns catch all locales (fr_FR, es_ES, pl_PL, en_US, etc.)

const RULES = {
  gtm: {
    label: 'GTM',
    patterns: [
      'googletagmanager.com/gtm.js',
      'googletagmanager.com/gtag/js',
    ],
  },

  googleAds: {
    label: 'Google Ads',
    // Script / library load — any of these means Google Ads is present
    patterns: [
      'googleadservices.com',                          // Ads services
      'googleads.g.doubleclick.net',                   // DoubleClick
      'googlesyndication.com/pagead',                  // Ads network
      'stats.g.doubleclick.net',                       // Stats beacon
      'google.com/ads/',                               // Generic Ads
      'google.com/pagead',                             // PageAds
      'googletagmanager.com/gtag/js?id=AW-',          // gtag with Ads ID
    ],
    // Conversion / remarketing fire — tag actually sent data
    conversionPatterns: [
      'google.com/pagead/conversion',
      'googleads.g.doubleclick.net/pagead/viewthroughconversion',
      'google.com/pagead/1p-user-list',
      'googleadservices.com/pagead/conversion',
      'google.com/ads/ga-audiences',
      'stats.g.doubleclick.net/j/collect',
    ],
  },

  meta: {
    label: 'Meta Pixel',
    // Script load — locale-agnostic (matches fr_FR, es_ES, pl_PL, en_US, etc.)
    patterns: [
      'connect.facebook.net',                          // ANY Facebook script
    ],
    // Pixel event fire
    eventPatterns: [
      'facebook.com/tr',                               // Pixel endpoint
    ],
  },
};

// ── Schedule ──────────────────────────────────────────────────────────────────
// Default: every 30 minutes. Override with SCAN_INTERVAL_MS env var.
const SCAN_INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_MS) || 30 * 60 * 1000;

// ── Email alerts ──────────────────────────────────────────────────────────────
// Configure SMTP to receive email alerts when tracking breaks.
// Set these as environment variables (see README for instructions).
const EMAIL = {
  to:       process.env.EMAIL_TO   || 'bhavesh.sathawara@atolls.com',
  from:     process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  smtpHost: process.env.SMTP_HOST  || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER  || '',
  smtpPass: process.env.SMTP_PASS  || '',
  enabled:  !!(process.env.SMTP_USER && process.env.SMTP_PASS),
};

// ── Optional Slack webhook ────────────────────────────────────────────────────
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK || null;

// ── File paths ────────────────────────────────────────────────────────────────
const ALERTS_LOG_PATH = './alerts.log';
const REPORTS_DIR     = './reports';
const LOGS_DIR        = './logs';
const MAX_LOG_FILES   = 1440; // 30 days of 30-minute runs

// ── Browser settings ──────────────────────────────────────────────────────────
const NETWORK_IDLE_TIMEOUT = 10000;
const VIEWPORT = { width: 1280, height: 800 };

// Backwards-compat shim
const TARGET_URL = process.env.TARGET_URL || DOMAINS[0].baseUrl;

module.exports = {
  DOMAINS, MAX_PAGES_PER_DOMAIN,
  RULES,
  SCAN_INTERVAL_MS,
  EMAIL, SLACK_WEBHOOK,
  ALERTS_LOG_PATH, REPORTS_DIR, LOGS_DIR, MAX_LOG_FILES,
  NETWORK_IDLE_TIMEOUT, VIEWPORT,
  TARGET_URL,
};
