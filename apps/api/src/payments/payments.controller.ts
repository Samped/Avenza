import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("organizations/:orgId/payments")
@UseGuards(JwtAuthGuard, OrgGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("network")
  network() {
    return this.payments.networkInfo();
  }

  @Post("direct")
  @Permissions("payments:execute")
  createDirect(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.payments.createDirect(orgId, user.userId, body);
  }

  @Get("batches")
  listBatches(@Param("orgId") orgId: string) {
    return this.payments.listBatches(orgId);
  }

  @Post("batches")
  @Permissions("payments:execute")
  createBatch(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.payments.createBatch(orgId, user.userId, body);
  }

  @Get("batches/:batchId")
  getBatch(@Param("orgId") orgId: string, @Param("batchId") batchId: string) {
    return this.payments.getBatch(orgId, batchId);
  }

  @Post("batches/:batchId/approve")
  @Permissions("approvals:decide")
  approveBatch(
    @Param("orgId") orgId: string,
    @Param("batchId") batchId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.payments.approveBatch(orgId, batchId, user.userId, body);
  }

  @Post("batches/:batchId/authorize")
  @Permissions("payments:execute")
  authorizeBatch(
    @Param("orgId") orgId: string,
    @Param("batchId") batchId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.authorizeBatch(orgId, batchId, user.userId);
  }

  @Post("batches/:batchId/settle")
  @Permissions("payments:execute")
  settleBatch(
    @Param("orgId") orgId: string,
    @Param("batchId") batchId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.settleBatch(orgId, batchId, user.userId);
  }

  @Post()
  @Permissions("payments:execute")
  create(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.payments.create(orgId, user.userId, body);
  }

  @Get()
  list(@Param("orgId") orgId: string) {
    return this.payments.list(orgId);
  }

  @Get(":id")
  get(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.payments.get(orgId, id);
  }

  @Post(":id/approve")
  @Permissions("approvals:decide")
  approvePayment(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.payments.approvePayment(orgId, id, user.userId, body);
  }

  @Post(":id/authorize")
  @Permissions("payments:execute")
  authorize(@Param("orgId") orgId: string, @Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.payments.authorize(orgId, id, user.userId);
  }

  @Post(":id/execute")
  @Permissions("payments:execute")
  execute(@Param("orgId") orgId: string, @Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.payments.execute(orgId, id, user.userId);
  }

  @Get(":id/status")
  status(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.payments.refreshStatus(orgId, id);
  }

  @Post(":id/reconcile")
  @Permissions("payments:execute")
  reconcile(@Param("orgId") orgId: string, @Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.payments.markReconciled(orgId, id, user.userId);
  }
}
