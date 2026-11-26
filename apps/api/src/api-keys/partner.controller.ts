import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiKeysService } from "./api-keys.service";
import { PrismaService } from "../prisma/prisma.service";
import { InvoicesService } from "../invoices/invoices.service";
import { PaymentsService } from "../payments/payments.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { TreasuryService } from "../treasury/treasury.service";

/**
 * Partner API surface authenticated via Bearer avz_live_* keys (not JWT).
 * Settlement still goes through on-chain PaymentAuthorization + ControlsRegistry.
 */
/** Mounted under global prefix `api/v1` → `/api/v1/invoices`, etc. */
@Controller()
export class PartnerController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly approvals: ApprovalsService,
    private readonly treasury: TreasuryService,
  ) {}

  /** Require at least one of the listed scopes (OR). */
  private async auth(authorization: string | undefined, scopes: string[]) {
    if (!scopes.length) return this.apiKeys.authenticate(authorization, []);
    let lastErr: unknown;
    for (const scope of scopes) {
      try {
        return await this.apiKeys.authenticate(authorization, [scope]);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof UnauthorizedException
      ? lastErr
      : new UnauthorizedException(`Missing scope: one of ${scopes.join(", ")}`);
  }

  @Get("invoices")
  async listInvoices(@Headers("authorization") authorization?: string) {
    const auth = await this.auth(authorization, ["invoices:read"]);
    return this.invoices.list(auth.organizationId);
  }

  @Get("invoices/:id")
  async getInvoice(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    const auth = await this.auth(authorization, ["invoices:read"]);
    return this.invoices.get(auth.organizationId, id);
  }

  @Post("invoices")
  async createInvoice(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const auth = await this.auth(authorization, ["invoices:write"]);
    return this.invoices.create(auth.organizationId, "api-key:" + auth.apiKeyId, body);
  }

  @Post("invoices/:id/verify")
  async verifyInvoice(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    const auth = await this.auth(authorization, ["invoices:write"]);
    return this.invoices.verify(auth.organizationId, id, "api-key:" + auth.apiKeyId);
  }

  @Post("invoices/:id/submit-approval")
  async submitApproval(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    const auth = await this.auth(authorization, ["approvals:submit", "approvals:write"]);
    return this.approvals.submitForApproval(
      auth.organizationId,
      id,
      "api-key:" + auth.apiKeyId,
    );
  }

  @Get("approvals")
  async listApprovals(@Headers("authorization") authorization?: string) {
    const auth = await this.auth(authorization, ["approvals:submit", "approvals:write", "payments:read"]);
    return this.approvals.listPending(auth.organizationId);
  }

  @Get("payments")
  async listPayments(@Headers("authorization") authorization?: string) {
    const auth = await this.auth(authorization, ["payments:read"]);
    return this.payments.list(auth.organizationId);
  }

  @Post("payments/direct")
  async createDirect(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const auth = await this.auth(authorization, ["payments:initiate"]);
    return this.payments.createDirect(auth.organizationId, "api-key:" + auth.apiKeyId, body);
  }

  @Post("payments/batches")
  async createBatch(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const auth = await this.auth(authorization, ["payments:initiate"]);
    return this.payments.createBatch(auth.organizationId, "api-key:" + auth.apiKeyId, body);
  }

  @Get("payments/batches")
  async listBatches(@Headers("authorization") authorization?: string) {
    const auth = await this.auth(authorization, ["payments:read"]);
    return this.payments.listBatches(auth.organizationId);
  }

  @Get("payments/batches/:batchId")
  async getBatch(
    @Headers("authorization") authorization: string | undefined,
    @Param("batchId") batchId: string,
  ) {
    const auth = await this.auth(authorization, ["payments:read"]);
    return this.payments.getBatch(auth.organizationId, batchId);
  }

  @Post("payments/batches/:batchId/approve")
  async approveBatch(
    @Headers("authorization") _authorization: string | undefined,
    @Param("batchId") _batchId: string,
    @Body() _body: unknown,
  ) {
    // Dual-control: approvals must come from the console (JWT users), not partner keys.
    throw new UnauthorizedException(
      "Partner API cannot approve payments — use the console Approvals flow (JWT)",
    );
  }

  @Post("payments/batches/:batchId/settle")
  async settleBatch(
    @Headers("authorization") authorization: string | undefined,
    @Param("batchId") batchId: string,
  ) {
    const auth = await this.auth(authorization, ["payments:settle"]);
    return this.payments.settleBatch(auth.organizationId, batchId, "api-key:" + auth.apiKeyId);
  }

  @Post("payments/:id/approve")
  async approvePayment(
    @Headers("authorization") _authorization: string | undefined,
    @Param("id") _id: string,
    @Body() _body: unknown,
  ) {
    throw new UnauthorizedException(
      "Partner API cannot approve payments — use the console Approvals flow (JWT)",
    );
  }

  @Post("payments/:id/authorize")
  async authorizePayment(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    const auth = await this.auth(authorization, ["payments:initiate", "payments:settle"]);
    return this.payments.authorize(auth.organizationId, id, "api-key:" + auth.apiKeyId);
  }

  @Post("payments/:id/settle")
  async settle(
    @Headers("authorization") authorization: string | undefined,
    @Param("id") id: string,
  ) {
    const auth = await this.auth(authorization, ["payments:settle"]);
    return this.payments.execute(auth.organizationId, id, "api-key:" + auth.apiKeyId);
  }

  @Post("approvals/:id/decide")
  async decide(
    @Headers("authorization") _authorization: string | undefined,
    @Param("id") _id: string,
    @Body() _body: unknown,
  ) {
    throw new UnauthorizedException(
      "Partner API cannot decide approvals — use the console Approvals flow (JWT)",
    );
  }

  @Get("suppliers")
  async listSuppliers(@Headers("authorization") authorization?: string) {
    const auth = await this.auth(authorization, ["suppliers:read"]);
    return this.prisma.supplier.findMany({
      where: { organizationId: auth.organizationId },
      include: { paymentDestinations: { where: { active: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  @Get("treasury")
  async getTreasury(@Headers("authorization") authorization?: string) {
    const auth = await this.auth(authorization, ["treasury:read"]);
    return this.treasury.getSummary(auth.organizationId);
  }
}
