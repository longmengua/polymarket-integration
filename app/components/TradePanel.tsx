import { useState, useMemo, useEffect } from "react";
import { Market } from "../lib/polymarket/fetchEvent";

export default function TradePanel({ market }: { market: Market }) {
    const [price, setPrice] = useState("");
    const [size, setSize] = useState("1");
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    function safeParse(val: any) {
        try {
            return Array.isArray(val) ? val : JSON.parse(val || "[]");
        } catch {
            return [];
        }
    }

    const outcomes = useMemo(() => {
        const outs = safeParse(market.outcomes);
        const prices = safeParse(market.outcomePrices);
        const tokenIds = safeParse(market.clobTokenIds);

        return outs.map((o: string, i: number) => ({
            name: o,
            ratio: (Number(prices[i]) * 100).toFixed(1) + "%",
            token_id: tokenIds?.[i],
        }));
    }, [market]);

    useEffect(() => {
        if (market.bestAsk) {
            setPrice(String(market.bestAsk));
        }
    }, [market.bestAsk]);

    async function submit(action: "BUY" | "SELL", token_id: string) {
        if (!token_id || loading) return;

        setLoading(true);

        const refPrice =
            price !== ""
                ? Number(price)
                : action === "BUY"
                    ? Number(market.bestAsk)
                    : Number(market.bestBid);

        const payload = {
            token_id,
            side: action,
            price: refPrice,
            size: Number(size),
        };

        try {
            // ✅ 改成走 Next API（避免 CORS + 403）
            const res = await fetch("/api/trade", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const result = await res.json();

            setLogs((prev) => [
                {
                    success: true,
                    result,
                    meta: payload,
                },
                ...prev,
            ]);

            setPrice(refPrice.toString());
        } catch (err: any) {
            setLogs((prev) => [
                {
                    success: false,
                    error: err.message || String(err),
                    meta: payload,
                },
                ...prev,
            ]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-4 border-l border-gray-800 h-full flex flex-col">
            <h2 className="text-sm text-gray-400 mb-3">Trade</h2>

            <label className="text-xs text-gray-400 mb-1">價格</label>
            <input
                className="mb-2 p-2 rounded bg-amber-50 text-black"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
            />

            <label className="text-xs text-gray-400 mb-1">數量</label>
            <input
                className="mb-3 p-2 rounded bg-amber-50 text-black"
                value={size}
                onChange={(e) => setSize(e.target.value)}
            />

            <div className="text-center text-xs text-gray-400 mb-2">
                Spread: {market.spread}
            </div>

            <div className="flex gap-2 mb-4">

                <button
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 p-2 rounded disabled:opacity-50"
                    onClick={() =>
                        submit("BUY", outcomes[0]?.token_id)
                    }
                >
                    <div className="text-xs">{market.bestAsk}</div>
                    BUY YES {outcomes[0]?.ratio}
                </button>

                <button
                    disabled={loading}
                    className="flex-1 bg-red-600 hover:bg-red-700 p-2 rounded disabled:opacity-50"
                    onClick={() =>
                        submit("SELL", outcomes[0]?.token_id)
                    }
                >
                    <div className="text-xs">{market.bestBid}</div>
                    SELL YES {outcomes[0]?.ratio}
                </button>
            </div>

            <div className="flex-1 overflow-auto text-xs bg-black p-2 rounded">
                {logs.map((l, i) => (
                    <pre key={i}>{JSON.stringify(l, null, 2)}</pre>
                ))}
            </div>
        </div>
    );
}