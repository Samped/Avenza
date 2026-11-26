import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  businessTreasuryAbi,
  createXLayerPublicClient,
  createXLayerWalletClient,
  erc20Abi,
  type Hex,
} from "@avenza/chain";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { decryptSecret } from "../crypto/secrets";
import { provisionOrgWallet } from "./org-wallet";

@Injectable()
export class TreasuryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Ensure workspace has a funding wallet + vault binding (idempotent). */
  async ensureWallet(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { treasuryConfig: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    let cfg = org.treasuryConfig;
    if (!cfg) {
      const wallet = provisionOrgWallet();
      cfg = await this.prisma.treasuryConfig.create({
        data: {
          organizationId: orgId,
          onChainOrgId: org.onChainOrgId,
          ...wallet,
        },
      });
    } else if (!cfg.fundingWalletAddress || !cfg.fundingWalletKeyEnc) {
      const wallet = provisionOrgWallet();
      cfg = await this.prisma.treasuryConfig.update({
        where: { id: cfg.id },
        data: {
          fundingWalletAddress: wallet.fundingWalletAddress,
          fundingWalletKeyEnc: wallet.fundingWalletKeyEnc,
          vaultAddress: cfg.vaultAddress || wallet.vaultAddress,
          chainId: cfg.chainId || wallet.chainId,
          onChainOrgId: cfg.onChainOrgId || org.onChainOrgId,
        },
      });
    } else if (!cfg.vaultAddress && process.env.TREASURY_ADDRESS) {
      cfg = await this.prisma.treasuryConfig.update({
        where: { id: cfg.id },
        data: { vaultAddress: process.env.TREASURY_ADDRESS },
      });
    }

    return cfg;
  }

  async getSummary(orgId: string) {
    const cfg = await this.ensureWallet(orgId);
    const chainId = cfg.chainId || Number(process.env.XLAYER_CHAIN_ID || 1952);
    const rpc = process.env.XLAYER_RPC_URL;
    const usdc = (process.env.USDC_TOKEN_ADDRESS || "") as `0x${string}`;
    const vault = (cfg.vaultAddress || process.env.TREASURY_ADDRESS || null) as `0x${string}` | null;
    const funding = cfg.fundingWalletAddress as `0x${string}` | null;
    const onChainOrgId = (cfg.onChainOrgId || "") as Hex;

    let fundingUsdc = "0";
    let fundingOkb = "0";
    let vaultAvailable = "0";

    try {
      if (funding && usdc) {
        const publicClient = createXLayerPublicClient(chainId, rpc);
        const [usdcBal, okbBal] = await Promise.all([
          publicClient.readContract({
            address: usdc,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [funding],
          }),
          publicClient.getBalance({ address: funding }),
        ]);
        fundingUsdc = usdcBal.toString();
        fundingOkb = okbBal.toString();

        if (vault && onChainOrgId && onChainOrgId.startsWith("0x") && onChainOrgId.length === 66) {
          const avail = await publicClient.readContract({
            address: vault,
            abi: businessTreasuryAbi,
            functionName: "available",
            args: [onChainOrgId],
          });
          vaultAvailable = avail.toString();
        }
      }
    } catch {
      // RPC optional for local/dev — still return addresses
    }

    return {
      organizationId: orgId,
      onChainOrgId: cfg.onChainOrgId,
      chainId,
      usdcToken: usdc || null,
      vaultAddress: vault,
      fundingWalletAddress: funding,
      balances: {
        fundingWalletUsdcMinor: fundingUsdc,
        fundingWalletOkbWei: fundingOkb,
        vaultAvailableUsdcMinor: vaultAvailable,
      },
      instructions: {
        fund: "Send native USDC (and a little OKB for gas) to the funding wallet address.",
        deposit:
          "Call Deposit to vault to move USDC from the funding wallet into BusinessTreasury for this organization.",
        settle: "Payments settle from the vault after TapeOut authorization — not from the funding wallet directly.",
      },
    };
  }

  /**
   * Agentic ops: move USDC from the org funding wallet into BusinessTreasury
   * for this organization's on-chain id.
   */
  async depositToVault(orgId: string, actorId: string, amountMinor?: string) {
    const cfg = await this.ensureWallet(orgId);
    if (!cfg.fundingWalletAddress || !cfg.fundingWalletKeyEnc) {
      throw new BadRequestException("Funding wallet not provisioned");
    }
    const vault = (cfg.vaultAddress || process.env.TREASURY_ADDRESS) as `0x${string}` | undefined;
    const usdc = process.env.USDC_TOKEN_ADDRESS as `0x${string}` | undefined;
    if (!vault || !usdc) {
      throw new ServiceUnavailableException("TREASURY_ADDRESS / USDC_TOKEN_ADDRESS not configured");
    }
    const onChainOrgId = (cfg.onChainOrgId || "") as Hex;
    if (!onChainOrgId.startsWith("0x") || onChainOrgId.length !== 66) {
      throw new BadRequestException("Invalid on-chain organization id");
    }

    const pk = decryptSecret(cfg.fundingWalletKeyEnc) as Hex;
    const chainId = cfg.chainId || Number(process.env.XLAYER_CHAIN_ID || 1952);
    const rpc = process.env.XLAYER_RPC_URL;
    const publicClient = createXLayerPublicClient(chainId, rpc);
    const wallet = createXLayerWalletClient(chainId, pk, rpc);
    const account = wallet.account;
    if (!account) throw new BadRequestException("Funding wallet account missing");

    const balance = await publicClient.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });

    const amount = amountMinor ? BigInt(amountMinor) : balance;
    if (amount <= 0n) throw new BadRequestException("No USDC to deposit");
    if (amount > balance) throw new BadRequestException("Amount exceeds funding wallet USDC balance");

    const approveHash = await wallet.writeContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [vault, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const depositHash = await wallet.writeContract({
      address: vault,
      abi: businessTreasuryAbi,
      functionName: "deposit",
      args: [onChainOrgId, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: depositHash });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "treasury.deposit",
      entityType: "treasury",
      entityId: cfg.id,
      eventPayload: {
        amount: amount.toString(),
        approveHash,
        depositHash,
        fundingWallet: account.address,
        vault,
      },
    });

    return {
      amountMinor: amount.toString(),
      approveHash,
      depositHash,
      fundingWalletAddress: account.address,
      vaultAddress: vault,
    };
  }
}
