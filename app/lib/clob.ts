const CLOB_API = "https://clob.polymarket.com";

/**
 * orderbook（即時行情）
 */
export async function getOrderBook(market: string) {
    const res = await fetch(`${CLOB_API}/book?market=${market}`, {
        cache: "no-store",
    });

    if (!res.ok) throw new Error("Failed orderbook");

    return res.json();
}

/**
 * 查訂單（user level）
 */
export async function getOrders(address: string) {
    const res = await fetch(`${CLOB_API}/orders?user=${address}`);

    if (!res.ok) throw new Error("Failed orders");

    return res.json();
}

/**
 * 下單（limit order）
 *
 * ⚠️ 真實 Polymarket 需要：
 * - wallet signature
 * - order payload signing
 */
export async function placeOrder(payload: any) {
    const res = await fetch(`${CLOB_API}/order`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Order failed");

    return res.json();
}