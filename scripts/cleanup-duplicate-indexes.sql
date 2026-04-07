-- ══════════════════════════════════════════════════════════════════════════════
-- Norton E-Library — Drop Duplicate Indexes
--
-- Sequelize sync({ alter: true }) creates a new unique constraint index every
-- time it runs. This script keeps only ONE index per (table, column) combo
-- and drops the rest, then runs VACUUM ANALYZE.
--
-- ⚠  ALWAYS back up before running:  npm run db:backup:local -- --url "$DATABASE_URL"
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/cleanup-duplicate-indexes.sql
--   # or
--   npm run db:cleanup-indexes
-- ══════════════════════════════════════════════════════════════════════════════

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo '  Cleaning up duplicate indexes ...'
\echo '═══════════════════════════════════════════════════════'
\echo ''

-- ── Show before stats ────────────────────────────────────────────────────────
\echo '── Before: Total indexes ──────────────────────────────'
SELECT count(*) AS total_indexes,
       pg_size_pretty(sum(pg_relation_size(indexrelid))) AS total_index_size
FROM pg_stat_user_indexes;

-- ── Generate and execute DROP statements ─────────────────────────────────────
-- Strategy: Sequelize sync({alter:true}) creates duplicate UNIQUE CONSTRAINTS.
-- Each constraint has a backing index. We must DROP CONSTRAINT (not DROP INDEX).
-- For each set of duplicates on the same column(s), keep the LOWEST OID and
-- drop the rest.

DO $$
DECLARE
  drop_count INT := 0;
  skip_count INT := 0;
  rec RECORD;
BEGIN
  -- Handle duplicate unique constraints (the main problem)
  FOR rec IN
    SELECT
      conrelid::regclass::text AS table_name,
      conname AS constraint_name
    FROM (
      SELECT
        conrelid,
        conname,
        conkey,
        ROW_NUMBER() OVER (
          PARTITION BY conrelid, conkey
          ORDER BY oid ASC   -- keep the oldest
        ) AS rn
      FROM pg_constraint
      WHERE contype = 'u'  -- unique constraints only
        AND connamespace = 'public'::regnamespace
    ) ranked
    WHERE rn > 1
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',
                     rec.table_name, rec.constraint_name);
      drop_count := drop_count + 1;
    EXCEPTION WHEN OTHERS THEN
      skip_count := skip_count + 1;
      RAISE NOTICE 'Skipped %s.%: %', rec.table_name, rec.constraint_name, SQLERRM;
    END;
  END LOOP;

  -- Also drop any remaining orphan duplicate indexes (no constraint)
  FOR rec IN
    SELECT indexrelid::regclass::text AS index_name
    FROM (
      SELECT indexrelid, indrelid, indkey,
             ROW_NUMBER() OVER (
               PARTITION BY indrelid, indkey
               ORDER BY indexrelid ASC
             ) AS rn
      FROM pg_index
      WHERE indrelid IN (
        SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
      )
      AND indexrelid NOT IN (
        SELECT conindid FROM pg_constraint WHERE conindid IS NOT NULL
      )
    ) ranked
    WHERE rn > 1
  LOOP
    BEGIN
      EXECUTE 'DROP INDEX IF EXISTS ' || rec.index_name;
      drop_count := drop_count + 1;
    EXCEPTION WHEN OTHERS THEN
      skip_count := skip_count + 1;
    END;
  END LOOP;

  RAISE NOTICE '✓ Dropped % duplicate constraints/indexes (% skipped)', drop_count, skip_count;
END $$;

-- ── VACUUM ANALYZE all user tables ──────────────────────────────────────────
\echo ''
\echo '── Running VACUUM ANALYZE ───────────────────────────'
VACUUM ANALYZE;

-- ── Show after stats ─────────────────────────────────────────────────────────
\echo ''
\echo '── After: Total indexes ───────────────────────────────'
SELECT count(*) AS total_indexes,
       pg_size_pretty(sum(pg_relation_size(indexrelid))) AS total_index_size
FROM pg_stat_user_indexes;

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo '  Cleanup complete!'
\echo '═══════════════════════════════════════════════════════'
\echo ''
