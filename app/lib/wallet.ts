import { ethers } from "ethers";

/**
 * 建立 signer（用 private key）
 *
 * ⚠️ 生產環境請用：
 * - env
 * - KMS（AWS / GCP）
 */
export function getSigner() {
    const privateKey = process.env.PRIVATE_KEY!;

    if (!privateKey) {
        throw new Error("Missing PRIVATE_KEY");
    }

    const provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL
    );

    return new ethers.Wallet(privateKey, provider);
}