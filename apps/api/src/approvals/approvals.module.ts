import { Module } from "@nestjs/common";
import { ApprovalsService } from "./approvals.service";
import { ApprovalsController } from "./approvals.controller";
import { ControlsModule } from "../controls/controls.module";
import { RiskModule } from "../risk/risk.module";

@Module({
  imports: [ControlsModule, RiskModule],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
