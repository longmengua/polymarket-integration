import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(
    "0x8b0400d02241bdd6e6e03dc44abce9aafbb1a343a9b742df21e5756bbc9a218d"
);

export const signer = createWalletClient({
    account,
    transport: http("https://polygon-rpc.com"),
});