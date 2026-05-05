const CLOB_API = "https://clob.polymarket.com";

/**
 * 查詢某 wallet 的訂單
 */
export async function getOrders(address: string) {
    const res = await fetch(
        `${CLOB_API}/orders?user=${address}`
    );

    if (!res.ok) {
        throw new Error("Failed to fetch orders");
    }

    return res.json();
}