import { generateFundingWallet } from "@avenza/chain";
import { encryptSecret } from "../crypto/secrets";

export type ProvisionedOrgWallet = {
  fundingWalletAddress: string;
  fundingWalletKeyEnc: string;
  vaultAddress: string | null;
  chainId: number;
};

/** Create a dedicated funding EOA for a workspace (agentic ops / vault deposits). */
export function provisionOrgWallet(): ProvisionedOrgWallet {
  const { address, privateKey } = generateFundingWallet();
  const chainId = Number(process.env.XLAYER_CHAIN_ID || 196);
  const vaultAddress = process.env.TREASURY_ADDRESS || null;
  return {
    fundingWalletAddress: address,
    fundingWalletKeyEnc: encryptSecret(privateKey),
    vaultAddress,
    chainId,
  };
}
