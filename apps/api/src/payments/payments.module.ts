import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsInternalController } from "./payments-internal.controller";
import { PoliciesModule } from "../policies/policies.module";
import { RiskModule } from "../risk/risk.module";
import { ControlsModule } from "../controls/controls.module";

@Module({
  imports: [PoliciesModule, RiskModule, ControlsModule],
  providers: [PaymentsService],
  controllers: [PaymentsController, PaymentsInternalController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
