#!/bin/sh
# ══════════════════════════════════════════════════════════════════════════════
# Norton E-Library — Docker Entrypoint
# 1. Wait for PostgreSQL to be ready
# 2. Run Sequelize migrations
# 3. Seed default permissions (idempotent)
# 4. Start the server
# ══════════════════════════════════════════════════════════════════════════════
set -e

echo "╔══════════════════════════════════════════════════════╗"
echo "║   Norton E-Library Backend — Starting...             ║"
echo "╚══════════════════════════════════════════════════════╝"

# ── 1. Wait for PostgreSQL ────────────────────────────────────────────────────
# DATABASE_URL format: postgresql://user:pass@host:port/db
if [ -n "$DATABASE_URL" ]; then
  # Extract host and port from DATABASE_URL
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_PORT=${DB_PORT:-5432}

  echo "⏳ Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  MAX_RETRIES=30
  RETRY_COUNT=0
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
      echo "✅ PostgreSQL is ready!"
      break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Attempt ${RETRY_COUNT}/${MAX_RETRIES} — retrying in 2s..."
    sleep 2
  done

  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Could not connect to PostgreSQL after ${MAX_RETRIES} attempts"
    exit 1
  fi
fi

# ── 2. Run database migrations ────────────────────────────────────────────────
echo ""
echo "📦 Running database migrations..."
npx sequelize-cli db:migrate --env production 2>&1 || {
  echo "⚠️  Migrations failed (may be fine on first run with existing schema)"
}

# ── 3. Seed default permissions (idempotent via upsert) ──────────────────────
echo ""
echo "🌱 Seeding default permissions..."
node seed_permissions.js 2>&1 || {
  echo "⚠️  Permission seeding had issues (non-fatal)"
}

# ── 4. Start the server ──────────────────────────────────────────────────────
echo ""
echo "🚀 Starting Node.js server on port ${PORT:-5005}..."
exec node src/index.js
