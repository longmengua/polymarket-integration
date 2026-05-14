# Polymarket CLOB Trading Server

TypeScript + Fastify service for Polymarket CLOB trading operations. This server does not own market discovery or market metadata; upstream services should provide `tokenId`, `conditionId`, `negRisk`, and resolved-market signals.

## What This Service Does

- Creates Polymarket CLOB market orders.
- Cancels and queries private orders.
- Connects to Polymarket authenticated user WebSocket.
- Writes user stream events to NDJSON for later DB ingestion.
- Periodically reads open orders and dynamically subscribes new markets to the existing user WebSocket.
- Exposes a redeem endpoint that an external market-info service can trigger after resolution.

It does not:

- Query or store market info.
- Discover all Polymarket markets.
- Decide whether a market is resolved.
- Automatically redeem proxy/deposit-wallet positions without the correct wallet execution path.

## Architecture

```text
HTTP client / upstream service
        |
        v
Fastify routes
        |
        +-- OrderService -> @polymarket/clob-client-v2
        |
        +-- RedeemService -> viem -> Polygon contracts
        |
        +-- UserStream -> Polymarket user WebSocket -> logs/user-stream.ndjson
        |
        +-- WalletOpenOrdersSync -> getOpenOrders() -> dynamic WS subscribe
```

Main files:

```text
src/index.ts                         App bootstrap
src/config/env.ts                    Env validation
src/routes/orderRoutes.ts            Order HTTP routes
src/routes/redeemRoutes.ts           Redeem HTTP route
src/polymarket/clobClient.ts         CLOB client setup
src/polymarket/orderService.ts       Trading operations
src/polymarket/userStream.ts         User WebSocket + event log
src/polymarket/walletOpenOrdersSync.ts Open-order polling and dynamic subscribe
src/polymarket/redeemService.ts      Onchain redeem transaction
src/types/order.ts                   Order request schemas
src/types/redeem.ts                  Redeem request schema
scripts/*.sh                         curl helpers
```

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Default URL:

```text
http://localhost:3000
```

Production-style run:

```bash
npm run build
npm run start
```

## Required Env

```env
POLYMARKET_PRIVATE_KEY=0x...
POLYMARKET_SIGNATURE_TYPE=POLY_1271
POLYMARKET_FUNDER_ADDRESS=0x...
POLYMARKET_DERIVE_API_KEY=true
POLYGON_RPC_URL=https://polygon-rpc.com
```

Signature types:

| Value | Use case |
| --- | --- |
| `EOA` / `0` | Direct EOA trading |
| `POLY_PROXY` / `1` | Polymarket proxy wallet |
| `POLY_GNOSIS_SAFE` / `2` | Safe wallet |
| `POLY_1271` / `3` | Polymarket deposit wallet |

For `POLY_PROXY`, `POLY_GNOSIS_SAFE`, or `POLY_1271`, `POLYMARKET_FUNDER_ADDRESS` must be the wallet that actually holds funds and positions.

## Endpoints

```text
GET    /health
POST   /orders/market
POST   /orders/cancel
DELETE /orders
GET    /orders/open
DELETE /orders/:orderId
GET    /orders/:orderId
POST   /redeem
```

## Trading Flow

Market order request:

```json
{
  "tokenId": "OUTCOME_TOKEN_ID",
  "side": "BUY",
  "amount": 1,
  "orderType": "FOK"
}
```

Flow:

```text
POST /orders/market
-> zod validates request
-> OrderService maps side/orderType to SDK enums
-> SDK resolves market price / tick size / negRisk by tokenId
-> wallet signs order
-> CLOB API posts order using API credentials
-> response returns success/orderId/raw
```

Market order semantics:

- `BUY amount` is USDC amount to spend.
- `SELL amount` is outcome token shares to sell.
- `tokenId` is the CLOB outcome token id, not slug or conditionId.
- `orderType` is `FOK` or `FAK`.

## Auth Model

- API key creation or derivation uses wallet signing.
- Order creation uses wallet signing.
- Posting orders, cancelling orders, and private order queries use CLOB API credentials.
- `GET /health` does not require Polymarket auth.

