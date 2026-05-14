import { z } from "zod";

/**
 * CLOB 下單方向。
 *
 * BUY:
 * - 買入 outcome token shares
 *
 * SELL:
 * - 賣出 outcome token shares
 */
export const sideSchema = z.enum(["BUY", "SELL"]);

/**
 * 一般限價單可接受的 order type。
 *
 * GTC: Good Till Cancelled，直到成交或取消。
 * GTD: Good Till Date，需要提供 expiration。
 * FOK: Fill Or Kill，要嘛全成交，要嘛不成交。
 * FAK: Fill And Kill，允許部分成交，剩餘取消。
 */
export const limitOrderTypeSchema = z.enum(["GTC", "GTD", "FOK", "FAK"]);

/**
 * 市價單只允許 FOK / FAK。
 *
 * Polymarket CLOB 的市價單本質上是 SDK 幫你建立可成交的 marketable order。
 */
export const marketOrderTypeSchema = z.enum(["FOK", "FAK"]);

/**
 * POST /orders request schema。
 *
 * tokenId:
 * - outcome token id，不是 market slug，也不是 conditionId。
 *
 * price:
 * - CLOB price，需大於 0 且不超過 1。
 *
 * size:
 * - outcome token share 數量。
 */
export const createOrderSchema = z
  .object({
    tokenId: z.string().min(1),
    side: sideSchema,
    price: z.number().positive().max(1),
    size: z.number().positive(),
    orderType: limitOrderTypeSchema.default("GTC"),
    expiration: z.number().int().positive().optional()
  })
  .refine((body) => body.orderType !== "GTD" || body.expiration !== undefined, {
    // GTD 單沒有 expiration 就無法知道何時失效，因此在 controller 入口直接擋掉。
    message: "expiration is required when orderType is GTD",
    path: ["expiration"]
  });

/**
 * POST /orders/market request schema。
 *
 * BUY amount:
 * - 要花費的 USDC 數量。
 *
 * SELL amount:
 * - 要賣出的 outcome token share 數量。
 */
export const createMarketOrderSchema = z.object({
  tokenId: z.string().min(1),
  side: sideSchema,
  amount: z.number().positive(),
  orderType: marketOrderTypeSchema.default("FOK")
});

/**
 * POST /orders/cancel request schema。
 *
 * max(100) 避免單次請求過大，也方便上游服務分批取消。
 */
export const cancelOrdersSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(100)
});

/**
 * GET /orders/open query schema。
 *
 * market:
 * - 通常是 conditionId。
 *
 * asset_id:
 * - outcome tokenId。
 */
export const openOrdersQuerySchema = z.object({
  market: z.string().min(1).optional(),
  asset_id: z.string().min(1).optional()
});

/**
 * 從 zod schema 推導 request TypeScript types。
 *
 * 這樣 controller 和 service 不需要手寫重複 interface。
 */
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
export type CreateMarketOrderRequest = z.infer<typeof createMarketOrderSchema>;
export type CancelOrdersRequest = z.infer<typeof cancelOrdersSchema>;
