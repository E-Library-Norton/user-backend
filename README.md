# Norton E-Library User Backend

This README focuses on **database backup, restore, and migration**.

> **Last Updated:** April 24, 2026

## 1) Prerequisites

1. Go to backend folder:
   ```bash
   cd /Users/david/Documents/Norton-University/E-Library-NU/user-backend
   ```
2. Make sure PostgreSQL tools are installed:
   ```bash
   psql --version
   pg_dump --version
   ```
3. For Render, prepare your external database URL:
   ```bash
   export DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB_NAME?sslmode=require'
   ```

## 2) Create Backup

### A) Backup from Docker database
```bash
npm run db:backup
```

### B) Backup from local PostgreSQL
```bash
npm run db:backup:local
```

### C) Backup from Render (remote URL)
```bash
./scripts/backup-db.sh --url "$DATABASE_URL"
```

Backups are saved in `backups/` as `elibrary_YYYY-MM-DD_HHMMSS.sql.gz`.

## 3) Check Backup Before Restore (Important)

1. List backup files:
   ```bash
   ls -lahtr backups
   ```
2. Check that backup is not empty:
   ```bash
   gunzip -c backups/<your-file>.sql.gz | head
   ```
3. Confirm it contains table schema:
   ```bash
   gunzip -c backups/<your-file>.sql.gz | rg '^CREATE TABLE '
   ```

If file is empty or has no `CREATE TABLE`, do not restore it.

## 4) Restore Backup to Database

### A) Restore to Docker database
```bash
./scripts/restore-db.sh --docker backups/<your-file>.sql.gz
```

### B) Restore to local PostgreSQL
```bash
./scripts/restore-db.sh backups/<your-file>.sql.gz
```

### C) Restore to Render database
```bash
./scripts/restore-db.sh --url "$DATABASE_URL" backups/<your-file>.sql.gz
```

The script will ask confirmation (`yes/no`).

## 5) Run Migrations After Restore (Required)

Always run migrations after restore, especially when backup is older than latest code migrations.

```bash
DATABASE_URL="$DATABASE_URL" DB_SSL=true npm run db:migrate
```

Why this matters:
- Restore gives you schema/data from backup date.
- Newer migrations (for example `feedbacks` table) may be missing until you run `db:migrate`.

## 6) Verify Data After Restore

```bash
psql "$DATABASE_URL" -c "select count(*) as public_tables from pg_tables where schemaname='public';"
psql "$DATABASE_URL" -c "select count(*) from \"SequelizeMeta\";"
psql "$DATABASE_URL" -c "select count(*) from users;"
psql "$DATABASE_URL" -c "select count(*) from books;"
```

## 7) Common Errors and Fixes

### `password authentication failed`
- Use real Render credentials (not placeholders like `...` or `REAL_PASSWORD`).
- Copy **External Database URL** from Render.
- Add `?sslmode=require` for Render connections.

### `relation "..." does not exist`
- Run migrations:
  ```bash
  DATABASE_URL="$DATABASE_URL" DB_SSL=true npm run db:migrate
  ```

### Backup restored but data missing
- You probably restored an empty/invalid backup file.
- Re-check file with step 3 and restore a valid backup.

## 8) Recommended Full Flow (Render)

```bash
cd /Users/david/Documents/Norton-University/E-Library-NU/user-backend
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB_NAME?sslmode=require'

# 1) (Optional) create fresh backup
./scripts/backup-db.sh --url "$DATABASE_URL"

# 2) restore selected backup
./scripts/restore-db.sh --url "$DATABASE_URL" backups/<your-file>.sql.gz

# 3) run pending migrations
DATABASE_URL="$DATABASE_URL" DB_SSL=true npm run db:migrate

# 4) verify
psql "$DATABASE_URL" -c "select count(*) as public_tables from pg_tables where schemaname='public';"
```

## 9) Security Note

If database credentials were shared in chat, screenshots, or terminal history, rotate the DB password in Render and update `DATABASE_URL`.
