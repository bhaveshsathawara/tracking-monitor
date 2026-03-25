const fs   = require('fs/promises');
const path = require('path');
const { LOGS_DIR, MAX_LOG_FILES } = require('./config');

async function ensureLogDir() {
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

/**
 * Generates a filesystem-safe run ID from current timestamp.
 * Example: "2026-03-25T14-00-00Z"
 */
function makeRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('Z', 'Z');
}

/**
 * Writes a RunLog object to logs/<runId>.json
 * Also enforces MAX_LOG_FILES by deleting oldest files.
 */
async function writeRunLog(runLog) {
  await ensureLogDir();
  const filePath = path.join(LOGS_DIR, `${runLog.runId}.json`);
  await fs.writeFile(filePath, JSON.stringify(runLog, null, 2), 'utf8');

  // Rotate: keep only the most recent MAX_LOG_FILES files
  const files = (await fs.readdir(LOGS_DIR))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();

  for (const old of files.slice(MAX_LOG_FILES)) {
    await fs.unlink(path.join(LOGS_DIR, old)).catch(() => {});
  }
}

/**
 * Reads the most recent N run log files.
 * Returns array of RunLog objects, newest first.
 */
async function readRecentLogs(n = 50) {
  await ensureLogDir();

  const files = (await fs.readdir(LOGS_DIR))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, n);

  const logs = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(LOGS_DIR, file), 'utf8');
      logs.push(JSON.parse(raw));
    } catch (_) {
      // Skip malformed files
    }
  }
  return logs;
}

module.exports = { ensureLogDir, makeRunId, writeRunLog, readRecentLogs };
