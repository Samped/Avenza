import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { PoliciesModule } from "./policies/policies.module";
import { PaymentsModule } from "./payments/payments.module";
import { AuditModule } from "./audit/audit.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { ErpModule } from "./erp/erp.module";
import { TreasuryModule } from "./treasury/treasury.module";
import { ChainModule } from "./chain/chain.module";
import { ControlsModule } from "./controls/controls.module";
import { RiskModule } from "./risk/risk.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { HealthController } from "./health.controller";
import { StorageModule } from "./storage/storage.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { OrgGuard } from "./auth/org.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    ChainModule,
    WebhooksModule,
    RiskModule,
    ControlsModule,
    AuthModule,
    OrganizationsModule,
    SuppliersModule,
    InvoicesModule,
    ApprovalsModule,
    PoliciesModule,
    PaymentsModule,
    TreasuryModule,
    AuditModule,
    ReconciliationModule,
    ErpModule,
    ApiKeysModule,
  ],
  controllers: [HealthController],
  providers: [JwtAuthGuard, OrgGuard],
})
export class AppModule {}
