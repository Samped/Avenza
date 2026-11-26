import { Global, Module } from "@nestjs/common";
import { OnchainSyncService } from "./onchain-sync.service";

@Global()
@Module({
  providers: [OnchainSyncService],
  exports: [OnchainSyncService],
})
export class ChainModule {}
