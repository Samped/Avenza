import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { WebhooksService } from "./webhooks.service";

@Controller("organizations/:orgId/webhooks")
@UseGuards(JwtAuthGuard, OrgGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @Permissions("webhooks:manage")
  list(@Param("orgId") orgId: string) {
    return this.webhooks.listEndpoints(orgId);
  }

  @Post()
  @Permissions("webhooks:manage")
  create(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.webhooks.createEndpoint(orgId, user.userId, body);
  }

  @Delete(":id")
  @Permissions("webhooks:manage")
  revoke(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.webhooks.revokeEndpoint(orgId, id, user.userId);
  }
}
