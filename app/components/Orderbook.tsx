import { useState, useEffect } from "react";
import { Market } from "../lib/polymarket/fetchEvent";

export default function Orderbook({ market }: { market: Market }) {
    const [book, setBook] = useState<any>(null);

    useEffect(() => {
        const i = setInterval(() => {
            fetch(`/api/orderbook?market=${market}`)
                .then((res) => res.json())
                .then((data) => setBook(data.data));
        }, 1000);

        return () => clearInterval(i);
    }, [market]);

    if (!book) return <div className="p-4">Loading...</div>;

    return (
        <div className="p-4">
            <h2 className="mb-2 text-sm text-gray-400">
                Orderbook
            </h2>

            <div className="grid grid-cols-2 gap-2 text-sm">
                {/* Bids */}
                <div>
                    <h3 className="text-green-400 mb-1">Bids</h3>
                    {book.bids?.slice(0, 10).map((b: any, i: number) => (
                        <div
                            key={i}
                            className="flex justify-between text-green-300"
                        >
                            <span>{b.price}</span>
                            <span>{b.size}</span>
                        </div>
                    ))}
                </div>

                {/* Asks */}
                <div>
                    <h3 className="text-red-400 mb-1">Asks</h3>
                    {book.asks?.slice(0, 10).map((a: any, i: number) => (
                        <div
                            key={i}
                            className="flex justify-between text-red-300"
                        >
                            <span>{a.price}</span>
                            <span>{a.size}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}