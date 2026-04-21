#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="$here/.env.migration"

if [[ ! -f "$env_file" ]]; then
  echo "error: $env_file not found. Copy .env.migration.example to .env.migration and fill it in." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

if [[ -z "${CSV_EXPORT_DIR:-}" ]]; then
  echo "error: CSV_EXPORT_DIR not set in .env.migration" >&2
  exit 1
fi

rm -fv "$CSV_EXPORT_DIR/integration_options-export-2026-04-20_16-10-02.csv" || true
rm -fv "$CSV_EXPORT_DIR/auth_contexts-export-2026-04-20_16-07-17.csv" || true

echo "Note: agents_safe is a view, will be skipped during imports."
