/**
 * engine/page-scan.js
 *
 * Orchestrates three consent scenarios for a single URL and produces a PageReport.
 * This is the main entry point for scanning a single page.
 *
 * PageReport shape:
 *   {
 *     url:          string,
 *     scannedAt:    ISO string,
 *     durationMs:   number,
 *     accept:       ScenarioResult,
 *     reject:       ScenarioResult,
 *     noAction:     ScenarioResult,
 *     decision:     Decision,         // from engine/decision-v2.js
 *     explanations: Explanation[],    // from engine/explainer.js
 *   }
 */

const { runScenario } = require('./scenario');
const { decide }      = require('./decision-v2');
const { explain }     = require('./explainer');

/**
 * @param {object} browser  - Puppeteer browser instance
 * @param {string} url
 * @returns {Promise<PageReport>}
 */
async function scanPage(browser, url) {
  const startMs   = Date.now();
  const scannedAt = new Date().toISOString();

  console.log(`  [scan] → ${url}`);

  // Run three scenarios sequentially to avoid resource contention.
  // Each scenario opens and closes its own isolated browser context.
  const accept   = await runScenario(browser, url, 'accept');
  const reject   = await runScenario(browser, url, 'reject');
  const noAction = await runScenario(browser, url, 'no-action');

  const decision     = decide(accept, reject, noAction);
  const explanations = explain(accept, reject, noAction);

  const durationMs = Date.now() - startMs;

  if (decision.overall !== 'Working') {
    console.log(`  [scan] ⚠  ${decision.summary} (${durationMs}ms)`);
  } else {
    console.log(`  [scan] ✅ ${decision.summary} (${durationMs}ms)`);
  }

  return {
    url,
    scannedAt,
    durationMs,
    accept,
    reject,
    noAction,
    decision,
    explanations,
  };
}

module.exports = { scanPage };
