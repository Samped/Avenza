import { Controller, Headers, Param, Post, UnauthorizedException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

/** Worker-facing payment confirmation refresh. */
@Controller("internal/payments")
export class PaymentsInternalController {
  constructor(private readonly payments: PaymentsService) {}

  private assertInternal(token: string | undefined) {
    const expected = process.env.INTERNAL_WEBHOOK_TOKEN;
    if (!expected) {
      if (process.env.NODE_ENV === "production") {
        throw new UnauthorizedException("INTERNAL_WEBHOOK_TOKEN not configured");
      }
      if (token !== "dev") throw new UnauthorizedException("Invalid internal token");
      return;
    }
    if (token !== expected) throw new UnauthorizedException("Invalid internal token");
  }

  @Post(":orgId/:paymentId/refresh-status")
  refresh(
    @Param("orgId") orgId: string,
    @Param("paymentId") paymentId: string,
    @Headers("x-avenza-internal") token?: string,
  ) {
    this.assertInternal(token);
    return this.payments.refreshStatus(orgId, paymentId);
  }
}
