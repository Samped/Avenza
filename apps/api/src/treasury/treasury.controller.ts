import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { TreasuryService } from "./treasury.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("organizations/:orgId/treasury")
@UseGuards(JwtAuthGuard, OrgGuard)
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get()
  @Permissions("treasury:read")
  summary(@Param("orgId") orgId: string) {
    return this.treasury.getSummary(orgId);
  }

  @Post("ensure-wallet")
  @Permissions("treasury:manage")
  ensure(@Param("orgId") orgId: string) {
    return this.treasury.ensureWallet(orgId).then((cfg) => ({
      fundingWalletAddress: cfg.fundingWalletAddress,
      vaultAddress: cfg.vaultAddress,
      onChainOrgId: cfg.onChainOrgId,
      chainId: cfg.chainId,
    }));
  }

  @Post("deposit")
  @Permissions("treasury:manage")
  deposit(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { amountMinor?: string },
  ) {
    return this.treasury.depositToVault(orgId, user.userId, body?.amountMinor);
  }
}
