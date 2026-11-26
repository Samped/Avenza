import { Module } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { InvoicesController, PurchaseOrdersController } from "./invoices.controller";
import { RiskModule } from "../risk/risk.module";
import { ControlsModule } from "../controls/controls.module";

@Module({
  imports: [RiskModule, ControlsModule],
  providers: [InvoicesService],
  controllers: [InvoicesController, PurchaseOrdersController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
