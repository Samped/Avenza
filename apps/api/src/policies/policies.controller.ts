import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { PoliciesService } from "./policies.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("organizations/:orgId/policies")
@UseGuards(JwtAuthGuard, OrgGuard)
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Post()
  @Permissions("policies:manage")
  create(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.policies.create(orgId, user.userId, body);
  }

  @Get()
  list(@Param("orgId") orgId: string) {
    return this.policies.list(orgId);
  }

  @Get(":id")
  get(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.policies.get(orgId, id);
  }

  @Post("evaluate/:paymentId")
  @Permissions("payments:execute")
  evaluate(@Param("orgId") orgId: string, @Param("paymentId") paymentId: string) {
    return this.policies.evaluateForPayment(orgId, paymentId);
  }
}
