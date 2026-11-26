import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { ControlsService } from "./controls.service";

@Controller("organizations/:orgId/controls")
@UseGuards(JwtAuthGuard, OrgGuard)
export class ControlsController {
  constructor(private readonly controls: ControlsService) {}

  @Get()
  @Permissions("invoices:read")
  get(@Param("orgId") orgId: string) {
    return this.controls.getActive(orgId);
  }

  @Get("history")
  @Permissions("invoices:read")
  history(@Param("orgId") orgId: string) {
    return this.controls.listHistory(orgId);
  }

  @Post()
  @Permissions("policies:manage")
  publish(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.controls.publish(orgId, user.userId, body);
  }

  @Post("invoices/:invoiceId/release-hold")
  @Permissions("approvals:decide")
  releaseHold(
    @Param("orgId") orgId: string,
    @Param("invoiceId") invoiceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.controls.releaseHold(orgId, invoiceId, user.userId);
  }
}
