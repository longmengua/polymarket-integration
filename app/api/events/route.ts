import { fetchEventsRaw, FetchEventsResponse } from "@/app/lib/polymarket/fetchEvent";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/events
 *
 * 👉 用來 proxy Polymarket Gamma events API
 * 👉 支援 query params 傳入 filters
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        /**
         * 解析 URL query string
         * e.g. /api/events?tag_slug=xxx&limit=50
         */
        const { searchParams } = new URL(req.url);

        /**
         * 把 query params 轉成 typed object
         * ⚠️ Polymarket API 是 string-based，所以要手動轉型
         */
        // const params = {
        //     tag_slug: searchParams.get("tag_slug") ?? undefined,

        //     active: searchParams.get("active")
        //         ? searchParams.get("active") === "true"
        //         : undefined,

        //     closed: searchParams.get("closed")
        //         ? searchParams.get("closed") === "true"
        //         : undefined,

        //     limit: searchParams.get("limit")
        //         ? Number(searchParams.get("limit"))
        //         : undefined,

        //     order: searchParams.get("order") ?? undefined,

        //     ascending: searchParams.get("ascending")
        //         ? searchParams.get("ascending") === "true"
        //         : undefined,
        // };

        /**
         * 呼叫 internal fetch function
         * 👉 若 params 是空則會 fallback DEFAULT_QUERY
         */
        const data: FetchEventsResponse[] = await fetchEventsRaw();

        /**
         * 回傳統一 API format
         */
        return NextResponse.json({
            success: true,
            data,
        });
    } catch (err: any) {
        /**
         * 錯誤處理（避免 API crash）
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