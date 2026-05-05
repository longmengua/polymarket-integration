import { signOrder } from "./signOrder";

const CLOB_API = "https://clob.polymarket.com";

/**
 * 建立 nonce（簡單版）
 *
 * 👉 之後應該要：
 * - 從 backend / redis 管
 */
function generateNonce() {
    return Date.now();
}

/**
 * 下單（完整流程）
 */
export async function placeOrder(input: {
    market: string;
    side: "buy" | "sell";
    price: number;
    size: number;
}) {
    /**
     * 建立 order payload
     */
    const order = {
        ...input,
        nonce: generateNonce(),
    };

    /**
     * 簽名
     */
    const signature = await signOrder(order);

    /**
     * 傳送到 Polymarket
     */
    const res = await fetch(`${CLOB_API}/order`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            order,
            signature,
        }),
    });

    if (!res.ok) {
        throw new Error("Order failed");
    }

    return res.json();
}