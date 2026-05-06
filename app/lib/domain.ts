import { getAddress } from "viem";

export async function getDomain() {
    return {
        domain: {
            name: "ClobAuthDomain",
            version: "1",
            chainId: 137,
            verifyingContract: getAddress(
                "0x4E8a10c7C3F2bB1f7c0A0d0f8B3c9b1e7b1A0f00"
            ) as any,
        },
        types: {
            SignMessage: [
                { name: "address", type: "address" },
                { name: "timestamp", type: "uint256" },
                { name: "nonce", type: "uint256" },
            ],
        },
    };
}