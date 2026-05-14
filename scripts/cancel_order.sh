#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/common.sh"

# Required:
# ORDER_ID=0x... ./scripts/cancel_order.sh
ORDER_ID="${ORDER_ID:-}"

require_var ORDER_ID "$ORDER_ID"

curl_json DELETE "$BASE_URL/orders/$ORDER_ID"
