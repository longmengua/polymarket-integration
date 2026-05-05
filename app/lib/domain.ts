export async function getDomain() {
    return {
        domain: {
            name: "ClobAuthDomain",
            version: "1",
            chainId: 137,

            // ✅ 正确做法：不要写死 verifyingContract
            // verifyingContract:
            //     "0x0000000000000000000000000000000000000000",
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