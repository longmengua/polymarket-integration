import EventEmitter from "node:events";
import WebSocket from "ws";
import type { ApiKeyCreds } from "@polymarket/clob-client-v2";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export type UserStreamEventName =
  | "order.created"
  | "order.failed"
  | "order.filled"
  | "order.cancelled"
  | "order.updated";

/**
 * Polymarket authenticated user WebSocket stream。
 *
 * 負責：
 * - 使用 CLOB API credentials 訂閱 user channel
 * - 維持 heartbeat / ping-pong
 * - 斷線後 exponential backoff reconnect
 * - 將原始事件映射成內部 EventEmitter event
 */
export class PolymarketUserStream extends EventEmitter {
  private ws?: WebSocket;
  private reconnectAttempts = 0;
  private heartbeat?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    // CLOB L2 API credentials，用於 user channel auth payload。
    private readonly creds: ApiKeyCreds,
    // user channel 通常以 market conditionId list 作為訂閱 filter。
    private readonly markets: string[]
  ) {
    super();
  }

  /**
   * 啟動 user stream。
   */
  start() {
    this.stopped = false;
    this.connect();
  }

  /**
   * 主動停止 stream。
   *
   * stopped flag 會避免 close event 觸發自動重連。
   */
  stop() {
    this.stopped = true;
    this.clearHeartbeat();
    this.ws?.close();
  }

  /**
   * 建立 WebSocket 連線並註冊 lifecycle handlers。
   */
  private connect() {
    if (this.stopped) {
      return;
    }

    logger.info({ url: env.POLYMARKET_WS_USER_URL, markets: this.markets }, "Connecting user stream");
    this.ws = new WebSocket(env.POLYMARKET_WS_USER_URL);

    this.ws.on("open", () => {
      // 連線成功代表 backoff 可以歸零，下一次斷線重新從 1s 開始。
      this.reconnectAttempts = 0;
      this.subscribe();
      this.startHeartbeat();
      logger.info("Polymarket user stream connected");
    });

    this.ws.on("message", (data) => this.handleMessage(data.toString()));
    this.ws.on("pong", () => logger.debug("Polymarket user stream pong"));
    this.ws.on("error", (error) => {
      logger.error({ err: error }, "Polymarket user stream error");
    });
    this.ws.on("close", (code, reason) => {
      this.clearHeartbeat();
      logger.warn({ code, reason: reason.toString() }, "Polymarket user stream closed");
      this.scheduleReconnect();
    });
  }

  /**
   * 傳送 authenticated user channel subscription payload。
   *
   * auth 欄位來自 ClobClient createApiKey / deriveApiKey 的 credentials。
   */
  private subscribe() {
    const payload = {
      auth: {
        apiKey: this.creds.key,
        secret: this.creds.secret,
        passphrase: this.creds.passphrase
      },
      markets: this.markets,
      type: "user"
    };

    this.ws?.send(JSON.stringify(payload));
  }

  /**
   * Heartbeat 同時送文字 PING 與 WebSocket protocol ping。
   *
   * Polymarket channel 可能回傳文字 PONG；ws server 也可能回 protocol pong。
   */
  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeat = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("PING");
        this.ws.ping();
      }
    }, 10_000);
  }

  /**
   * 清掉 heartbeat interval，避免 reconnect 後產生多個 timer。
   */
  private clearHeartbeat() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
  }

  /**
   * 使用 exponential backoff 重連。
   *
   * delay 最大 30 秒，並加上小幅 jitter 避免多個 instance 同時重連。
   */
  private scheduleReconnect() {
    if (this.stopped) {
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(30_000, 1_000 * 2 ** (this.reconnectAttempts - 1));
    const jitter = Math.floor(Math.random() * 250);

    setTimeout(() => this.connect(), delay + jitter);
  }

  /**
   * 處理 user stream 原始 message。
   *
   * Polymarket 有時會回單一 event，有時可能回 event array，因此兩種都兼容。
   */
  private handleMessage(raw: string) {
    if (raw === "PONG" || raw === "pong") {
      logger.debug("Polymarket user stream heartbeat acknowledged");
      return;
    }

    let event: unknown;
    try {
      event = JSON.parse(raw);
    } catch {
      logger.warn({ raw }, "Received non-JSON Polymarket user stream message");
      return;
    }

    const events = Array.isArray(event) ? event : [event];
    for (const item of events) {
      this.dispatchEvent(item);
    }
  }

  /**
   * 將 Polymarket 原始 event 映射成內部 event name。
   *
   * 原始 payload 格式可能因 order / trade event 有差異，所以這裡以 type/status
   * 做寬鬆判斷，保底歸類為 order.updated。
   */
  private dispatchEvent(event: unknown) {
    const record = event && typeof event === "object" ? (event as Record<string, unknown>) : {};
    const type = String(record.type ?? "").toLowerCase();
    const status = String(record.status ?? record.order_status ?? record.trade_status ?? "").toLowerCase();

    let eventName: UserStreamEventName = "order.updated";

    // trade / filled / matched 類事件視為成交。
    if (type === "trade" || status.includes("filled") || status.includes("matched") || status.includes("confirmed")) {
      eventName = "order.filled";
    } else if (status.includes("cancel")) {
      eventName = "order.cancelled";
    } else if (status.includes("fail") || status.includes("reject")) {
      eventName = "order.failed";
    } else if (type === "order" && (status.includes("live") || status.includes("created") || status.includes("open"))) {
      eventName = "order.created";
    }

    // structured log 保留原始 event，方便之後做審計或排查。
    logger.info({ eventName, event }, "Polymarket user stream event");
    this.emit(eventName, event);
  }
}
