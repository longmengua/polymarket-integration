# Polymarket CLOB Trading Server

TypeScript + Fastify server for Polymarket CLOB market orders, order queries, and cancellations.

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

## Required Env

```env
POLYMARKET_PRIVATE_KEY=0x...
POLYMARKET_SIGNATURE_TYPE=POLY_1271
POLYMARKET_FUNDER_ADDRESS=0x...
POLYMARKET_DERIVE_API_KEY=true
```

Signature type values:

| Value | Use case |
| --- | --- |
| `EOA` / `0` | Direct EOA trading |
| `POLY_PROXY` / `1` | Polymarket proxy wallet |
| `POLY_GNOSIS_SAFE` / `2` | Safe wallet |
| `POLY_1271` / `3` | Polymarket deposit wallet |

If using `POLY_PROXY`, `POLY_GNOSIS_SAFE`, or `POLY_1271`, `POLYMARKET_FUNDER_ADDRESS` must be the proxy/safe/deposit wallet address.

## Endpoints

```text
GET    /health
POST   /orders/market
POST   /orders/cancel
DELETE /orders
GET    /orders/open
DELETE /orders/:orderId
GET    /orders/:orderId
```

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

Use another port:

```bash
BASE_URL=http://localhost:3001 ./scripts/health.sh
```

## Market Order Body

`POST /orders/market`

```json
{
  "tokenId": "OUTCOME_TOKEN_ID",
  "side": "BUY",
  "amount": 1,
  "orderType": "FOK"
}
```

For market orders:

- `BUY amount` = USDC amount to spend
- `SELL amount` = outcome token shares to sell
- `tokenId` = CLOB outcome token id, not market slug or conditionId

## Auth

- Creating or deriving API credentials uses wallet signing.
- Creating an order uses wallet signing.
- Posting, cancelling, and querying private orders use CLOB API credentials.
- `GET /health` does not require Polymarket auth.

## negRisk

Do not hardcode `negRisk` globally for all markets.

The SDK should resolve `negRisk` by `tokenId`. If `negRisk` is wrong, the order may be signed against the wrong exchange contract and CLOB can return:

```json
{
  "error": "invalid signature"
}
```

## Error Shape

```json
{
  "success": false,
  "code": "POLYMARKET_ORDER_FAILED",
  "message": "...",
  "details": {}
}
```
