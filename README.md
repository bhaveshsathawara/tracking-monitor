# 🔍 Tracking Monitor

A production-quality Node.js tool to monitor the tracking health of a website. Validates whether GTM is loaded, whether platform tags are firing, and whether requests are successfully delivered to Google Ads and Meta.

---

## What it does

Visits your target website in a headless browser, intercepts all outbound network requests, and produces a health report telling you exactly what's working and what isn't.

```
=== Tracking Health Report ===

GTM:          ✅ Loaded

Google Ads:
  Fired:      Yes
  Delivered:  Yes
  Status:     200

Meta:
  Fired:      Yes
  Delivered:  No
  Status:     0

Conclusion:   ⚠️  Warning: Tracking blocked (CMP or ad blocker)
```

---

## Architecture

```
config.js        →  domain, platforms, detection rules
browser.js       →  Puppeteer launcher (headless Chrome)
capture.js       →  network request + response interceptor
detector.js      →  GTM / Google Ads / Meta pattern matching
validator.js     →  fired + delivered logic (status 200 / 204)
decision.js      →  conclusion rules engine
index.js         →  entry point
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

---

## Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/tracking-monitor.git
cd tracking-monitor

# Install dependencies
npm install
```

---

## Usage

```bash
node index.js
```

The tool will:
1. Launch a headless Chromium browser
2. Visit the configured domain
3. Wait 7–10 seconds for all tags to fire
4. Intercept and validate all outbound tracking requests
5. Print the health report to your terminal

---

## Configuration

Edit `config.js` to change the target domain or detection rules:

```js
module.exports = {
  url: 'https://fr.igraal.com',
  waitMs: 8000,
  platforms: {
    gtm: {
      pattern: 'googletagmanager.com/gtm.js',
    },
    googleAds: {
      pattern: 'googleads.g.doubleclick.net/pagead/',
    },
    meta: {
      pattern: 'facebook.com/tr',
    },
  },
};
```

---

## Decision logic

| Condition | Output |
|---|---|
| GTM missing | 🔴 Critical: GTM not loaded |
| GTM present, no platform requests | 🔴 Critical: Tags not firing |
| Requests fired but not delivered | ⚠️ Warning: Tracking blocked (CMP or ad blocker) |
| Only some platforms working | ⚠️ Warning: Partial tracking failure |
| All platforms delivered | ✅ Healthy tracking |

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All tracking healthy |
| `1` | Warning or partial failure |
| `2` | Fatal crash |

---

## Dependencies

| Package | Purpose |
|---|---|
| [puppeteer](https://pptr.dev/) | Headless browser automation |

---

## Running in CI (GitHub Actions)

Create `.github/workflows/tracking-monitor.yml`:

```yaml
name: Tracking health check

on:
  schedule:
    - cron: '0 8 * * 1-5'   # Weekdays at 8am UTC
  workflow_dispatch:          # Manual trigger

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: node index.js
```

---

## License

MIT
