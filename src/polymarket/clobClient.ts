import {
  type ApiKeyCreds,
  ClobClient,
  SignatureTypeV2
} from "@polymarket/clob-client-v2";
import { createWalletClient, http } from "viem";
import { polygon } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { env, resolveSignatureType } from "../config/env.js";
import { logger } from "../utils/logger.js";

export interface PolymarketClients {
  client: ClobClient;
  creds: ApiKeyCreds;
  signerAddress: string;
}

/**
 * 將 .env 裡面的 signature type 數字轉成 SDK enum。
 *
 * 對應關係：
 * 0 = EOA
 * 1 = POLY_PROXY
 * 2 = POLY_GNOSIS_SAFE
 * 3 = POLY_1271
 */
function enumSignatureType(value: 0 | 1 | 2 | 3): number {
  const signatureTypeValues: Record<0 | 1 | 2 | 3, number> = {
    0: SignatureTypeV2.EOA,
    1: SignatureTypeV2.POLY_PROXY,
    2: SignatureTypeV2.POLY_GNOSIS_SAFE,
    3: SignatureTypeV2.POLY_1271
  };

  return signatureTypeValues[value] ?? value;
}

/**
 * 如果 .env 已經有 Polymarket CLOB API credentials，
 * 就直接使用，不需要每次啟動都重新 derive。
 */
function getEnvApiCreds(): ApiKeyCreds | undefined {
  if (
    !env.POLYMARKET_API_KEY ||
    !env.POLYMARKET_API_SECRET ||
    !env.POLYMARKET_API_PASSPHRASE
  ) {
    return undefined;
  }

  return {
    key: env.POLYMARKET_API_KEY,
    secret: env.POLYMARKET_API_SECRET,
    passphrase: env.POLYMARKET_API_PASSPHRASE
  };
}

/**
 * 建立 Polymarket CLOB client。
 *
 * 這裡會做幾件事：
 * 1. 從 private key 建立 signer account
 * 2. 用 viem createWalletClient 建立 Polygon wallet client
 * 3. 建立 Polymarket ClobClient
 * 4. 如果沒有 API key，就用 signer 自動 derive API credentials
 */
export async function createPolymarketClient(): Promise<PolymarketClients> {
  /**
   * private key 必須是 0x 開頭。
   *
   * 正確：
   * POLYMARKET_PRIVATE_KEY=0xabc...
   *
   * 錯誤：
   * POLYMARKET_PRIVATE_KEY=abc...
   */
  const account = privateKeyToAccount(
    env.POLYMARKET_PRIVATE_KEY as `0x${string}`
  );

  /**
   * 這裡是你剛剛報錯的地方。
   *
   * 原本是：
   * transport: http()
   *
   * 這會導致 viem 不知道要連哪個 Polygon RPC。
   *
   * 所以必須改成：
   * transport: http(env.POLYGON_RPC_URL)
   *
   * .env 需要有：
   * POLYGON_RPC_URL=https://polygon-rpc.com
   */
  const signer = createWalletClient({
    account,
    chain: polygon,
    transport: http(env.POLYGON_RPC_URL)
  });

  /**
   * 將 .env 的 signature type 轉成 SDK 需要的 enum。
   *
   * 你目前使用：
   * POLYMARKET_SIGNATURE_TYPE=POLY_1271
   *
   * resolveSignatureType 會先把它轉成 3，
   * 這裡再轉成 SignatureTypeV2.POLY_1271。
   */
  const signatureType = enumSignatureType(
    resolveSignatureType(env.POLYMARKET_SIGNATURE_TYPE)
  );

  /**
   * Polymarket CLOB client 的基本設定。
   *
   * funderAddress：
   * - EOA 模式通常可以不填
   * - POLY_PROXY / POLY_GNOSIS_SAFE / POLY_1271 通常需要填
   *
   * signer：
   * - 用來簽 order / derive api key
   *
   * funderAddress：
   * - 真正持有 USDC / outcome token 的 wallet
   */
  const baseOptions = {
    host: env.POLYMARKET_CLOB_HOST,
    chain: env.POLYMARKET_CHAIN_ID,
    signer,
    signatureType,
    funderAddress: env.POLYMARKET_FUNDER_ADDRESS,
    throwOnError: true
  };

  /**
   * 先讀取 .env 裡的 API key。
   *
   * 如果沒有填，且 POLYMARKET_DERIVE_API_KEY=true，
   * 就透過 createOrDeriveApiKey 自動產生。
   */
  let creds = getEnvApiCreds();

  if (!creds) {
    if (!env.POLYMARKET_DERIVE_API_KEY) {
      throw new Error(
        "Missing API credentials and POLYMARKET_DERIVE_API_KEY=false"
      );
    }

    logger.info("Deriving Polymarket CLOB API credentials from signer");

    /**
     * 第一次建立 unauthenticated client，
     * 只用來 derive API credentials。
     */
    const unauthenticatedClient = new ClobClient(baseOptions);

    try {
      // 第一次：嘗試建立新的 API key
      creds = await unauthenticatedClient.createApiKey();
    } catch (createError) {
      logger.warn(
        { err: createError },
        "createApiKey failed, trying deriveApiKey instead"
      );

      // 第二次：如果 Polymarket 已經有 key，改用 derive 取回既有 key
      creds = await unauthenticatedClient.deriveApiKey();
    }

    logger.info(creds, "Obtained Polymarket CLOB API credentials");
  }

  /**
   * 第二次建立 authenticated client。
   *
   * 後續下單、取消單、查詢訂單，都應該用這個 client。
   */
  const client = new ClobClient({
    ...baseOptions,
    creds
  });

  logger.info(
    {
      host: env.POLYMARKET_CLOB_HOST,
      chainId: env.POLYMARKET_CHAIN_ID,
      rpcUrl: env.POLYGON_RPC_URL,
      signerAddress: account.address,
      signatureType,
      hasFunderAddress: Boolean(env.POLYMARKET_FUNDER_ADDRESS)
    },
    "Polymarket CLOB client initialized"
  );

  return {
    client,
    creds,
    signerAddress: account.address
  };
}