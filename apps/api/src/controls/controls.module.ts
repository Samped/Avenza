import { Module, forwardRef } from "@nestjs/common";
import { ControlsService } from "./controls.service";
import { ControlsController } from "./controls.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [forwardRef(() => AuditModule)],
  providers: [ControlsService],
  controllers: [ControlsController],
  exports: [ControlsService],
})
export class ControlsModule {}
