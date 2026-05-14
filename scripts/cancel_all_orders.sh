#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/common.sh"

# Cancels every open order for the configured Polymarket credentials.
curl_json DELETE "$BASE_URL/orders"
