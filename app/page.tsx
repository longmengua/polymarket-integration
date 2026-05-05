"use client";

import { useEffect, useState } from "react";
import Orderbook from "./components/Orderbook";
import TradePanel from "./components/TradePanel";
import { FetchEventsResponse, Market } from "./lib/polymarket/fetchEvent";

export default function Page() {
  const [events, setEvents] = useState<FetchEventsResponse[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market>();

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => setEvents(data.data || []));
  }, []);

  async function loadMarkets(eventId: string) {
    const data: Market[] = events.find((e) => e.id === eventId)?.markets || [];
    console.log("Loading markets for event", eventId, data);
    setMarkets(data);
  }

  async function loadOrderbook(marketId: string) {
    // const res = await fetch("/api/orderbook?market=" + marketId);
    // console.log("Loading orderbook for market", marketId, res);
    const selectedMarket = markets.find((m) => m.id === marketId);
    console.log("Selected market", selectedMarket);
    setSelectedMarket(selectedMarket);
  }

  return (
    <div className="h-screen bg-[#0f172a] text-white flex">
      {/* LEFT: Events / Markets */}
      <div className="flex-1 border-r border-gray-800 p-3 overflow-auto">
        <h2 className="text-sm text-gray-400 mb-2">Events</h2>

        {events.map((e, i) => (
          <div
            key={e.id}
            className="p-2 hover:bg-gray-800 rounded cursor-pointer text-sm"
            onClick={() => loadMarkets(e.id)}
          >
            {i + 1}. {e.title}
            <br />
            {e.volume && (
              <span className="text-xs text-gray-400">
                Volume: ${e.volume.toLocaleString()}
              </span>
            )}
            <br />
            {e.liquidity && (
              <span className="text-xs text-gray-400">
                Liquidity: ${e.liquidity.toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex-2 overflow-auto">
        <h2 id="markets" className="text-sm text-gray-400 mt-4 mb-2">
          Markets
        </h2>

        {markets.map((m, i) => (
          <div
            key={m.id}
            className={`mb-2 h-17 p-2 rounded cursor-pointer text-sm ${selectedMarket?.id === m.id
              ? "bg-blue-600"
              : "hover:bg-gray-800"
              }`}
            onClick={() => loadOrderbook(m.id)}
          >
            {i + 1}. {m.question}
          </div>
        ))}
      </div>

      <div id="trade-panel" className="w-[320px]">
        {selectedMarket && (
          <>
            <TradePanel market={selectedMarket} />
            {/* <Orderbook market={selectedMarket} /> */}
          </>
        )}
      </div>
    </div>
  );
}