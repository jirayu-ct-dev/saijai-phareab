#!/usr/bin/env bash
# run-preflight.sh — read-only preflight/reconciliation runner.
#
# Opens ONE session as: BEGIN TRANSACTION READ ONLY; SET LOCAL
# statement_timeout; runs every sql/*.sql in order; ROLLBACK. Nothing can be
# written even if a script contained a mutation (the transaction rejects it).
#
# Requirements:
#   * psql on PATH (use inside `docker exec` or CI if not installed locally)
#   * DATABASE_URL pointing at a DISPOSABLE or restore-copy database
#   * explicit confirmation flag so this can never hit production by accident
#
# Usage:
#   DATABASE_URL=... ./run-preflight.sh --confirm-disposable
#   DATABASE_URL=... ./run-preflight.sh --confirm-disposable --timeout-ms 60000
#
# Never pass real production credentials on the command line and never print
# the connection URL; this script only prints a masked host/database name.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="${SCRIPT_DIR}/sql"
TIMEOUT_MS="${PREFLIGHT_TIMEOUT_MS:-30000}"
CONFIRMED=0

# tolerate "--timeout-ms 60000" two-arg form
while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout-ms)
      TIMEOUT_MS="$2"
      shift 2
      continue
      ;;
    --confirm-disposable) CONFIRMED=1 ;;
    *)
      echo "unknown argument: $1" >&2
      exit 64
      ;;
  esac
  shift
done

if [[ "${CONFIRMED}" -ne 1 ]]; then
  echo "refusing to run: pass --confirm-disposable to acknowledge the target" >&2
  echo "database is disposable or an approved restore copy (never production)" >&2
  exit 64
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set; see .env.example for the variable layout" >&2
  echo "(load it into the shell without printing values, e.g. 'set -a; . ./.env; set +a'" >&2
  echo " only after pointing it at a disposable database)" >&2
  exit 64
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found on PATH; run inside the postgres container instead:" >&2
  echo "  docker exec -i <pg-container> psql \"\$DATABASE_URL\" -X -v ON_ERROR_STOP=1 -f- <<'SQL' ..." >&2
  exit 64
fi

MASKED_URL="$(printf '%s' "${DATABASE_URL}" | sed -E 's#//[^@/]+@#//***:***@#')"
echo "preflight target (masked): ${MASKED_URL}"
echo "statement_timeout: ${TIMEOUT_MS} ms"

SQL_FILES=("${SQL_DIR}"/[0-9]*.sql)
if [[ ! -e "${SQL_FILES[0]}" ]]; then
  echo "no SQL scripts found under ${SQL_DIR}" >&2
  exit 66
fi

{
  echo "BEGIN TRANSACTION READ ONLY;"
  echo "SET LOCAL statement_timeout = '${TIMEOUT_MS}';"
  for f in "${SQL_FILES[@]}"; do
    echo "\\echo '--- running $(basename "${f}")'"
    echo "\\ir ${f}"
  done
  echo "ROLLBACK;"
} | psql "${DATABASE_URL}" -X -v ON_ERROR_STOP=1 -P pager=off -f-

echo "preflight finished; transaction rolled back (read-only)"
