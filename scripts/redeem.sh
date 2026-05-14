#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/common.sh"

# Required:
# CONDITION_ID=0x... NEG_RISK=false ./scripts/redeem.sh
#
# Optional:
# INDEX_SETS_JSON='[1,2]' WAIT_FOR_RECEIPT=true ./scripts/redeem.sh
CONDITION_ID="${CONDITION_ID:-}"
NEG_RISK="${NEG_RISK:-false}"
INDEX_SETS_JSON="${INDEX_SETS_JSON:-[1,2]}"
WAIT_FOR_RECEIPT="${WAIT_FOR_RECEIPT:-true}"

require_var CONDITION_ID "$CONDITION_ID"

payload=$(printf '{"conditionId":"%s","negRisk":%s,"indexSets":%s,"waitForReceipt":%s}' \
  "$CONDITION_ID" \
  "$NEG_RISK" \
  "$INDEX_SETS_JSON" \
  "$WAIT_FOR_RECEIPT")

curl_json POST "$BASE_URL/redeem" "$payload"
