/**
 * One-shot migration: encrypt plaintext sensitive business fields at rest.
 *
 * Usage (from repo root, with DATABASE_URL + AVENZA_FIELD_ENCRYPTION_KEY set):
 *   npx tsx apps/api/scripts/encrypt-sensitive-fields.ts
 *
 * Safe to re-run: already-encrypted values (iv:tag:ciphertext) are skipped.
 */
import { PrismaClient } from "@prisma/client";
import {
  encryptFieldOptional,
  looksEncrypted,
} from "../src/crypto/field-crypto";

const prisma = new PrismaClient();

async function sealColumn<T extends { id: string }>(
  label: string,
  rows: T[],
  get: (row: T) => string | null | undefined,
  set: (id: string, value: string) => Promise<unknown>,
) {
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const value = get(row);
    if (value == null || value === "") {
      skipped += 1;
      continue;
    }
    if (looksEncrypted(value)) {
      skipped += 1;
      continue;
    }
    const sealed = encryptFieldOptional(value);
    if (typeof sealed !== "string") {
      skipped += 1;
      continue;
    }
    await set(row.id, sealed);
    updated += 1;
  }
  console.log(`${label}: encrypted ${updated}, skipped ${skipped}`);
}

async function main() {
  if (!process.env.AVENZA_FIELD_ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
    throw new Error("AVENZA_FIELD_ENCRYPTION_KEY is required");
  }

  const orgs = await prisma.organization.findMany({
    select: { id: true, registrationNumber: true, businessEmail: true },
  });
  await sealColumn(
    "organizations.registrationNumber",
    orgs,
    (o) => o.registrationNumber,
    (id, registrationNumber) => prisma.organization.update({ where: { id }, data: { registrationNumber } }),
  );
  await sealColumn(
    "organizations.businessEmail",
    orgs,
    (o) => o.businessEmail,
    (id, businessEmail) => prisma.organization.update({ where: { id }, data: { businessEmail } }),
  );

  const suppliers = await prisma.supplier.findMany({
    select: { id: true, contactEmail: true, contactPhone: true },
  });
  await sealColumn(
    "suppliers.contactEmail",
    suppliers,
    (s) => s.contactEmail,
    (id, contactEmail) => prisma.supplier.update({ where: { id }, data: { contactEmail } }),
  );
  await sealColumn(
    "suppliers.contactPhone",
    suppliers,
    (s) => s.contactPhone,
    (id, contactPhone) => prisma.supplier.update({ where: { id }, data: { contactPhone } }),
  );

  const invoices = await prisma.invoice.findMany({
    select: { id: true, extractionJson: true },
  });
  await sealColumn(
    "invoices.extractionJson",
    invoices,
    (i) => i.extractionJson,
    (id, extractionJson) => prisma.invoice.update({ where: { id }, data: { extractionJson } }),
  );

  const payments = await prisma.payment.findMany({
    select: { id: true, memo: true },
  });
  await sealColumn(
    "payments.memo",
    payments,
    (p) => p.memo,
    (id, memo) => prisma.payment.update({ where: { id }, data: { memo } }),
  );

  const batches = await prisma.paymentBatch.findMany({
    select: { id: true, memo: true },
  });
  await sealColumn(
    "payment_batches.memo",
    batches,
    (b) => b.memo,
    (id, memo) => prisma.paymentBatch.update({ where: { id }, data: { memo } }),
  );

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
