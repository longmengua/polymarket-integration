#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/common.sh"

# Required:
# TOKEN_ID=493... SIDE=BUY AMOUNT=1 ./scripts/create_market_order.sh
#
# Optional:
# ORDER_TYPE=FOK or ORDER_TYPE=FAK. Defaults to FOK.
TOKEN_ID="${TOKEN_ID:-}"
SIDE="${SIDE:-BUY}"
AMOUNT="${AMOUNT:-}"
ORDER_TYPE="${ORDER_TYPE:-FOK}"

require_var TOKEN_ID "$TOKEN_ID"
require_var AMOUNT "$AMOUNT"

payload=$(printf '{"tokenId":"%s","side":"%s","amount":%s,"orderType":"%s"}' \
  "$TOKEN_ID" \
  "$SIDE" \
  "$AMOUNT" \
  "$ORDER_TYPE")

curl_json POST "$BASE_URL/orders/market" "$payload"
