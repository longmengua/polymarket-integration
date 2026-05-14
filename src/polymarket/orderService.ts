import { OrderType, Side, type ClobClient } from "@polymarket/clob-client-v2";
import { env } from "../config/env.js";
import type { CreateMarketOrderRequest, CreateOrderRequest } from "../types/order.js";

/**
 * 所有 Polymarket API / SDK 錯誤最後都轉成這個 response shape。
 *
 * controller 不直接回傳 SDK 原始錯誤，避免對外暴露不穩定的 error format。
 */
export interface ApiErrorResponse {
  success: false;
  code: "POLYMARKET_ORDER_FAILED";
  message: string;
  details: unknown;
}

/**
 * 包裝 Polymarket SDK 錯誤。
 *
 * details 保留 status / data / cause，方便 log 或 debug API 回應。
 */
export class PolymarketOrderError extends Error {
  public readonly details: unknown;

  constructor(message: string, details: unknown) {
    super(message);
    this.name = "PolymarketOrderError";
    this.details = details;
  }
}

/**
 * 將 HTTP request body 的 BUY / SELL 轉成 SDK enum。
 */
function sdkSide(side: CreateOrderRequest["side"]) {
  return side === "BUY" ? Side.BUY : Side.SELL;
}

/**
 * 將 request body 的 orderType 字串轉成 SDK OrderType enum。
 */
function sdkOrderType(
  orderType: CreateOrderRequest["orderType"] | CreateMarketOrderRequest["orderType"]
): OrderType {
  return OrderType[orderType as keyof typeof OrderType];
}

/**
 * SDK 的 createAndPostMarketOrder 型別只接受 FOK / FAK。
 *
 * 這個 helper 讓 TypeScript 知道 market order 不會傳入 GTC / GTD。
 */
function sdkMarketOrderType(orderType: CreateMarketOrderRequest["orderType"]): OrderType.FOK | OrderType.FAK {
  return orderType === "FOK" ? OrderType.FOK : OrderType.FAK;
}

/**
 * SDK 不同 API 回應可能使用 orderID / orderId / id。
 *
 * 這裡做一層兼容，讓 HTTP 成功回應固定帶 orderId。
 */
function extractOrderId(response: unknown): string | undefined {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const record = response as Record<string, unknown>;
  return (record.orderID ?? record.orderId ?? record.id) as string | undefined;
}

/**
 * 將任意 throw 出來的錯誤轉成 PolymarketOrderError。
 *
 * never 代表這個 function 一定會 throw，不會正常 return。
 */
function wrapPolymarketError(error: unknown): never {
  if (error instanceof Error) {
    const details =
      "data" in error || "status" in error
        ? {
            status: (error as { status?: unknown }).status,
            data: (error as { data?: unknown }).data,
            cause: (error as { cause?: unknown }).cause
          }
        : { cause: error.cause };

    throw new PolymarketOrderError(error.message, details);
  }

  throw new PolymarketOrderError("Polymarket API request failed", error);
}

/**
 * controller catch 到錯誤後呼叫這裡，統一輸出 API error response。
 */
export function toApiError(error: unknown): ApiErrorResponse {
  if (error instanceof PolymarketOrderError) {
    return {
      success: false,
      code: "POLYMARKET_ORDER_FAILED",
      message: error.message,
      details: error.details ?? {}
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      code: "POLYMARKET_ORDER_FAILED",
      message: error.message,
      details: {}
    };
  }

  return {
    success: false,
    code: "POLYMARKET_ORDER_FAILED",
    message: "Unknown Polymarket order error",
    details: error ?? {}
  };
}

/**
 * 封裝所有 Polymarket CLOB order 操作。
 *
 * route/controller 只負責 HTTP request/response；
 * 這個 service 負責把已驗證 request 轉成 SDK calls。
 */
export class OrderService {
  constructor(private readonly client: ClobClient) {}

  /**
   * 建立一般限價單。
   *
   * 注意：
   * @polymarket/clob-client-v2 的 createAndPostOrder 型別只允許 GTC / GTD，
   * 但 postOrder 可接受通用 OrderType。
   *
   * 因此這裡先 createOrder 簽名，再 postOrder 指定 GTC / GTD / FOK / FAK。
   */
  async createLimitOrder(body: CreateOrderRequest) {
    try {
      const signedOrder = await this.client.createOrder(
        {
          tokenID: body.tokenId,
          price: body.price,
          side: sdkSide(body.side),
          size: body.size,
          expiration: body.expiration
        },
        {
          // tickSize / negRisk 原本應該來自 market metadata；此 server 由 env 提供預設值。
          tickSize: env.POLYMARKET_DEFAULT_TICK_SIZE,
          negRisk: env.POLYMARKET_DEFAULT_NEG_RISK
        }
      );

      // signedOrder 已包含 CLOB 所需簽名，postOrder 負責送到 Polymarket API。
      const raw = await this.client.postOrder(signedOrder, sdkOrderType(body.orderType));

      return {
        success: true as const,
        orderId: extractOrderId(raw),
        raw
      };
    } catch (error) {
      wrapPolymarketError(error);
    }
  }

  /**
   * 建立市價單。
   *
   * SDK 會依 tokenId / side / amount 計算 marketable order，
   * 最終仍透過 CLOB 下單流程送出。
   */
  async createMarketOrder(body: CreateMarketOrderRequest) {
    try {
      const raw = await this.client.createAndPostMarketOrder(
        {
          tokenID: body.tokenId,
          amount: body.amount,
          side: sdkSide(body.side),
          orderType: sdkMarketOrderType(body.orderType)
        },
        {
          // 市價單同樣需要 market tickSize / negRisk，這裡沿用 env 預設。
          tickSize: env.POLYMARKET_DEFAULT_TICK_SIZE,
          negRisk: env.POLYMARKET_DEFAULT_NEG_RISK
        },
        sdkMarketOrderType(body.orderType)
      );

      return {
        success: true as const,
        orderId: extractOrderId(raw),
        raw
      };
    } catch (error) {
      wrapPolymarketError(error);
    }
  }

  /**
   * 取消單筆訂單。
   *
   * SDK v2 的 cancelOrder 需要 { orderID } payload，而不是直接傳 string。
   */
  async cancelOrder(orderId: string) {
    try {
      return await this.client.cancelOrder({ orderID: orderId });
    } catch (error) {
      wrapPolymarketError(error);
    }
  }

  /**
   * 批量取消訂單。
   */
  async cancelOrders(orderIds: string[]) {
    try {
      return await this.client.cancelOrders(orderIds);
    } catch (error) {
      wrapPolymarketError(error);
    }
  }

  /**
   * 取消目前 credentials 對應帳戶的全部 open orders。
   */
  async cancelAll() {
    try {
      return await this.client.cancelAll();
    } catch (error) {
      wrapPolymarketError(error);
    }
  }

  /**
   * 查詢單筆訂單狀態。
   */
  async getOrder(orderId: string) {
    try {
      return await this.client.getOrder(orderId);
    } catch (error) {
      wrapPolymarketError(error);
    }
  }

  /**
   * 查詢 open orders。
   *
   * params 可包含：
   * - market: conditionId
   * - asset_id: outcome tokenId
   */
  async getOpenOrders(params: { market?: string; asset_id?: string }) {
    try {
      return await this.client.getOpenOrders(params);
    } catch (error) {
      wrapPolymarketError(error);
    }
  }
}
