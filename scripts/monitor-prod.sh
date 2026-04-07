#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Norton E-Library — Production Monitoring Dashboard
#
# Continuous monitoring with configurable interval.
# Combines health checks with response-time tracking and uptime stats.
#
# Usage:
#   ./scripts/monitor-prod.sh                 # check once
#   ./scripts/monitor-prod.sh --loop          # repeat every 5 min
#   ./scripts/monitor-prod.sh --loop --interval 120   # every 2 min
#   ./scripts/monitor-prod.sh --report        # show last 24h summary
#
# Log file: logs/monitor.jsonl  (one JSON object per run, append-only)
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/monitor.jsonl"
HEALTH_SCRIPT="${SCRIPT_DIR}/health-check.sh"

LOOP=false
INTERVAL=300   # seconds (5 min)
REPORT=false

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --loop)     LOOP=true; shift ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --report)   REPORT=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--loop] [--interval N] [--report]"
      echo "  --loop        Repeat health checks continuously"
      echo "  --interval N  Seconds between checks (default: 300)"
      echo "  --report      Show last 24h summary from logs"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

# ── Report mode ───────────────────────────────────────────────────────────────
if $REPORT; then
  if [[ ! -f "$LOG_FILE" ]]; then
    echo "No monitor log found at ${LOG_FILE}"
    exit 1
  fi

  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  Norton E-Library — 24h Monitoring Report"
  echo "═══════════════════════════════════════════════════════"
  echo ""

  TWENTY_FOUR_AGO="$(date -v-24H '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -d '24 hours ago' '+%Y-%m-%d %H:%M:%S')"

  TOTAL=0
  ALL_PASS=0
  ANY_FAIL=0
  TOTAL_WARN=0

  while IFS= read -r line; do
    ts="$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin).get('timestamp',''))" 2>/dev/null)"
    if [[ "$ts" > "$TWENTY_FOUR_AGO" || "$ts" == "$TWENTY_FOUR_AGO" ]]; then
      ((TOTAL++))
      p="$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pass',0))")"
      f="$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin).get('fail',0))")"
      w="$(echo "$line" | python3 -c "import sys,json; print(json.load(sys.stdin).get('warn',0))")"
      if [[ "$f" -eq 0 ]]; then
        ((ALL_PASS++))
      else
        ((ANY_FAIL++))
      fi
      TOTAL_WARN=$((TOTAL_WARN + w))
    fi
  done < "$LOG_FILE"

  if [[ "$TOTAL" -eq 0 ]]; then
    echo "  No checks recorded in the last 24 hours."
  else
    UPTIME_PCT=$(echo "scale=2; ${ALL_PASS} * 100 / ${TOTAL}" | bc)
    echo "  Checks run:       ${TOTAL}"
    echo "  All-pass runs:    ${ALL_PASS}"
    echo "  Runs with fails:  ${ANY_FAIL}"
    echo "  Total warnings:   ${TOTAL_WARN}"
    echo "  Uptime:           ${UPTIME_PCT}%"
  fi

  echo ""
  echo "  Last 10 entries:"
  echo "  ─────────────────────────────────────────────────"
  tail -10 "$LOG_FILE" | while IFS= read -r line; do
    ts="$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  {d[\"timestamp\"]}  pass={d[\"pass\"]}  fail={d[\"fail\"]}  warn={d[\"warn\"]}')" 2>/dev/null)"
    echo "$ts"
  done
  echo ""
  exit 0
fi

# ── Single or Loop mode ──────────────────────────────────────────────────────
run_check() {
  local result
  result="$(bash "$HEALTH_SCRIPT" --json 2>/dev/null || true)"

  # Always display human-readable output too
  bash "$HEALTH_SCRIPT" 2>/dev/null || true

  # Append JSON to log
  if [[ -n "$result" ]]; then
    echo "$result" >> "$LOG_FILE"
  fi
}

if $LOOP; then
  echo ""
  echo "Starting continuous monitoring (interval: ${INTERVAL}s) ..."
  echo "Press Ctrl+C to stop."
  echo "Logs: ${LOG_FILE}"
  echo ""
  while true; do
    run_check
    echo ""
    echo "Next check in ${INTERVAL}s ... ($(date '+%H:%M:%S'))"
    sleep "$INTERVAL"
  done
else
  run_check
fi
