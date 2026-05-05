const GAMMA_API = "https://gamma-api.polymarket.com";

/**
 * 取得 events（市場集合）
 */
export async function getEvents(params: Record<string, any>) {
    const query = new URLSearchParams(params);

    const res = await fetch(`${GAMMA_API}/events?${query.toString()}`);

    if (!res.ok) throw new Error("Failed to fetch events");

    return res.json();
}

/**
 * 取得 markets（單一 event 下的市場）
 */
export async function getMarkets(eventId: string) {
    const res = await fetch(
        `${GAMMA_API}/markets?event_id=${eventId}`
    );

    if (!res.ok) throw new Error("Failed to fetch markets");

    return res.json();
}