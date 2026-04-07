-- ══════════════════════════════════════════════════════════════════════════════
-- Norton E-Library — Database Performance Check
--
-- Run against the production PostgreSQL database to identify:
--   1. Slow / expensive queries  (pg_stat_statements if available)
--   2. Table sizes & bloat
--   3. Index usage & missing indexes
--   4. Connection stats
--   5. Cache hit ratio
--   6. Long-running queries
--   7. Vacuum / autovacuum status
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/db-perf-check.sql
--   # or via npm script:
--   npm run db:perf
-- ══════════════════════════════════════════════════════════════════════════════

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo '  Norton E-Library — Database Performance Report'
\echo '═══════════════════════════════════════════════════════'
\echo ''

-- ── 1. Database Size ─────────────────────────────────────────────────────────
\echo '── 1. Database Size ──────────────────────────────────'
SELECT
  pg_database.datname AS database,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = current_database();

-- ── 2. Table Sizes (top 20) ─────────────────────────────────────────────────
\echo ''
\echo '── 2. Top 20 Tables by Size ──────────────────────────'
SELECT
  schemaname || '.' || relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS data_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- ── 3. Index Usage Stats ────────────────────────────────────────────────────
\echo ''
\echo '── 3. Index Usage (low usage = candidate for removal) ──'
SELECT
  schemaname || '.' || relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  CASE
    WHEN idx_scan = 0 THEN '⚠ UNUSED'
    WHEN idx_scan < 50 THEN '⚠ LOW'
    ELSE '✓ OK'
  END AS status
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
LIMIT 20;

-- ── 4. Missing Indexes (sequential scans on large tables) ───────────────────
\echo ''
\echo '── 4. Tables with High Sequential Scans (may need index) ──'
SELECT
  schemaname || '.' || relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup AS row_count,
  CASE
    WHEN n_live_tup > 1000 AND (idx_scan IS NULL OR seq_scan > idx_scan * 10)
    THEN '⚠ NEEDS INDEX'
    ELSE '✓ OK'
  END AS status
FROM pg_stat_user_tables
WHERE n_live_tup > 100
ORDER BY seq_tup_read DESC
LIMIT 15;

-- ── 5. Cache Hit Ratio ──────────────────────────────────────────────────────
\echo ''
\echo '── 5. Cache Hit Ratio (should be > 99%) ──────────────'
SELECT
  'index' AS type,
  sum(idx_blks_hit) AS hits,
  sum(idx_blks_read) AS reads,
  CASE WHEN sum(idx_blks_hit + idx_blks_read) = 0 THEN 100
       ELSE round(100.0 * sum(idx_blks_hit) / sum(idx_blks_hit + idx_blks_read), 2)
  END AS hit_ratio_pct
FROM pg_statio_user_indexes
UNION ALL
SELECT
  'table' AS type,
  sum(heap_blks_hit),
  sum(heap_blks_read),
  CASE WHEN sum(heap_blks_hit + heap_blks_read) = 0 THEN 100
       ELSE round(100.0 * sum(heap_blks_hit) / sum(heap_blks_hit + heap_blks_read), 2)
  END
FROM pg_statio_user_tables;

-- ── 6. Connection Stats ─────────────────────────────────────────────────────
\echo ''
\echo '── 6. Connection Stats ──────────────────────────────'
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections
FROM pg_stat_activity
WHERE datname = current_database();

-- ── 7. Long-Running Queries (> 30s) ────────────────────────────────────────
\echo ''
\echo '── 7. Long-Running Queries (> 30 seconds) ───────────'
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  state,
  left(query, 100) AS query_preview
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
  AND state != 'idle'
  AND datname = current_database()
ORDER BY duration DESC
LIMIT 10;

-- ── 8. Vacuum / Autovacuum Status ───────────────────────────────────────────
\echo ''
\echo '── 8. Tables Needing Vacuum ─────────────────────────'
SELECT
  schemaname || '.' || relname AS table_name,
  last_vacuum,
  last_autovacuum,
  n_dead_tup AS dead_rows,
  n_live_tup AS live_rows,
  CASE
    WHEN n_dead_tup > n_live_tup * 0.2 THEN '⚠ NEEDS VACUUM'
    ELSE '✓ OK'
  END AS status
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 15;

-- ── 9. Duplicate / Redundant Indexes ────────────────────────────────────────
\echo ''
\echo '── 9. Potentially Duplicate Indexes ─────────────────'
SELECT
  a.indrelid::regclass AS table_name,
  a.indexrelid::regclass AS index_a,
  b.indexrelid::regclass AS index_b,
  pg_size_pretty(pg_relation_size(a.indexrelid)) AS size_a,
  pg_size_pretty(pg_relation_size(b.indexrelid)) AS size_b
FROM pg_index a
JOIN pg_index b ON a.indrelid = b.indrelid
  AND a.indexrelid != b.indexrelid
  AND a.indkey::text = b.indkey::text
WHERE a.indexrelid::regclass::text < b.indexrelid::regclass::text
LIMIT 10;

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo '  Report complete!'
\echo '═══════════════════════════════════════════════════════'
\echo ''
