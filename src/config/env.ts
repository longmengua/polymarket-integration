import "dotenv/config";
import { z } from "zod";

/**
 * =========================================================
 * Signature Type
 * =========================================================
 *
 * Polymarket CLOB 支援多種 signer 類型：
 *
 * 0 = EOA
 * 1 = POLY_PROXY
 * 2 = POLY_GNOSIS_SAFE
 * 3 = POLY_1271
 *
 * 允許：
 * - 文字形式
 * - 數字形式
 *
 * 例如：
 * POLYMARKET_SIGNATURE_TYPE=POLY_1271
 * 或
 * POLYMARKET_SIGNATURE_TYPE=3
 */
const signatureTypeSchema = z
  .union([
    z.literal("EOA"),
    z.literal("POLY_PROXY"),
    z.literal("POLY_GNOSIS_SAFE"),
    z.literal("GNOSIS_SAFE"),
    z.literal("POLY_1271"),
    z.literal("0"),
    z.literal("1"),
    z.literal("2"),
    z.literal("3")
  ])
  .default("POLY_1271");

/**
 * =========================================================
 * Ethereum Address Validator
 * =========================================================
 */
const ethAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a valid ethereum address");

/**
 * =========================================================
 * Boolean Env Transformer
 * =========================================================
 *
 * 支援：
 * true
 * TRUE
 * 1
 * yes
 */
function parseBoolean(value?: string): boolean {
  if (!value) {
    return false;
  }

  return ["true", "1", "yes"].includes(value.toLowerCase());
}

/**
 * =========================================================
 * Environment Schema
 * =========================================================
 */
const envSchema = z.object({
  /**
   * =====================================================
   * Node Environment
   * =====================================================
   */
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(3000),

  HOST: z.string().default("0.0.0.0"),

  LOG_LEVEL: z.string().default("info"),

  /**
   * =====================================================
   * Polymarket API
   * =====================================================
   */
  POLYMARKET_CLOB_HOST: z
    .string()
    .url()
    .default("https://clob.polymarket.com"),

  /**
   * User WebSocket endpoint
   */
  POLYMARKET_WS_USER_URL: z
    .string()
    .url()
    .default("wss://ws-subscriptions-clob.polymarket.com/ws/user"),

  /**
   * Polygon Mainnet = 137
   */
  POLYMARKET_CHAIN_ID: z.coerce.number().int().default(137),

  /**
   * =====================================================
   * Polygon RPC
   * =====================================================
   *
   * viem createWalletClient 必須提供 transport URL。
   *
   * 如果沒填：
   * transport: http()
   *
   * 就會出現：
   * UrlRequiredError
   */
  POLYGON_RPC_URL: z
    .string()
    .url()
    .default("https://polygon-rpc.com"),

  /**
   * =====================================================
   * Wallet Private Key
   * =====================================================
   *
   * 必須：
   * - 0x 開頭
   * - 64 hex chars
   *
   * 正確：
   * 0xabc123...
   */
  POLYMARKET_PRIVATE_KEY: z
    .string()
    .regex(
      /^0x[0-9a-fA-F]{64}$/,
      "must be a 0x-prefixed private key"
    ),

  /**
   * =====================================================
   * Signature Type
   * =====================================================
   */
  POLYMARKET_SIGNATURE_TYPE: signatureTypeSchema,

  /**
   * =====================================================
   * Funder Address
   * =====================================================
   *
   * 真正持有資金的 wallet。
   *
   * EOA 可以不填。
   *
   * POLY_PROXY / POLY_1271 / SAFE
   * 通常需要填。
   */
  POLYMARKET_FUNDER_ADDRESS: ethAddressSchema.optional(),

  /**
   * =====================================================
   * API Key Auto Derive
   * =====================================================
   *
   * true:
   * 啟動時自動 createOrDeriveApiKey()
   */
  POLYMARKET_DERIVE_API_KEY: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined ? true : parseBoolean(value)
    ),

  /**
   * =====================================================
   * Existing API Credentials
   * =====================================================
   */
  POLYMARKET_API_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),

  POLYMARKET_API_SECRET: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),

  POLYMARKET_API_PASSPHRASE: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),

  /**
   * =====================================================
   * Order Defaults
   * =====================================================
   */
  POLYMARKET_DEFAULT_TICK_SIZE: z
    .enum(["0.1", "0.01", "0.001", "0.0001"])
    .default("0.01"),

  /**
   * Negative Risk Market
   */
  POLYMARKET_DEFAULT_NEG_RISK: z
    .string()
    .default("false")
    .transform(parseBoolean),

  /**
   * =====================================================
   * User Stream
   * =====================================================
   */
  POLYMARKET_USER_STREAM_ENABLED: z
    .string()
    .default("true")
    .transform(parseBoolean),

  /**
   * conditionId list
   *
   * comma-separated:
   *
   * xxx,yyy,zzz
   */
  POLYMARKET_USER_STREAM_MARKETS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
        : []
    )
});

/**
 * =========================================================
 * Parse & Validate Env
 * =========================================================
 */
export const env = envSchema.parse(process.env);

/**
 * =========================================================
 * Env Type
 * =========================================================
 */
export type Env = typeof env;

/**
 * =========================================================
 * Signature Type Name
 * =========================================================
 */
export type SignatureTypeName =
  | "EOA"
  | "POLY_PROXY"
  | "POLY_GNOSIS_SAFE"
  | "GNOSIS_SAFE"
  | "POLY_1271"
  | "0"
  | "1"
  | "2"
  | "3";

/**
 * =========================================================
 * Convert Signature Type
 * =========================================================
 *
 * 將 env string 轉成 SDK numeric value。
 */
export function resolveSignatureType(
  value: SignatureTypeName
): 0 | 1 | 2 | 3 {
  const map: Record<SignatureTypeName, 0 | 1 | 2 | 3> = {
    EOA: 0,
    POLY_PROXY: 1,
    POLY_GNOSIS_SAFE: 2,
    GNOSIS_SAFE: 2,
    POLY_1271: 3,
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3
  };

  return map[value];
}

/**
 * =========================================================
 * Runtime Safety Checks
 * =========================================================
 */

/**
 * production 環境避免 accidentally 使用 public RPC
 */
if (
  env.NODE_ENV === "production" &&
  env.POLYGON_RPC_URL.includes("polygon-rpc.com")
) {
  console.warn(
    "[WARN] Using public polygon-rpc.com in production is NOT recommended."
  );
}

/**
 * 非 EOA 時通常需要 funder address。
 */
const signatureType = resolveSignatureType(
  env.POLYMARKET_SIGNATURE_TYPE
);

if (
  signatureType !== 0 &&
  !env.POLYMARKET_FUNDER_ADDRESS
) {
  console.warn(
    "[WARN] Non-EOA signature type detected but POLYMARKET_FUNDER_ADDRESS is missing."
  );
}