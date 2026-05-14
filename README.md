# Polymarket CLOB Trading Server

這是一個 TypeScript + Fastify 的 Polymarket CLOB 交易服務，負責下單、取消單、查詢訂單、監聽使用者訂單事件，以及在外部服務確認市場已結算後觸發 redeem。

本服務不負責 market discovery，也不負責 market metadata。上游服務需要提供 `tokenId`、`conditionId`、`negRisk`、market resolved signal 等資訊。

## 服務範圍

本服務負責：

- 建立 Polymarket CLOB market order。
- 取消與查詢 private orders。
- 連接 Polymarket authenticated user WebSocket。
- 將 user stream event 寫成 NDJSON，方便後續寫入 DB。
- 定時讀取 open orders，並把新 market 動態加入既有 user WebSocket 訂閱。
- 提供 `POST /redeem`，讓外部 market-info server 在市場 resolved 後觸發 redeem。

本服務不負責：

- 查詢或儲存 market info。
- 掃描所有 Polymarket markets。
- 判斷市場是否已 resolved。
- 自動處理 `POLY_PROXY` / Safe 的 redeem 執行路徑。

## 架構

```text
HTTP client / upstream service
        |
        v
Fastify routes
        |
        +-- OrderService -> @polymarket/clob-client-v2
        |
        +-- RedeemService -> viem / Polymarket relayer -> Polygon contracts
        |
        +-- UserStream -> Polymarket user WebSocket -> logs/user-stream.ndjson
        |
        +-- WalletOpenOrdersSync -> getOpenOrders() -> dynamic WS subscribe
```

主要檔案：

```text
src/index.ts                           App 啟動入口
src/config/env.ts                      環境變數驗證
src/routes/orderRoutes.ts              訂單 HTTP routes
src/routes/redeemRoutes.ts             redeem HTTP route
src/polymarket/clobClient.ts           CLOB client 初始化
src/polymarket/orderService.ts         下單 / 取消 / 查詢
src/polymarket/userStream.ts           User WebSocket + 事件檔案輸出
src/polymarket/walletOpenOrdersSync.ts Open orders polling + 動態訂閱
src/polymarket/redeemService.ts        redeem 執行邏輯
src/types/order.ts                     訂單 request schemas
src/types/redeem.ts                    redeem request schema
scripts/*.sh                           curl 測試腳本
```

## 啟動

```bash
npm install
cp .env.example .env
npm run dev
```

預設 API URL：

```text
http://localhost:3000
```

production-style 啟動：

```bash
npm run build
npm run start
```

## 必要環境變數

```env
POLYMARKET_PRIVATE_KEY=0x...
POLYMARKET_SIGNATURE_TYPE=POLY_1271
POLYMARKET_FUNDER_ADDRESS=0x...
POLYMARKET_DERIVE_API_KEY=true
POLYGON_RPC_URL=https://polygon-rpc.com
```

Signature type 對應：

| Value | 使用情境 |
| --- | --- |
| `EOA` / `0` | 直接用 EOA 交易 |
| `POLY_PROXY` / `1` | Polymarket proxy wallet |
| `POLY_GNOSIS_SAFE` / `2` | Safe wallet |
| `POLY_1271` / `3` | Polymarket deposit wallet |

如果使用 `POLY_PROXY`、`POLY_GNOSIS_SAFE` 或 `POLY_1271`，`POLYMARKET_FUNDER_ADDRESS` 必須填真正持有資金與部位的 wallet address。

## API Endpoints

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

## 下單流程

Market order 請求：

```json
{
  "tokenId": "OUTCOME_TOKEN_ID",
  "side": "BUY",
  "amount": 1,
  "orderType": "FOK"
}
```

流程：

```text
POST /orders/market
-> zod 驗證 request body
-> OrderService 將 side / orderType 轉成 SDK enum
-> SDK 根據 tokenId 解析 market price / tick size / negRisk
-> wallet 簽 order
-> 使用 CLOB API credentials 送出 order
-> 回傳 success / orderId / raw
```

Market order 語意：

- `BUY amount` 代表要花費的 USDC 數量。
- `SELL amount` 代表要賣出的 outcome token shares 數量。
- `tokenId` 是 CLOB outcome token id，不是 slug，也不是 conditionId。
- `orderType` 只能是 `FOK` 或 `FAK`。

## Auth Model

- 建立或 derive API credentials 需要 wallet signing。
- 建立 order 需要 wallet signing。
- post order、cancel order、private order query 使用 CLOB API credentials。
- `GET /health` 不需要 Polymarket auth。

如果 `POLYMARKET_API_KEY`、`POLYMARKET_API_SECRET`、`POLYMARKET_API_PASSPHRASE` 都是空，且 `POLYMARKET_DERIVE_API_KEY=true`，server 會在啟動時自動 derive credentials。

## User Stream 流程

啟用：

```env
POLYMARKET_USER_STREAM_ENABLED=true
POLYMARKET_USER_STREAM_LOG_FILE=logs/user-stream.ndjson
POLYMARKET_USER_STREAM_MARKETS=
```

流程：

