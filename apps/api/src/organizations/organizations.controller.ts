import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("organizations")
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.orgs.create(user.userId, body);
  }

  @Get(":orgId")
  @UseGuards(OrgGuard)
  get(@Param("orgId") orgId: string) {
    return this.orgs.get(orgId);
  }

  @Patch(":orgId")
  @UseGuards(OrgGuard)
  @Permissions("org:manage")
  patch(
    @Param("orgId") orgId: string,
    @Body()
    body: {
      legalName?: string;
      country?: string;
      businessEmail?: string;
      registrationNumber?: string;
    },
  ) {
    return this.orgs.update(orgId, body);
  }

  @Get(":orgId/members")
  @UseGuards(OrgGuard)
  members(@Param("orgId") orgId: string) {
    return this.orgs.listMembers(orgId);
  }

  @Post(":orgId/members")
  @UseGuards(OrgGuard)
  @Permissions("members:manage")
  invite(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.orgs.inviteMember(orgId, user.userId, body);
  }
}
