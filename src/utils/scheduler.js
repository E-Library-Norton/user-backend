const cron   = require('node-cron');
const { exec } = require('child_process');
const path   = require('path');
const fs     = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
// Default: run at 02:00 AM server time every day.
// Override by setting BACKUP_CRON env var, e.g. "0 14 * * *" for 2 PM.
const BACKUP_CRON    = process.env.BACKUP_CRON    || '0 2 * * *';
const RETENTION_DAYS = process.env.RETENTION_DAYS || '7';

const ROOT_DIR    = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'backup-db.sh');
const LOG_DIR     = path.join(ROOT_DIR, 'logs');
const LOG_FILE    = path.join(LOG_DIR, 'backup.log');

// ── Helpers ───────────────────────────────────────────────────────────────────
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) { /* non-fatal */ }
}

// ── Run backup ────────────────────────────────────────────────────────────────
function runBackup() {
  ensureLogDir();
  log('⏰  Scheduled backup starting…');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log('❌  DATABASE_URL is not set — skipping backup.');
    return;
  }

  const cmd = `bash "${SCRIPT_PATH}" --url "${dbUrl}"`;
  const env = { ...process.env, RETENTION_DAYS };

  exec(cmd, { env }, (err, stdout, stderr) => {
    if (stdout) stdout.split('\n').filter(Boolean).forEach(l => log(`[backup] ${l}`));
    if (stderr) stderr.split('\n').filter(Boolean).forEach(l => log(`[backup:err] ${l}`));

    if (err) {
      log(`❌  Backup FAILED (exit ${err.code}): ${err.message}`);
    } else {
      log('✅  Backup completed successfully.');
    }
  });
}

// ── Start scheduler ───────────────────────────────────────────────────────────
function startScheduler() {
  if (!cron.validate(BACKUP_CRON)) {
    console.error(`[scheduler] Invalid BACKUP_CRON expression: "${BACKUP_CRON}" — using default "0 2 * * *"`);
  }

  const expression = cron.validate(BACKUP_CRON) ? BACKUP_CRON : '0 2 * * *';

  cron.schedule(expression, runBackup, {
    scheduled: true,
    timezone: process.env.TZ || 'Asia/Phnom_Penh',   // Cambodia time — change via TZ env var
  });

  console.log(`[scheduler] Daily backup scheduled → cron="${expression}" | tz="${process.env.TZ || 'Asia/Phnom_Penh'}" | retention=${RETENTION_DAYS} days`);
}

module.exports = { startScheduler, runBackup };
