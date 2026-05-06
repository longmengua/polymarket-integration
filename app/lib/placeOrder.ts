import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ethers } from "ethers";

// ⚠️ 這裡改成你的私鑰（一定要有資金）
const PRIVATE_KEY = "你的private key";

const RPC_URL = "https://polygon-rpc.com";
const CLOB_URL = "https://clob.polymarket.com/orders";

// ✅ EIP-712 domain
const domain = {
    name: "Polymarket CTF Exchange",
    version: "1",
    chainId: 137,
    verifyingContract: "0x0000000000000000000000000000000000000000",
};

// ✅ order type
const types = {
    Order: [
        { name: "salt", type: "uint256" },
        { name: "maker", type: "address" },
        { name: "signer", type: "address" },
        { name: "taker", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "makerAmount", type: "uint256" },
        { name: "takerAmount", type: "uint256" },
        { name: "expiration", type: "uint256" },
    ],
};

export async function placeOrder(req: NextRequest) {
    try {
        const input = await req.json();

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        const maker = wallet.address;

        // ⚠️ 這裡改：market → tokenId
        const tokenId = BigInt(input.tokenId);

        const price = input.price;
        const size = input.size;
        const side = input.side;

        // ✅ 計算數量（USDC 6 decimals）
        const makerAmount =
            side === "BUY"
                ? ethers.parseUnits(size.toString(), 6)
                : ethers.parseUnits((price * size).toString(), 6);

        const takerAmount =
            side === "BUY"
                ? ethers.parseUnits((price * size).toString(), 6)
                : ethers.parseUnits(size.toString(), 6);

        const order = {
            salt: BigInt(Date.now()),
            maker,
            signer: maker,
            taker: ethers.ZeroAddress,
            tokenId,
            makerAmount,
            takerAmount,
            expiration: BigInt(Math.floor(Date.now() / 1000) + 3600),
        };

        // ✅ EIP-712 簽名（核心）
        const signature = await wallet.signTypedData(domain, types, order);

        // ✅ 丟 CLOB（取代原本 relayer）
        const res = await fetch(CLOB_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                order,
                signature,
                owner: maker,
                orderType: "GTC",
            }),
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