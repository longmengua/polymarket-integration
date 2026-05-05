import { getSigner } from "./wallet";

/**
 * Polymarket Order Typed Data
 *
 * ⚠️ domain / types 需要對齊官方 spec
 */
const domain = {
    name: "Polymarket",
    version: "1",
    chainId: 137, // Polygon
    verifyingContract: "0x0000000000000000000000000000000000000000", // ⚠️ 要換官方
};

const types = {
    Order: [
        { name: "market", type: "string" },
        { name: "price", type: "uint256" },
        { name: "size", type: "uint256" },
        { name: "side", type: "string" },
        { name: "nonce", type: "uint256" },
    ],
};

/**
 * 簽名 order
 */
export async function signOrder(order: any) {
    const signer = getSigner();

    const signature = await signer.signTypedData(
        domain,
        types,
        order
    );

    return signature;
}