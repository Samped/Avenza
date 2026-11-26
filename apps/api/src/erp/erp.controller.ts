import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ErpService } from "./erp.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("organizations/:orgId/erp")
@UseGuards(JwtAuthGuard, OrgGuard)
export class ErpController {
  constructor(private readonly erp: ErpService) {}

  @Post("connect")
  @Permissions("erp:manage")
  connect(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body()
    body: { provider: "odoo" | "erpnext"; baseUrl: string; credentials?: Record<string, string> },
  ) {
    return this.erp.connect(orgId, user.userId, body);
  }

  @Get()
  list(@Param("orgId") orgId: string) {
    return this.erp.list(orgId);
  }

  @Post("test")
  @Permissions("erp:manage")
  test(
    @Param("orgId") orgId: string,
    @Body() body: { provider?: string },
  ) {
    return this.erp.test(orgId, body?.provider);
  }

  @Post("pull")
  @Permissions("erp:manage")
  pull(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { provider?: string },
  ) {
    return this.erp.pull(orgId, user.userId, body?.provider);
  }

  @Post("payments/:paymentId/writeback")
  @Permissions("erp:manage")
  writeback(
    @Param("orgId") orgId: string,
    @Param("paymentId") paymentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.erp.writeBackPayment(orgId, paymentId, user.userId);
  }
}
