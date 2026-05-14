import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { OrderService, toApiError } from "../polymarket/orderService.js";
import {
  cancelOrdersSchema,
  createMarketOrderSchema,
  openOrdersQuerySchema
} from "../types/order.js";

function parseWith<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  // 所有進入 controller 的 request payload 都先經過 zod parse，
  // 讓 service layer 只處理已驗證、型別正確的資料。
  return schema.parse(value);
}

export async function registerOrderRoutes(app: FastifyInstance<any, any, any, any>, orderService: OrderService) {

  /**
   * 市價單買入、賣出 endpoint。
   *
   * BUY: amount 代表要花費的 USDC 數量。
   * SELL: amount 代表要賣出的 outcome token share 數量。
   * 實際成交由 Polymarket CLOB SDK 以 FOK / FAK market order 流程送出。
   */
  app.post("/orders/market", async (request, reply) => {
    try {
      const body = parseWith(createMarketOrderSchema, request.body);
      return await orderService.createMarketOrder(body);
    } catch (error) {
      // request validation error 回 400；Polymarket API / SDK 錯誤統一轉成 502。
      const statusCode = error instanceof z.ZodError ? 400 : 502;
      return reply.code(statusCode).send(toApiError(error));
    }
  });

  /**
   * 批量取消 orders endpoint，接受 orderIds array。
   *
   * 適合上游服務已持有多個 order id，需要一次送出 cancel request 的情境。
   */
  app.post("/orders/cancel", async (request, reply) => {
    try {
      const body = parseWith(cancelOrdersSchema, request.body);
      return await orderService.cancelOrders(body.orderIds);
    } catch (error) {
      return reply.code(error instanceof z.ZodError ? 400 : 502).send(toApiError(error));
    }
  });

  /**
   * 取消全部 open orders endpoint。
   *
   * 這會直接呼叫 CLOB cancelAll，請只在明確需要清空目前帳戶 open orders 時使用。
   */
  app.delete("/orders", async (_request, reply) => {
    try {
      return await orderService.cancelAll();
    } catch (error) {
      return reply.code(502).send(toApiError(error));
    }
  });

  /**
   * 查詢 open orders endpoint，支援 filter by market 或 asset_id。
   *
   * market 通常是 conditionId；asset_id 是 outcome tokenId。
   * 如果兩者都不帶，SDK 會查詢目前 API credentials 對應帳戶的 open orders。
   */
  app.get("/orders/open", async (request, reply) => {
    try {
      const query = parseWith(openOrdersQuerySchema, request.query);
      return await orderService.getOpenOrders(query);
    } catch (error) {
      return reply.code(error instanceof z.ZodError ? 400 : 502).send(toApiError(error));
    }
  });

  /**
   * 取消單筆訂單 endpoint，接受 orderId path param。
   *
   * orderId 是 Polymarket CLOB order hash / order id。
   */
  app.delete("/orders/:orderId", async (request, reply) => {
    try {
      const params = parseWith(z.object({ orderId: z.string().min(1) }), request.params);
      return await orderService.cancelOrder(params.orderId);
    } catch (error) {
      return reply.code(error instanceof z.ZodError ? 400 : 502).send(toApiError(error));
    }
  });

  /**
   * 查詢單一 order endpoint，回傳 order details。
   *
   * 主要用於下單後以 orderId 輪詢狀態，或人工排查單筆訂單。
   */
  app.get("/orders/:orderId", async (request, reply) => {
    try {
      const params = parseWith(z.object({ orderId: z.string().min(1) }), request.params);
      return await orderService.getOrder(params.orderId);
    } catch (error) {
      return reply.code(error instanceof z.ZodError ? 400 : 502).send(toApiError(error));
    }
  });
}
