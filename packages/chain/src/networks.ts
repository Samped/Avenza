export const XLAYER_MAINNET = {
  chainId: 196,
  name: "X Layer",
  rpcUrls: ["https://rpc.xlayer.tech", "https://xlayerrpc.okx.com"] as const,
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  nativeUsdc: "0xB6CEceAB302E2E4948951eE7843FC24E92933061" as const,
} as const;

export const XLAYER_TESTNET = {
  chainId: 1952,
  name: "X Layer Testnet",
  rpcUrls: [
    "https://testrpc.xlayer.tech/terigon",
    "https://xlayertestrpc.okx.com/terigon",
  ] as const,
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  nativeUsdc: "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3" as const,
} as const;

export const TAPEOUT_FACTORY = "0x1f09daefa827f02cbb40967cc91b259763760761" as const;

/** Default explorer base for X Layer (OKLink). */
export function explorerTxUrl(chainId: number, txHash: string): string {
  const base =
    chainId === 196 ? "https://www.oklink.com/xlayer/tx" : "https://www.oklink.com/xlayer-test/tx";
  return `${base}/${txHash}`;
}

export function explorerAddressUrl(chainId: number, address: string): string {
  const base =
    chainId === 196
      ? "https://www.oklink.com/xlayer/address"
      : "https://www.oklink.com/xlayer-test/address";
  return `${base}/${address}`;
}

export function resolveNetwork(chainId: number) {
  if (chainId === XLAYER_MAINNET.chainId) return XLAYER_MAINNET;
  if (chainId === XLAYER_TESTNET.chainId) return XLAYER_TESTNET;
  throw new Error(`Unsupported chain ID: ${chainId}`);
}

export function assertNativeUsdc(chainId: number, tokenAddress: string): void {
  const net = resolveNetwork(chainId);
  if (tokenAddress.toLowerCase() !== net.nativeUsdc.toLowerCase()) {
    throw new Error(
      `Token ${tokenAddress} is not native USDC on chain ${chainId}. Bridged USDC is not interchangeable.`,
    );
  }
}
