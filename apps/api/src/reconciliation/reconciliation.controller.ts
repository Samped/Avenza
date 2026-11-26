import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ReconciliationService } from "./reconciliation.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("organizations/:orgId/reconciliation")
@UseGuards(JwtAuthGuard, OrgGuard)
export class ReconciliationController {
  constructor(private readonly recon: ReconciliationService) {}

  @Post("run")
  @Permissions("payments:execute")
  run(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser) {
    return this.recon.run(orgId, user.userId);
  }

  @Get()
  list(@Param("orgId") orgId: string) {
    return this.recon.list(orgId);
  }

  @Get(":id")
  get(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.recon.get(orgId, id);
  }
}
