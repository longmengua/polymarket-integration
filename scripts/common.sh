#!/usr/bin/env sh

set -eu

# Default server URL. Override per command:
# BASE_URL=http://localhost:3001 ./scripts/health.sh
BASE_URL="${BASE_URL:-http://localhost:3000}"

require_var() {
  name="$1"
  value="$2"

  if [ -z "$value" ]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

curl_json() {
  method="$1"
  url="$2"
  data="${3:-}"

  if [ -n "$data" ]; then
    curl -sS -X "$method" "$url" \
      -H "content-type: application/json" \
      -d "$data"
  else
    curl -sS -X "$method" "$url"
  fi

  echo
}
