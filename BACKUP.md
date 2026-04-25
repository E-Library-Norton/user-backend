# 🗄️ Norton E-Library — Database Backup & Restore Guide

> **Database:** PostgreSQL (hosted on Render)  
> **Backup location:** `backups/` folder inside `user-backend/`  
> **Backup format:** Compressed `.sql.gz` (saves ~80% disk space)  
> **Retention:** 7 days (old backups are deleted automatically on each run)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Backup — Render (Production)](#2-backup--render-production)
3. [Backup — Local Docker](#3-backup--local-docker)
4. [List & Verify Backups](#4-list--verify-backups)
5. [Restore — Render (Production)](#5-restore--render-production)
6. [Restore — Local Docker](#6-restore--local-docker)
7. [Automated Daily Backup (Cron)](#7-automated-daily-backup-cron)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

Make sure the following tools are installed on your machine:

| Tool | Check | Install |
|---|---|---|
| `pg_dump` / `psql` | `pg_dump --version` | `brew install postgresql` (macOS) |
| `gzip` / `gunzip` | `gzip --version` | Pre-installed on macOS/Linux |
| `bash` ≥ 4 | `bash --version` | `brew install bash` (macOS) |
| `docker` _(optional)_ | `docker --version` | [docker.com](https://docker.com) |

**Make scripts executable (one time only):**

```bash
chmod +x scripts/backup-db.sh scripts/restore-db.sh
```

**Ensure `.env.local` exists** with your Render connection string:

```bash
# user-backend/.env.local
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
```

---

## 2. Backup — Render (Production)

### Option A — npm script (recommended)

```bash
npm run db:backup:render
```

### Option B — Direct script

```bash
bash scripts/backup-db.sh --url "$(grep DATABASE_URL .env.local | sed 's/DATABASE_URL=//')"
```

### Option C — Explicit URL

```bash
bash scripts/backup-db.sh --url "postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
```

**Expected output:**

```
[2026-04-25 13:02:43] Starting PostgreSQL backup...
[2026-04-25 13:02:43] Mode: url  |  Retention: 7 days
[2026-04-25 13:02:52] ✓ Backup created: backups/elibrary_2026-04-25_130243.sql.gz (55 KB)
[2026-04-25 13:02:52] ✓ Backup complete. 1 backup(s) stored
```

---

## 3. Backup — Local Docker

Make sure the Docker container is running first:

```bash
npm run docker:up
```

Then run the backup:

```bash
npm run db:backup
```

Or with a custom retention period (e.g. keep 30 days):

```bash
bash scripts/backup-db.sh --docker --retention 30
```

---

## 4. List & Verify Backups

**List all backup files:**

```bash
ls -lh backups/
```

Example output:

```
-rw-r--r--  1 david  staff   56K  Apr 25 13:02  elibrary_2026-04-25_130243.sql.gz
-rw-r--r--  1 david  staff   56K  Apr 25 13:04  elibrary_2026-04-25_130405.sql.gz
```

**Preview the contents of a backup (without extracting):**

```bash
gunzip -c backups/elibrary_2026-04-25_130243.sql.gz | head -20
```

You should see:

```sql
-- PostgreSQL database dump
-- Dumped from database version 16.x
SET statement_timeout = 0;
...
```

**Check backup file integrity:**

```bash
gunzip -t backups/elibrary_2026-04-25_130243.sql.gz && echo "✓ File OK"
```

---

## 5. Restore — Render (Production)

> ⚠️ **WARNING: This overwrites ALL data in the production database. Make a fresh backup first!**

### Step 1 — Back up current state first

```bash
npm run db:backup:render
```

### Step 2 — Choose the backup file you want to restore

```bash
ls -lh backups/
```

### Step 3 — Restore using npm script

```bash
npm run db:restore:render backups/elibrary_2026-04-25_130243.sql.gz
```

Or directly:

```bash
bash scripts/restore-db.sh --url "$(grep DATABASE_URL .env.local | sed 's/DATABASE_URL=//')" backups/elibrary_2026-04-25_130243.sql.gz
```

### Step 4 — Confirm the prompt

```
⚠ WARNING: This will OVERWRITE the database 'nu_elibrary_db_nvwp'!
Backup file: backups/elibrary_2026-04-25_130243.sql.gz
Are you sure? (yes/no): yes
```

Type `yes` and press Enter.

### Step 5 — Verify

```
✓ Database restored successfully from: backups/elibrary_2026-04-25_130243.sql.gz
```

---

## 6. Restore — Local Docker

### Step 1 — Make sure Docker is running

```bash
npm run docker:up
docker ps   # confirm elibrary-db container is running
```

### Step 2 — Restore

```bash
npm run db:restore backups/elibrary_2026-04-25_130243.sql.gz
```

Or directly:

```bash
bash scripts/restore-db.sh --docker backups/elibrary_2026-04-25_130243.sql.gz
```

---

## 7. Automated Daily Backup (Cron)

Set up a cron job to back up automatically every night at **2:00 AM**.

### Step 1 — Open crontab

```bash
crontab -e
```

### Step 2 — Add the cron entry

**For Render (production):**

```cron
0 2 * * * cd /path/to/user-backend && bash scripts/backup-db.sh --url "postgresql://USER:PASSWORD@HOST:5432/DB_NAME" >> logs/backup.log 2>&1
```

**For Docker:**

```cron
0 2 * * * cd /path/to/user-backend && bash scripts/backup-db.sh --docker >> logs/backup.log 2>&1
```

> Replace `/path/to/user-backend` with the actual absolute path, e.g.  
> `/Users/david/Documents/Norton-University/E-Library-NU/user-backend`

### Step 3 — Verify cron is saved

```bash
crontab -l
```

### Step 4 — Check logs after first run

```bash
tail -f logs/backup.log
```

---

## 8. Troubleshooting

### `pg_dump: command not found`

PostgreSQL client tools are not installed.

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client
```

### `connection refused` or `SSL` error

Check your `DATABASE_URL` in `.env.local` is correct and the Render database is not paused (free tier pauses after inactivity).

```bash
psql "$(grep DATABASE_URL .env.local | sed 's/DATABASE_URL=//')" -c "SELECT 1;"
```

### Backup file is only a few bytes (< 1 KB)

The previous backup failed silently. Check if `pg_dump` is available:

```bash
which pg_dump
pg_dump --version
```

Then re-run the backup with verbose output:

```bash
bash -x scripts/backup-db.sh --url "postgresql://..."
```

### Docker container not found

```bash
docker ps -a   # list all containers (including stopped)
npm run docker:up   # start the containers
```

### Restore fails with `ERROR: role does not exist`

This happens when restoring from Render → local Docker (different DB users). Run migrations instead:

```bash
npm run db:migrate
npm run db:seed
```

---

## Quick Reference

| Task | Command |
|---|---|
| Backup Render | `npm run db:backup:render` |
| Backup Docker | `npm run db:backup` |
| List backups | `ls -lh backups/` |
| Verify backup | `gunzip -t backups/<file>.sql.gz` |
| Restore Render | `npm run db:restore:render backups/<file>.sql.gz` |
| Restore Docker | `npm run db:restore backups/<file>.sql.gz` |
| View backup log | `tail -f logs/backup.log` |

---

*Last updated: April 25, 2026*
