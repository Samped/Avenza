import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("organizations/:orgId/audit")
@UseGuards(JwtAuthGuard, OrgGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Permissions("audit:read")
  list(@Param("orgId") orgId: string, @CurrentUser() _user: AuthUser) {
    return this.audit.list(orgId);
  }
}
