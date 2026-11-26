import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditEvent.deleteMany();
  await prisma.policyEvaluation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.approvalRecord.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplierPaymentDestination.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.paymentPolicy.deleteMany();
  await prisma.approvalPolicyVersion.deleteMany();
  await prisma.approvalPolicy.deleteMany();
  await prisma.treasuryConfig.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  const passwordHash = await bcrypt.hash("AvenzaDemo1!", 12);
  const admin = await prisma.user.create({
    data: {
      email: "admin@avenza.demo",
      fullName: "Avenza Admin",
      passwordHash,
    },
  });
  const approver = await prisma.user.create({
    data: {
      email: "approver@avenza.demo",
      fullName: "Avenza Approver",
      passwordHash,
    },
  });
  const payer = await prisma.user.create({
    data: {
      email: "payer@avenza.demo",
      fullName: "Avenza Payer",
      passwordHash,
    },
  });

  const onChainOrgId = `0x${createHash("sha256").update("avenza-demo-org").digest("hex")}`;
  const org = await prisma.organization.create({
    data: {
      legalName: "Avenza Demo Trading Ltd",
      country: "NG",
      businessEmail: "finance@avenza.demo",
      onChainOrgId,
      members: {
        create: [
          { userId: admin.id, role: "admin" },
          { userId: approver.id, role: "approver" },
          { userId: payer.id, role: "payer" },
        ],
      },
      treasuryConfig: { create: { onChainOrgId } },
      approvalPolicies: {
        create: {
          name: "Default",
          versions: {
            create: {
              version: 1,
              rulesJson: JSON.stringify([
                { minAmount: "0", maxAmount: "500000000", requiredApprovals: 1 },
                { minAmount: "500000000", maxAmount: null, requiredApprovals: 1 },
              ]),
            },
          },
        },
      },
      paymentPolicies: {
        create: {
          policyName: "Default spend",
          version: 1,
          policyHash: createHash("sha256").update("demo").digest("hex"),
          dailySpendLimitMinor: "100000000000",
          perPaymentLimitMinor: "25000000000",
          // Cerebr TapeOut processor on X Layer mainnet — PaymentLimit AND circuit #1
          processorAddress:
            process.env.TAPEOUT_PROCESSOR_ADDRESS ||
            "0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF",
          circuitId: process.env.TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID || "1",
        },
      },
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      organizationId: org.id,
      legalName: "Lagos Components Supply",
      supplierCode: "LCS-001",
      verificationStatus: "verified",
      riskStatus: "clear",
      paymentDestinations: {
        create: {
          chainId: 1952,
          tokenAddress: "0xdec90b78111ba2fc6fc6d84d8b9ec159a2d4b9b3",
          walletAddress: "0x1111111111111111111111111111111111111111",
          verificationStatus: "verified",
          approvedAt: new Date(),
          approvedBy: admin.id,
          version: 1,
          active: true,
        },
      },
    },
    include: { paymentDestinations: true },
  });

  console.log(
    JSON.stringify(
      {
        orgId: org.id,
        supplierId: supplier.id,
        destinationId: supplier.paymentDestinations[0]?.id,
        users: [
          { email: "admin@avenza.demo", password: "AvenzaDemo1!", role: "admin" },
          { email: "approver@avenza.demo", password: "AvenzaDemo1!", role: "approver" },
          { email: "payer@avenza.demo", password: "AvenzaDemo1!", role: "payer" },
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
