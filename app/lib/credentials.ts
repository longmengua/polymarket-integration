const CLOB_API = "https://clob.polymarket.com";

const credsMap: Record<string, any> = {};

export async function getCreds(address: string, signature: string, timestamp: number) {
    if (credsMap[address]) return credsMap[address];

    const res = await fetch(`${CLOB_API}/auth/api-key`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            POLY_ADDRESS: address,
            POLY_SIGNATURE: signature,
            POLY_TIMESTAMP: String(timestamp),
            POLY_NONCE: "0",
        },
    });

    const text = await res.text();
    if (!res.ok) throw new Error(text);

    credsMap[address] = JSON.parse(text);
    return credsMap[address];
}