import crypto from "crypto";

export function signHmac(secret: string, payload: string) {
    return crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("base64");
}