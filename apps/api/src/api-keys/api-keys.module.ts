import { Module, forwardRef } from "@nestjs/common";
import { ApiKeysService } from "./api-keys.service";
import { ApiKeysController } from "./api-keys.controller";
import { PartnerController } from "./partner.controller";
import { InvoicesModule } from "../invoices/invoices.module";
import { PaymentsModule } from "../payments/payments.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { TreasuryModule } from "../treasury/treasury.module";

@Module({
  imports: [
    forwardRef(() => InvoicesModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => ApprovalsModule),
    TreasuryModule,
  ],
  providers: [ApiKeysService],
  controllers: [ApiKeysController, PartnerController],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
