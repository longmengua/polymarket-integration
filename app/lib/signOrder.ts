import { signer } from "./wallet";
import { getDomain } from "./domain";

export async function signOrder(order: any) {
    const { domain, types } = await getDomain();

    const [address] = await signer.getAddresses();

    const message = {
        address,
        timestamp: Math.floor(Date.now() / 1000),
        nonce: order.nonce ?? 0,
    };

    const signature = await signer.signTypedData({
        domain,
        types,
        primaryType: "SignMessage",
        message,
    });

    return { signature, address, message };
}