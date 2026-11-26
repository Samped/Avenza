import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { InvoicesService } from "./invoices.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgGuard } from "../auth/org.guard";
import { Permissions } from "../auth/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("organizations/:orgId/invoices")
@UseGuards(JwtAuthGuard, OrgGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @Permissions("invoices:write")
  create(@Param("orgId") orgId: string, @CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.invoices.create(orgId, user.userId, body);
  }

  @Get()
  list(@Param("orgId") orgId: string) {
    return this.invoices.list(orgId);
  }

  @Get(":id")
  get(@Param("orgId") orgId: string, @Param("id") id: string) {
    return this.invoices.get(orgId, id);
  }

  @Post(":id/upload")
  @Permissions("invoices:write")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 15_000_000 } }))
  upload(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.invoices.uploadDocument(orgId, id, user.userId, file);
  }

  @Post(":id/extract")
  @Permissions("invoices:write")
  extract(@Param("orgId") orgId: string, @Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.extract(orgId, id, user.userId);
  }

  @Post(":id/verify")
  @Permissions("invoices:review")
  verify(@Param("orgId") orgId: string, @Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.verify(orgId, id, user.userId);
  }

  @Post(":id/review")
  @Permissions("invoices:review")
  review(
    @Param("orgId") orgId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    return this.invoices.review(orgId, id, user.userId, body);
  }

  }

@Controller("organizations/:orgId/purchase-orders")
@UseGuards(JwtAuthGuard, OrgGuard)
export class PurchaseOrdersController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@Param("orgId") orgId: string) {
    return this.invoices.listPurchaseOrders(orgId);
  }

  @Post()
  @Permissions("invoices:write")
  createPo(
    @Param("orgId") orgId: string,
    @Body() body: { supplierId: string; purchaseOrderNumber: string; totalAmount: string; currency?: string },
  ) {
    return this.invoices.createPurchaseOrder(orgId, body);
  }
}
