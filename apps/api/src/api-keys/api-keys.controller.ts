import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { ApiKeysService } from "./api-keys.service";

@Controller("organizations/:orgId/api-keys")
@UseGuards(JwtAuthGuard, OrgGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  @Permissions("api_keys:manage")
  list(@Param("orgId") orgId: string) {
    return this.apiKeys.list(orgId);
  }

  @Post()
  @Permissions("api_keys:manage")
  create(
    @Param("orgId") orgId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.apiKeys.create(orgId, user.userId, body);
  }

  @Delete(":id")
  @Permissions("api_keys:manage")
  revoke(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.apiKeys.revoke(orgId, id, user.userId);
  }
}
