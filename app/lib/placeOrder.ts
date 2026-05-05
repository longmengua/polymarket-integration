import { signOrder } from "./signOrder";

const CLOB_API = "https://clob.polymarket.com";

export async function placeOrder(order: any) {
    const { signature, address, message } = await signOrder(order);

    const payload = {
        token_id: order.token_id,
        side: order.side,
        price: String(order.price),
        size: String(order.size),
        nonce: message.nonce,
    };

    const timestamp = message.timestamp;

    const res = await fetch(`${CLOB_API}/order`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",

            POLY_ADDRESS: address,
            POLY_SIGNATURE: signature,
            POLY_TIMESTAMP: String(timestamp),
            POLY_NONCE: "0",
        },
        body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) throw new Error(text);

    return JSON.parse(text);
}