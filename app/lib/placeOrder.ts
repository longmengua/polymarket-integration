import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const API_KEY = "019dfcc9-934c-78a5-a360-37316bad7881";
const API_SECRET = "Hq5sDwTTB1IAYSTNZfhc97c5SXNh6tN_5PDNWuaOv9A=";
const API_PASSPHRASE = "27e761c7938a00ff185e3c0d17145497944bda1659f0ba8727dc8e2ce3bb05eb";

const BASE_URL = "https://relayer-api.polymarket.com";

function signRequest(
    method: string,
    requestPath: string,
    body: string,
    timestamp: string
) {
    const prehash = `${timestamp}${method}${requestPath}${body}`;

    return crypto
        .createHmac("sha256", API_SECRET)
        .update(prehash)
        .digest("base64");
}

export async function placeOrder(req: NextRequest) {
    try {
        const input = await req.json();

        const order = {
            market: input.market,
            price: input.price,
            size: input.size,
            side: input.side, // "BUY" | "SELL"
            orderType: "GTC",
        };

        const requestPath = "/v1/orders";
        const method = "POST";
        const timestamp = Date.now().toString();
        const bodyString = JSON.stringify(order);

        const signature = signRequest(method, requestPath, bodyString, timestamp);

        const res = await fetch(`${BASE_URL}${requestPath}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                "PM-API-KEY": API_KEY,
                "PM-API-SIGNATURE": signature,
                "PM-API-TIMESTAMP": timestamp,
                "PM-API-PASSPHRASE": API_PASSPHRASE,
            },
            body: bodyString,
        });

        const data = await res.json();

        return NextResponse.json({
            ok: true,
            data,
        });
    } catch (e: any) {
        return NextResponse.json(
            {
                ok: false,
                error: e.message,
            },
            { status: 500 }
        );
    }
}