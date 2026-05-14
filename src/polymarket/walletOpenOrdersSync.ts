import type { ClobClient, OpenOrder } from "@polymarket/clob-client-v2";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { PolymarketUserStream } from "./userStream.js";

/**
 * 定時讀取目前帳戶 open orders，從回傳資料中抓出 market/conditionId，
 * 再動態加入 user WebSocket subscription。
 *
 * 目的：
 * - 如果你在 Polymarket UI 或其他 bot 下單，server 可以透過 open orders 掃描發現新 market。
 * - 發現新 market 後不重連 WS，直接走 dynamic subscribe。
 */
export class WalletOpenOrdersSync {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly client: ClobClient,
    private readonly userStream: PolymarketUserStream,
    private readonly intervalMs = env.POLYMARKET_OPEN_ORDERS_SYNC_INTERVAL_MS
  ) {}

  start() {
    this.stop();
    void this.syncOnce();
    this.timer = setInterval(() => {
      void this.syncOnce();
    }, this.intervalMs);

    logger.info({ intervalMs: this.intervalMs }, "Wallet open orders sync started");
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private extractMarkets(openOrders: OpenOrder[]): string[] {
    const markets = new Set<string>();

    for (const order of openOrders) {
      if (order.market) {
        markets.add(order.market);
      }
    }

    return [...markets];
  }

  private async syncOnce() {
    if (this.running) {
      logger.debug("Wallet open orders sync skipped because previous run is still active");
      return;
    }

    this.running = true;
    try {
      const openOrders = await this.client.getOpenOrders();
      const markets = this.extractMarkets(openOrders);
      const addedMarkets = this.userStream.subscribeMarkets(markets);

      logger.info(
        {
          openOrderCount: openOrders.length,
          discoveredMarketCount: markets.length,
          addedMarketCount: addedMarkets.length,
          addedMarkets
        },
        "Wallet open orders sync completed"
      );
    } catch (error) {
      logger.error({ err: error }, "Wallet open orders sync failed");
    } finally {
      this.running = false;
    }
  }
}