If `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, and `POLYMARKET_API_PASSPHRASE` are empty and `POLYMARKET_DERIVE_API_KEY=true`, the server derives credentials on startup.

## User Stream Flow

Enable:

```env
POLYMARKET_USER_STREAM_ENABLED=true
POLYMARKET_USER_STREAM_LOG_FILE=logs/user-stream.ndjson
POLYMARKET_USER_STREAM_MARKETS=
```

Flow:

```text
server starts
-> UserStream connects to wss://ws-subscriptions-clob.polymarket.com/ws/user
-> sends authenticated subscription payload
-> receives user order/trade events
-> normalizes common fields
-> writes each event to logs/user-stream.ndjson
```

Log format is NDJSON, one JSON object per line:

```json
{
  "ts": "2026-05-15T00:00:00.000Z",
  "eventName": "order.filled",
  "type": "trade",
  "status": "matched",
  "orderId": "...",
  "tradeId": "...",
  "market": "0xCONDITION_ID",
  "assetId": "OUTCOME_TOKEN_ID",
  "raw": {}
}
```

`raw` keeps the complete original Polymarket event and can be stored as JSONB.

Watch logs:

```bash
tail -f logs/user-stream.ndjson
```

## Open Orders Sync

Enable:

```env
POLYMARKET_OPEN_ORDERS_SYNC_ENABLED=true
POLYMARKET_OPEN_ORDERS_SYNC_INTERVAL_MS=15000
```

Purpose:

```text
UI or another bot places an order
-> server may not know that conditionId yet
-> WalletOpenOrdersSync calls getOpenOrders()
-> extracts openOrder.market
-> calls userStream.subscribeMarkets()
-> existing WebSocket sends operation=subscribe
-> no reconnect required
```

This only discovers markets that currently have open orders. It does not subscribe to all markets and does not query market info.

## Redeem Flow

Enable:

```env
POLYMARKET_REDEEM_ENABLED=true
```

Your market-info server should call this only after it confirms the market is resolved:

```json
{
  "conditionId": "0xCONDITION_ID",
  "negRisk": false,
  "indexSets": [1, 2],
  "waitForReceipt": true
}
```

Flow:

```text
external market-info server confirms resolved market
-> POST /redeem
-> RedeemService selects standard or neg-risk adapter
-> if EOA: viem sends redeemPositions(...) directly from EOA
-> if POLY_1271: relayer executes a deposit-wallet WALLET batch from POLYMARKET_FUNDER_ADDRESS
-> returns txHash or relayer transaction info
```

POLY_1271 setup:

```env
POLYMARKET_SIGNATURE_TYPE=POLY_1271
POLYMARKET_FUNDER_ADDRESS=0xDEPOSIT_WALLET
POLYMARKET_RELAYER_URL=https://relayer-v2.polymarket.com
POLYMARKET_REDEEM_RELAYER_DEADLINE_SECONDS=240
```

For `POLY_1271`, the owner EOA signs the relayer `DepositWallet` batch, but the onchain call executes from the deposit wallet that holds the outcome tokens. `POLY_PROXY` and Safe redeem execution are not implemented in this service yet.

## negRisk

Do not hardcode `negRisk` globally for trading.

The SDK should resolve `negRisk` by `tokenId`. If `negRisk` is wrong, the order may be signed against the wrong exchange contract and CLOB can return:

```json
{
  "error": "invalid signature"
}
```

For redeem, `negRisk` must come from your market metadata server because this service does not query market info.

## Scripts

All scripts use `BASE_URL=http://localhost:3000` by default.

```bash
./scripts/health.sh
```

Create market order:

```bash
TOKEN_ID=OUTCOME_TOKEN_ID \
SIDE=BUY \
AMOUNT=1 \
ORDER_TYPE=FOK \
./scripts/create_market_order.sh
```

Query orders:

```bash
./scripts/get_open_orders.sh
ASSET_ID=OUTCOME_TOKEN_ID ./scripts/get_open_orders.sh
ORDER_ID=ORDER_ID ./scripts/get_order.sh
```

Cancel orders:

```bash
ORDER_ID=ORDER_ID ./scripts/cancel_order.sh
ORDER_IDS_JSON='["ORDER_ID_1","ORDER_ID_2"]' ./scripts/cancel_orders.sh
./scripts/cancel_all_orders.sh
```

Redeem:

```bash
CONDITION_ID=0xCONDITION_ID \
NEG_RISK=false \
./scripts/redeem.sh
```

Use another port:

```bash
BASE_URL=http://localhost:3001 ./scripts/health.sh
```

## Error Shapes

Order errors:

```json
{
  "success": false,
  "code": "POLYMARKET_ORDER_FAILED",
  "message": "...",
  "details": {}
}
```

Redeem errors:

```json
{
  "success": false,
  "code": "POLYMARKET_REDEEM_FAILED",
  "message": "...",
  "details": {}
}
```

## Engineer Notes

- Keep market metadata ownership outside this service.
- Use `conditionId` for user stream market subscriptions.
- Use `tokenId` / `asset_id` for CLOB order placement.
- Store `logs/user-stream.ndjson` records idempotently using `orderId` / `tradeId` where available.
- For WebSocket replay gaps, reconcile with `GET /orders/open` and CLOB trade history from a separate sync job if needed.
- Be careful with private keys in `.env`; never commit `.env`.
