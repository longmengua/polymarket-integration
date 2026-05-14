import {
  encodeFunctionData,
  createPublicClient,
  createWalletClient,
  http,
  zeroHash,
  type Address,
  type Hash,
  type Hex
} from "viem";
import { polygon } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { RelayClient, type DepositWalletCall } from "@polymarket/builder-relayer-client";
import { BuilderConfig, type BuilderApiKeyCreds } from "@polymarket/builder-signing-sdk";
import { env, resolveSignatureType } from "../config/env.js";
import type { RedeemRequest } from "../types/redeem.js";
import { logger } from "../utils/logger.js";

const redeemAdapterAbi = [
  {
    type: "function",
    name: "redeemPositions",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "parentCollectionId", type: "bytes32" },
      { name: "conditionId", type: "bytes32" },
      { name: "indexSets", type: "uint256[]" }
    ],
    outputs: []
  }
] as const;

export interface RedeemResult {
  success: true;
  txHash?: Hash;
  relayerTransactionId?: string;
  relayerState?: string;
  receipt?: unknown;
  relayerResult?: unknown;
  adapterAddress: Address;
  collateralToken: Address;
  conditionId: Hex;
  indexSets: number[];
  negRisk: boolean;
  executionMode: "EOA_DIRECT" | "POLY_1271_RELAYER";
}

export interface RedeemApiError {
  success: false;
  code: "POLYMARKET_REDEEM_FAILED";
  message: string;
  details: unknown;
}

export class PolymarketRedeemError extends Error {
  constructor(
    message: string,
    public readonly details: unknown = {}
  ) {
    super(message);
    this.name = "PolymarketRedeemError";
  }
}

export function toRedeemApiError(error: unknown): RedeemApiError {
  if (error instanceof PolymarketRedeemError) {
    return {
      success: false,
      code: "POLYMARKET_REDEEM_FAILED",
      message: error.message,
      details: error.details
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      code: "POLYMARKET_REDEEM_FAILED",
      message: error.message,
      details: { cause: error.cause }
    };
  }

  return {
    success: false,
    code: "POLYMARKET_REDEEM_FAILED",
    message: "Unknown redeem error",
    details: error ?? {}
  };
}

/**
 * Polymarket resolved market redeem service。
 *
 * 這個 service 不查 market info，也不判斷 resolved 狀態。
 * 你的 market-info server 應該先確認 market.resolved=true，再呼叫 /redeem。
 */
export class RedeemService {
  private readonly account = privateKeyToAccount(env.POLYMARKET_PRIVATE_KEY as `0x${string}`);
  private readonly walletClient = createWalletClient({
    account: this.account,
    chain: polygon,
    transport: http(env.POLYGON_RPC_URL)
  });
  private readonly publicClient = createPublicClient({
    chain: polygon,
    transport: http(env.POLYGON_RPC_URL)
  });
  private readonly relayerClient = new RelayClient(
    env.POLYMARKET_RELAYER_URL,
    env.POLYMARKET_CHAIN_ID,
    this.walletClient,
    getBuilderConfig() as ConstructorParameters<typeof RelayClient>[3]
  );

  /**
   * direct redeem 只能 redeem transaction sender 持有的 CTF token。
   *
   * 如果你的持倉在 Polymarket proxy/safe wallet，而 private key 是 owner EOA，
   * 直接從 EOA 發 tx 不能 burn deposit/proxy wallet 裡的 ERC1155 tokens。
   *
   * POLY_1271 deposit wallet 會走 relayer WALLET batch，不走這個 direct path。
   */
  private assertDirectRedeemSupported() {
    const signatureType = resolveSignatureType(env.POLYMARKET_SIGNATURE_TYPE);
    const funder = env.POLYMARKET_FUNDER_ADDRESS?.toLowerCase();
    const signer = this.account.address.toLowerCase();

    if (signatureType !== 0 && funder && funder !== signer) {
      throw new PolymarketRedeemError(
        "Direct auto redeem is only supported when the signer EOA holds the outcome tokens. For POLY_PROXY / SAFE funder wallets, route redeem through that wallet or a relayer.",
        {
          signatureType: env.POLYMARKET_SIGNATURE_TYPE,
          signerAddress: this.account.address,
          funderAddress: env.POLYMARKET_FUNDER_ADDRESS
        }
      );
    }
  }

