import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { SuppliersService } from "./suppliers.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("organizations/:orgId/suppliers")
@UseGuards(JwtAuthGuard, OrgGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Post()
  @Permissions("suppliers:manage")
  create(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.suppliers.create(orgId, user.userId, body);
  }

  @Get()
  list(@Param("orgId") orgId: string) {
    return this.suppliers.list(orgId);
  }

  @Get(":id")
  get(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.suppliers.get(orgId, id);
  }

  @Patch(":id")
  @Permissions("suppliers:manage")
  update(@Param("orgId") orgId: string, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.suppliers.update(orgId, id, body as never);
  }

  @Post(":id/payment-destinations")
  @Permissions("suppliers:manage")
  addDestination(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.suppliers.addDestination(orgId, id, user.userId, body);
  }

  @Post(":id/payment-destinations/:destId/approve")
  @Permissions("suppliers:manage")
  approveDestination(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @Param("destId") destId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.suppliers.approveDestination(orgId, id, destId, user.userId);
  }
}
