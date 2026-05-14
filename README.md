# Polymarket CLOB Trading Server

Lightweight Node.js + TypeScript server for Polymarket CLOB trading. It exposes HTTP order APIs and connects to the authenticated Polymarket user WebSocket channel for order/trade lifecycle logs.

## Stack

- TypeScript
- Fastify HTTP API
- `@polymarket/clob-client-v2`
- `viem` signer
- `ws` user channel
- `dotenv`, `zod`, `pino`

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The default API URL is `http://localhost:3000`.

## Environment

Required:

- `POLYMARKET_PRIVATE_KEY`: signer private key, `0x` prefixed.
- `POLYMARKET_SIGNATURE_TYPE`: `EOA`, `POLY_PROXY`, `POLY_GNOSIS_SAFE`, `GNOSIS_SAFE`, `POLY_1271`, or numeric `0`-`3`.
- `POLYMARKET_FUNDER_ADDRESS`: required for proxy/safe/deposit-wallet flows.

API credentials:

- Set `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, `POLYMARKET_API_PASSPHRASE`, or
- Set `POLYMARKET_DERIVE_API_KEY=true` to call `createOrDeriveApiKey()` on boot.

Signature type mapping:

| Name | Value | Funder |
| --- | ---: | --- |
| `EOA` | `0` | signer EOA address |
| `POLY_PROXY` | `1` | existing Polymarket proxy wallet address |
| `POLY_GNOSIS_SAFE` / `GNOSIS_SAFE` | `2` | existing Safe wallet address |
| `POLY_1271` | `3` | deposit wallet address |

For new API users, Polymarket currently recommends deposit wallets with `POLY_1271`. In that case, the private key signs orders, but the funder is the deployed deposit wallet address. Existing proxy and Safe users should keep their current funder/proxy wallet address and matching signature type.

## API

### `POST /orders`

```bash
curl -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{
    "tokenId": "OUTCOME_TOKEN_ID",
    "side": "BUY",
    "price": 0.53,
    "size": 10,
    "orderType": "GTC"
  }'
```

GTD example:

```bash
curl -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{
    "tokenId": "OUTCOME_TOKEN_ID",
    "side": "SELL",
    "price": 0.6,
    "size": 5,
    "orderType": "GTD",
    "expiration": 1770000000
  }'
```

Success response:

```json
{
  "success": true,
  "orderId": "0x...",
  "raw": {}
}
```

### `POST /orders/market`

```bash
curl -X POST http://localhost:3000/orders/market \
  -H 'content-type: application/json' \
  -d '{
    "tokenId": "OUTCOME_TOKEN_ID",
    "side": "BUY",
    "amount": 100,
    "orderType": "FOK"
  }'
```

### `DELETE /orders/:orderId`

```bash
curl -X DELETE http://localhost:3000/orders/0xORDER_ID
```

### `POST /orders/cancel`

```bash
curl -X POST http://localhost:3000/orders/cancel \
  -H 'content-type: application/json' \
  -d '{"orderIds":["0xORDER_ID_1","0xORDER_ID_2"]}'
```

### `DELETE /orders`

```bash
curl -X DELETE http://localhost:3000/orders
```

### `GET /orders/:orderId`

```bash
curl http://localhost:3000/orders/0xORDER_ID
```

### `GET /orders/open`

```bash
curl 'http://localhost:3000/orders/open?market=0xCONDITION_ID&asset_id=OUTCOME_TOKEN_ID'
```

## WebSocket User Channel

On boot, the server connects to:

```text
wss://ws-subscriptions-clob.polymarket.com/ws/user
```

It sends the SDK API credentials in the auth payload, subscribes with `POLYMARKET_USER_STREAM_MARKETS`, sends `PING` every 10 seconds, and reconnects with exponential backoff.

The user channel filters by market condition IDs, not token IDs. Set:

```bash
POLYMARKET_USER_STREAM_MARKETS=0xcondition1,0xcondition2
```

Incoming events are logged as structured pino logs and emitted internally as:

- `order.created`
- `order.failed`
- `order.filled`
- `order.cancelled`
- `order.updated`

## Error Shape

Polymarket errors are normalized as:

```json
{
  "success": false,
  "code": "POLYMARKET_ORDER_FAILED",
  "message": "...",
  "details": {}
}
```

## Notes

- This server does not query market metadata or any database.
- `tokenId`, `conditionId`, `tickSize`, and `negRisk` should come from your upstream system. This sample exposes default `POLYMARKET_DEFAULT_TICK_SIZE` and `POLYMARKET_DEFAULT_NEG_RISK` env values.
- Before trading, ensure the funder wallet has pUSD/outcome token balances and required exchange approvals.
