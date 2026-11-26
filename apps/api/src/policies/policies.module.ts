import { Module, forwardRef } from "@nestjs/common";
import { PoliciesService } from "./policies.service";
import { PoliciesController } from "./policies.controller";
import { TreasuryModule } from "../treasury/treasury.module";

@Module({
  imports: [forwardRef(() => TreasuryModule)],
  providers: [PoliciesService],
  controllers: [PoliciesController],
  exports: [PoliciesService],
})
export class PoliciesModule {}
