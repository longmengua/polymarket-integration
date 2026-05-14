#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/common.sh"

# Required:
# ORDER_IDS_JSON='["ORDER_ID_1","ORDER_ID_2"]' ./scripts/cancel_orders.sh
ORDER_IDS_JSON="${ORDER_IDS_JSON:-}"

require_var ORDER_IDS_JSON "$ORDER_IDS_JSON"

payload=$(printf '{"orderIds":%s}' "$ORDER_IDS_JSON")

curl_json POST "$BASE_URL/orders/cancel" "$payload"
