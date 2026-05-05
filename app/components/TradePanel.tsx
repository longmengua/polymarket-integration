import { useState, useMemo } from "react";
import { Market } from "../lib/polymarket/fetchEvent";

export default function TradePanel({ market }: { market: Market }) {
    const [price, setPrice] = useState("0.5");
    const [size, setSize] = useState("10");
    const [logs, setLogs] = useState<any[]>([]);
    const [outcomes, setOutcomes] = useState<{ name: string; price: string; ratio: number }[]>([]);

    useMemo(() => {
        const outcomes = JSON.parse(market.outcomes);
        const outcomePrices = JSON.parse(market.outcomePrices);
        // 最高買價，你賣出參考
        const bestBid = market.bestBid
        // 最低賣價，你買入參考
        const bestAsk = market.bestAsk

        const combined = outcomes.map((o: string, i: number) => ({
            name: o,
            price: i == 0 ? bestAsk.toString() : bestBid.toString(),
            ratio: outcomePrices[i] * 100 + "%",
        }));

        console.log("Combined outcomes and prices:", combined);
        setOutcomes(combined);
    }, [market.id]);

    async function submit(side: "buy" | "sell") {
        const res = await fetch("/api/trade", {
            method: "POST",
            body: JSON.stringify({
                market,
                side,
                price: Number(price),
                size: Number(size),
            }),
        });

        const data = await res.json();
        setLogs((prev) => [data, ...prev]);
    }

    return (
        <div className="p-4 border-l border-gray-800 h-full flex flex-col">
            <h2 className="text-sm text-gray-400 mb-3">
                Trade
            </h2>

            {/* Inputs */}
            <label className="text-xs text-gray-400 mb-1">價格</label>
            <input
                className="mb-2 p-2 rounded bg-amber-50 text-black"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price"
            />

            <label className="text-xs text-gray-400 mb-1">數量</label>
            <input
                className="mb-3 p-2 rounded  bg-amber-50 text-black"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="Size"
            />

            <div className="flex justify-center items-center">
                <label className="text-xs text-gray-400 mb-1 block">買賣價差：{market.spread}</label>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 mb-4 justify-around">
                <div>
                    <label className="text-xs text-gray-400 mb-1 block">買入參考價：{outcomes[0]?.price || "N/A"}</label>
                    <button
                        className="flex-1 bg-green-600 hover:bg-green-700 p-2 rounded"
                        onClick={() => submit("buy")}
                    >
                        {outcomes[0]?.name} ({outcomes[0]?.ratio || "N/A"})
                    </button>
                </div>

                <div>
                    <label className="text-xs text-gray-400 mb-1 block">賣出參考價：{outcomes[1]?.price || "N/A"}</label>
                    <button
                        className="flex-1 bg-red-600 hover:bg-red-700 p-2 rounded"
                        onClick={() => submit("sell")}
                    >
                        {outcomes[1]?.name} ({outcomes[1]?.ratio || "N/A"})
                    </button>
                </div>
            </div>

            {/* Logs */}
            <div className="flex-1 overflow-auto text-xs bg-black p-2 rounded">
                {logs.map((l, i) => (
                    <pre key={i}>{JSON.stringify(l, null, 2)}</pre>
                ))}
            </div>
        </div>
    );
}