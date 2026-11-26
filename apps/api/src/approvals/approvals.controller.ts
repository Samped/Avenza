import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApprovalsService } from "./approvals.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { CreateApprovalPolicySchema } from "@avenza/shared";
import { BadRequestException } from "@nestjs/common";

@Controller("organizations/:orgId/approvals")
@UseGuards(JwtAuthGuard, OrgGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Post("policies")
  @Permissions("policies:manage")
  createPolicy(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = CreateApprovalPolicySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.approvals.createPolicy(orgId, user.userId, parsed.data.name, parsed.data.rules);
  }

  @Get("policies")
  listPolicies(@Param("orgId") orgId: string) {
    return this.approvals.listPolicies(orgId);
  }

  @Get()
  list(@Param("orgId") orgId: string) {
    return this.approvals.listPending(orgId);
  }

  @Post("submit/:invoiceId")
  @Permissions("invoices:review")
  submit(
    @Param("orgId") orgId: string,
    @Param("invoiceId") invoiceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvals.submitForApproval(orgId, invoiceId, user.userId);
  }

  @Post(":id/approve")
  @Permissions("approvals:decide")
  approve(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.approvals.decide(orgId, id, user.userId, {
      ...(body as object),
      decision: "approve",
    });
  }

  @Post(":id/reject")
  @Permissions("approvals:decide")
  reject(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.approvals.decide(orgId, id, user.userId, {
      ...(body as object),
      decision: "reject",
    });
  }
}
