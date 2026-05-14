import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RedeemService, toRedeemApiError } from "../polymarket/redeemService.js";
import { redeemSchema } from "../types/redeem.js";

function parseWith<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  return schema.parse(value);
}

export async function registerRedeemRoutes(app: FastifyInstance<any, any, any, any>, redeemService: RedeemService) {
  /**
   * 由外部 market-info server 觸發的 redeem endpoint。
   *
   * 本 server 不查 market resolved 狀態；呼叫方必須先確認 market 已完成 resolution。
   */
  app.post("/redeem", async (request, reply) => {
    try {
      const body = parseWith(redeemSchema, request.body);
      return await redeemService.redeem(body);
    } catch (error) {
      return reply.code(error instanceof z.ZodError ? 400 : 502).send(toRedeemApiError(error));
    }
  });
}
