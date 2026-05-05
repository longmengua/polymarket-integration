import { fetchOrderBookRaw } from "@/app/lib/polymarket/fetchOrderBook";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/orderbook?market=xxx
 *
 * 👉 取得單一 market orderbook
 * 👉 這是 real-time data，所以不能 cache
 */
export async function GET(req: NextRequest) {
    try {
        /**
         * 解析 query string
         */
        const { searchParams } = new URL(req.url);

        const marketId = searchParams.get("market");

        /**
         * 必填參數檢查
         */
        if (!marketId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "market is required",
                },
                { status: 400 }
            );
        }

        /**
         * 呼叫 Polymarket CLOB API
         */
        const data = await fetchOrderBookRaw(marketId);

        /**
         * 回傳結果
         */
        return NextResponse.json({
            success: true,
            data,
        });
    } catch (err: any) {
        /**
         * error handler
         */
        return NextResponse.json(
            {
                success: false,
                error: err?.message ?? "Unknown error",
            },
            { status: 500 }
        );
    }
}