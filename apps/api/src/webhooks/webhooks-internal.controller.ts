import { Body, Controller, Headers, Param, Post, UnauthorizedException } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

/**
 * Internal worker hooks — not for Partner/JWT clients.
 * Protect with INTERNAL_WEBHOOK_TOKEN (required in production).
 */
@Controller("internal/webhooks")
export class WebhooksInternalController {
  constructor(private readonly webhooks: WebhooksService) {}

  private assertInternal(token: string | undefined) {
    const expected = process.env.INTERNAL_WEBHOOK_TOKEN;
    if (!expected) {
      if (process.env.NODE_ENV === "production") {
        throw new UnauthorizedException("INTERNAL_WEBHOOK_TOKEN not configured");
      }
      // Local-only default
      if (token !== "dev") throw new UnauthorizedException("Invalid internal token");
      return;
    }
    if (token !== expected) throw new UnauthorizedException("Invalid internal token");
  }

  @Post("deliveries/:id/attempt")
  attempt(
    @Param("id") id: string,
    @Headers("x-avenza-internal") token?: string,
  ) {
    this.assertInternal(token);
    return this.webhooks.attemptDelivery(id);
  }

  @Post("deliveries/:id/status")
  async status(
    @Param("id") id: string,
    @Headers("x-avenza-internal") token: string | undefined,
    @Body() body: { status: "delivered" | "failed"; lastError?: string },
  ) {
    this.assertInternal(token);
    return this.webhooks.markStatus(id, body.status, body.lastError);
  }
}
