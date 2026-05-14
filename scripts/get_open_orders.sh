#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/common.sh"

# Optional filters:
# MARKET=0xCONDITION_ID ./scripts/get_open_orders.sh
# ASSET_ID=OUTCOME_TOKEN_ID ./scripts/get_open_orders.sh
# MARKET=0xCONDITION_ID ASSET_ID=OUTCOME_TOKEN_ID ./scripts/get_open_orders.sh
MARKET="${MARKET:-}"
ASSET_ID="${ASSET_ID:-}"

query=""
if [ -n "$MARKET" ]; then
  query="market=$MARKET"
fi

if [ -n "$ASSET_ID" ]; then
  if [ -n "$query" ]; then
    query="$query&asset_id=$ASSET_ID"
  else
    query="asset_id=$ASSET_ID"
  fi
fi

url="$BASE_URL/orders/open"
if [ -n "$query" ]; then
  url="$url?$query"
fi

curl_json GET "$url"
