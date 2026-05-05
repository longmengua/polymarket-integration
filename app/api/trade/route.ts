import { placeOrder } from "@/app/lib/placeOrder";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const body = await req.json();

    const result = await placeOrder(body);

    return NextResponse.json({
        success: true,
        data: result,
    });
}