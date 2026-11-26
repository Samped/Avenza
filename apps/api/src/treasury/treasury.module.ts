import { Module } from "@nestjs/common";
import { TreasuryService } from "./treasury.service";
import { TreasuryController } from "./treasury.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [TreasuryService],
  controllers: [TreasuryController],
  exports: [TreasuryService],
})
export class TreasuryModule {}
