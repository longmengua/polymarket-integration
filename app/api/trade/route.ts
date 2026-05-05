import { placeOrder } from "@/app/lib/clob";
import { NextResponse } from "next/server";

/**
 * POST /api/trade
 * 👉 統一交易入口
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        /**
         * body:
         * {
         *   market: string,
         *   side: "buy" | "sell",
         *   price: number,
         *   size: number
         * }
         */
        const result = await placeOrder(body);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (e: any) {
        return NextResponse.json(
            {
                success: false,
                error: e.message,
            },
            { status: 500 }
        );
    }
}