```text
server 啟動
-> UserStream 連接 wss://ws-subscriptions-clob.polymarket.com/ws/user
-> 送出 authenticated subscription payload
-> 接收使用者 order / trade events
-> normalize 常用欄位
-> 每筆 event 寫入 logs/user-stream.ndjson
```

Log 格式是 NDJSON，一行一筆 JSON：

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

`raw` 會保留 Polymarket 原始完整事件，之後可以直接存成 JSONB。

查看 log：

```bash
tail -f logs/user-stream.ndjson
```

## Open Orders 同步

啟用：

```env
POLYMARKET_OPEN_ORDERS_SYNC_ENABLED=true
POLYMARKET_OPEN_ORDERS_SYNC_INTERVAL_MS=15000
```

用途：

```text
你在 UI 或其他 bot 下單
-> server 一開始可能不知道該 market 的 conditionId
-> WalletOpenOrdersSync 定時呼叫 getOpenOrders()
-> 從 openOrder.market 取出 conditionId
-> 呼叫 userStream.subscribeMarkets()
-> 既有 WebSocket 送 operation=subscribe
-> 不需要斷線重連
```

這只會發現目前有 open orders 的 markets，不會訂閱所有 markets，也不會查 market info。

## Redeem 流程

啟用：

```env
POLYMARKET_REDEEM_ENABLED=true
```

你的 market-info server 應該先確認市場已 resolved，再呼叫本服務：

```json
{
  "conditionId": "0xCONDITION_ID",
  "negRisk": false,
  "indexSets": [1, 2],
  "waitForReceipt": true
}
```

流程：

```text
外部 market-info server 確認 market resolved
-> POST /redeem
-> RedeemService 根據 negRisk 選標準 adapter 或 neg-risk adapter
-> 如果是 EOA：用 viem 從 EOA 直接送 redeemPositions(...)
-> 如果是 POLY_1271：透過 relayer 從 POLYMARKET_FUNDER_ADDRESS deposit wallet 執行 WALLET batch
-> 回傳 txHash 或 relayer transaction info
```

`POLY_1271` 設定：

```env
POLYMARKET_SIGNATURE_TYPE=POLY_1271
POLYMARKET_FUNDER_ADDRESS=0xDEPOSIT_WALLET
POLYMARKET_RELAYER_URL=https://relayer-v2.polymarket.com
POLYMARKET_REDEEM_RELAYER_DEADLINE_SECONDS=240
```

`POLY_1271` 情境下，owner EOA 負責簽 relayer 的 `DepositWallet` batch，但實際 onchain call 會從持有 outcome tokens 的 deposit wallet 執行。`POLY_PROXY` 和 Safe 的 redeem 執行路徑目前尚未實作。

## negRisk

交易時不要對所有市場硬寫全域 `negRisk`。

SDK 應該根據 `tokenId` 自行解析 `negRisk`。如果 `negRisk` 錯了，order 可能會對錯的 exchange contract 簽名，CLOB 可能回：

```json
{
  "error": "invalid signature"
}
```

redeem 時的 `negRisk` 必須由你的 market metadata server 提供，因為本服務不查 market info。

## Scripts

所有 scripts 預設使用：

```text
BASE_URL=http://localhost:3000
```

健康檢查：

```bash
./scripts/health.sh
```

建立 market order：

```bash
TOKEN_ID=OUTCOME_TOKEN_ID \
SIDE=BUY \
AMOUNT=1 \
ORDER_TYPE=FOK \
./scripts/create_market_order.sh
```

查詢訂單：

```bash
./scripts/get_open_orders.sh
ASSET_ID=OUTCOME_TOKEN_ID ./scripts/get_open_orders.sh
ORDER_ID=ORDER_ID ./scripts/get_order.sh
```

取消訂單：

```bash
ORDER_ID=ORDER_ID ./scripts/cancel_order.sh
ORDER_IDS_JSON='["ORDER_ID_1","ORDER_ID_2"]' ./scripts/cancel_orders.sh
./scripts/cancel_all_orders.sh
```

redeem：

```bash
CONDITION_ID=0xCONDITION_ID \
NEG_RISK=false \
./scripts/redeem.sh
```

指定其他 port：

```bash
BASE_URL=http://localhost:3001 ./scripts/health.sh
```

## Error Shapes

Order error：

```json
{
  "success": false,
  "code": "POLYMARKET_ORDER_FAILED",
  "message": "...",
  "details": {}
}
```

Redeem error：

```json
{
  "success": false,
  "code": "POLYMARKET_REDEEM_FAILED",
  "message": "...",
  "details": {}
}
```

## 工程注意事項

- Market metadata ownership 在外部服務，不在本服務。
- User stream market subscription 使用 `conditionId`。
- CLOB 下單使用 `tokenId` / `asset_id`。
- `logs/user-stream.ndjson` 寫 DB 時建議用 `orderId` / `tradeId` 做 idempotent upsert。
- 如果 WebSocket 有漏事件，應由獨立 sync job 用 CLOB trade history / open orders 做 reconcile。
- `.env` 裡有 private key，絕對不要 commit。
