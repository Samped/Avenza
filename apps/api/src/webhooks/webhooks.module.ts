import { Global, Module } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksInternalController } from "./webhooks-internal.controller";

@Global()
@Module({
  providers: [WebhooksService],
  controllers: [WebhooksController, WebhooksInternalController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
