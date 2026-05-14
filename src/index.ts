import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { createPolymarketClient } from "./polymarket/clobClient.js";
import { OrderService } from "./polymarket/orderService.js";
import { RedeemService } from "./polymarket/redeemService.js";
import { PolymarketUserStream } from "./polymarket/userStream.js";
import { WalletOpenOrdersSync } from "./polymarket/walletOpenOrdersSync.js";
import { registerRedeemRoutes } from "./routes/redeemRoutes.js";
import { registerOrderRoutes } from "./routes/orderRoutes.js";
import { logger } from "./utils/logger.js";

/**
 * Application entrypoint。
 *
 * 啟動順序：
 * 1. 建立 Polymarket CLOB client
 * 2. 建立 order service
 * 3. 建立 Fastify app 並註冊 routes
 * 4. 視 env 設定啟動 user WebSocket stream
 * 5. listen HTTP port
 */
async function main() {
  // 初始化 CLOB client 時會同時處理 signer、signatureType、funder、API credentials。
  const polymarket = await createPolymarketClient();

  // service layer 封裝所有 CLOB order 操作，routes 不直接碰 SDK。
  const orderService = new OrderService(polymarket.client);
  const redeemService = new RedeemService();

  // 使用同一個 pino logger，讓 HTTP request log 與 app log 格式一致。
  const app = Fastify({ loggerInstance: logger });

  // 目前 server 預設不對 browser 開放跨域；如需前端直連再調整 origin。
  await app.register(cors, { origin: false });

  /**
   * 健康檢查 endpoint。
   *
   * signerAddress 用來確認目前服務實際載入的是哪個 wallet。
   */
  app.get("/health", async () => ({
    success: true,
    signerAddress: polymarket.signerAddress
  }));

  // 註冊所有 order HTTP routes。
  await registerOrderRoutes(app, orderService);
  await registerRedeemRoutes(app, redeemService);

  let userStream: PolymarketUserStream | undefined;
  let openOrdersSync: WalletOpenOrdersSync | undefined;

  // user stream 是背景監聽，不影響 HTTP API route 註冊。
  if (env.POLYMARKET_USER_STREAM_ENABLED) {
    userStream = new PolymarketUserStream(polymarket.creds, env.POLYMARKET_USER_STREAM_MARKETS);
    userStream.start();

    if (env.POLYMARKET_OPEN_ORDERS_SYNC_ENABLED) {
      openOrdersSync = new WalletOpenOrdersSync(polymarket.client, userStream);
      openOrdersSync.start();
    }
  }

  /**
   * 優雅關閉。
   *
   * 先停止 WebSocket stream，再關閉 Fastify，避免 process 直接退出造成連線中斷。
   */
  const shutdown = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Shutting down");
    openOrdersSync?.stop();
    userStream?.stop();
    await app.close();
    process.exit(0);
  };

  // Docker / terminal stop 通常會送 SIGTERM 或 SIGINT。
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // 啟動前印出實際註冊的 route tree，方便確認目前 process 跑的是這份程式。
  logger.info({ cwd: process.cwd(), routes: app.printRoutes() }, "Fastify routes registered");

  // 開始對外提供 HTTP API。
  const address = await app.listen({ host: env.HOST, port: env.PORT });
  logger.info({ address, cwd: process.cwd() }, "Server listening");
}

// 最外層 catch，避免啟動失敗時 silent exit。
main().catch((error) => {
  logger.fatal({ err: error }, "Server failed to start");
  process.exit(1);
});
