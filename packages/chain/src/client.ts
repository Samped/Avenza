import { createPublicClient, createWalletClient, http, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { resolveNetwork } from "./networks";

export function createXLayerPublicClient(chainId: number, rpcUrl?: string) {
  const net = resolveNetwork(chainId);
  const url = rpcUrl ?? net.rpcUrls[0];
  return createPublicClient({
    chain: {
      id: net.chainId,
      name: net.name,
      nativeCurrency: net.nativeCurrency,
      rpcUrls: { default: { http: [...net.rpcUrls] } },
    },
    transport: http(url),
  });
}

export function createXLayerWalletClient(chainId: number, privateKey: Hex, rpcUrl?: string) {
  const net = resolveNetwork(chainId);
  const url = rpcUrl ?? net.rpcUrls[0];
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: {
      id: net.chainId,
      name: net.name,
      nativeCurrency: net.nativeCurrency,
      rpcUrls: { default: { http: [...net.rpcUrls] } },
    },
    transport: http(url),
  });
}

export type { Address, Hex };