  async redeem(body: RedeemRequest): Promise<RedeemResult> {
    if (!env.POLYMARKET_REDEEM_ENABLED) {
      throw new PolymarketRedeemError("Redeem API is disabled", {
        env: "POLYMARKET_REDEEM_ENABLED"
      });
    }

    const adapterAddress = (body.adapterAddress ??
      (body.negRisk ? env.POLYMARKET_NEG_RISK_CTF_COLLATERAL_ADAPTER : env.POLYMARKET_CTF_COLLATERAL_ADAPTER)) as Address;
    const collateralToken = (body.collateralToken ?? env.POLYMARKET_PUSD_COLLATERAL_TOKEN) as Address;
    const signatureType = resolveSignatureType(env.POLYMARKET_SIGNATURE_TYPE);

    if (signatureType === 3) {
      return this.redeemWithDepositWalletRelayer(body, adapterAddress, collateralToken);
    }

    this.assertDirectRedeemSupported();
    return this.redeemDirectEoa(body, adapterAddress, collateralToken);
  }

  private createRedeemCalldata(body: RedeemRequest, collateralToken: Address) {
    return encodeFunctionData({
      abi: redeemAdapterAbi,
      functionName: "redeemPositions",
      args: [collateralToken, zeroHash, body.conditionId as Hex, BigIntArray(body.indexSets)]
    });
  }

  private async redeemDirectEoa(
    body: RedeemRequest,
    adapterAddress: Address,
    collateralToken: Address
  ): Promise<RedeemResult> {
    logger.info(
      {
        adapterAddress,
        collateralToken,
        conditionId: body.conditionId,
        indexSets: body.indexSets,
        negRisk: body.negRisk,
        sender: this.account.address
      },
      "Submitting Polymarket redeem transaction"
    );

    const txHash = await this.walletClient.writeContract({
      address: adapterAddress,
      abi: redeemAdapterAbi,
      functionName: "redeemPositions",
      args: [collateralToken, zeroHash, body.conditionId as Hex, BigIntArray(body.indexSets)]
    });

    const receipt = body.waitForReceipt
      ? await this.publicClient.waitForTransactionReceipt({ hash: txHash })
      : undefined;

    return {
      success: true,
      txHash,
      receipt: receipt ? toJsonSafe(receipt) : undefined,
      adapterAddress,
      collateralToken,
      conditionId: body.conditionId as Hex,
      indexSets: body.indexSets,
      negRisk: body.negRisk,
      executionMode: "EOA_DIRECT"
    };
  }

  private async redeemWithDepositWalletRelayer(
    body: RedeemRequest,
    adapterAddress: Address,
    collateralToken: Address
  ): Promise<RedeemResult> {
    if (!env.POLYMARKET_FUNDER_ADDRESS) {
      throw new PolymarketRedeemError("POLY_1271 redeem requires POLYMARKET_FUNDER_ADDRESS", {
        env: "POLYMARKET_FUNDER_ADDRESS"
      });
    }

    const call: DepositWalletCall = {
      target: adapterAddress,
      value: "0",
      data: this.createRedeemCalldata(body, collateralToken)
    };
    const deadline = Math.floor(Date.now() / 1000 + env.POLYMARKET_REDEEM_RELAYER_DEADLINE_SECONDS).toString();

    logger.info(
      {
        adapterAddress,
        collateralToken,
        conditionId: body.conditionId,
        indexSets: body.indexSets,
        negRisk: body.negRisk,
        depositWallet: env.POLYMARKET_FUNDER_ADDRESS,
        relayerUrl: env.POLYMARKET_RELAYER_URL
      },
      "Submitting POLY_1271 deposit wallet redeem through relayer"
    );

    const response = await this.relayerClient.executeDepositWalletBatch(
      [call],
      env.POLYMARKET_FUNDER_ADDRESS,
      deadline
    );
    const relayerResult = body.waitForReceipt ? await response.wait() : undefined;

    return {
      success: true,
      txHash: (relayerResult?.transactionHash || response.transactionHash || response.hash || undefined) as Hash | undefined,
      relayerTransactionId: response.transactionID,
      relayerState: response.state,
      relayerResult: relayerResult ? toJsonSafe(relayerResult) : undefined,
      adapterAddress,
      collateralToken,
      conditionId: body.conditionId as Hex,
      indexSets: body.indexSets,
      negRisk: body.negRisk,
      executionMode: "POLY_1271_RELAYER"
    };
  }
}

function BigIntArray(values: number[]) {
  return values.map((value) => BigInt(value));
}

function toJsonSafe(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item))
  ) as unknown;
}

function getBuilderConfig() {
  if (
    !env.POLYMARKET_BUILDER_API_KEY ||
    !env.POLYMARKET_BUILDER_API_SECRET ||
    !env.POLYMARKET_BUILDER_API_PASSPHRASE
  ) {
    return undefined;
  }

  const creds: BuilderApiKeyCreds = {
    key: env.POLYMARKET_BUILDER_API_KEY,
    secret: env.POLYMARKET_BUILDER_API_SECRET,
    passphrase: env.POLYMARKET_BUILDER_API_PASSPHRASE
  };

  return new BuilderConfig({
    localBuilderCreds: creds
  });
}
