const CLOB_API = "https://clob.polymarket.com";


/**
 * 取得單一 market 的 orderbook（原始）
 *
 * ⚠️ 不可 cache（價格是即時的）
 */
export async function fetchOrderBookRaw(marketId: string) {
    const res = await fetch(`${CLOB_API}/book?market=${marketId}`, {
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error("Failed to fetch orderbook");
    }

    return res.json();
}