import { z } from "zod";

const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a bytes32 hex string");
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be an ethereum address");

/**
 * POST /redeem request schema。
 *
 * conditionId:
 * - 由你的 market-info server 提供。
 * - 必須是已 resolved market 的 conditionId。
 *
 * negRisk:
 * - 由 market metadata 提供。
 * - true 走 NegRiskCtfCollateralAdapter。
 * - false 走 CtfCollateralAdapter。
 *
 * indexSets:
 * - binary market 預設 [1, 2]，代表 YES/NO 兩邊都嘗試 redeem。
 * - CTF redeem 沒有 amount，會 burn 該 condition 下可 redeem 的整個 token balance。
 */
export const redeemSchema = z.object({
  conditionId: bytes32Schema,
  negRisk: z.boolean(),
  indexSets: z.array(z.number().int().positive()).min(1).default([1, 2]),
  collateralToken: addressSchema.optional(),
  adapterAddress: addressSchema.optional(),
  waitForReceipt: z.boolean().default(true)
});

export type RedeemRequest = z.infer<typeof redeemSchema>;
