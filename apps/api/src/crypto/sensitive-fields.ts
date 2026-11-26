import {
  decryptFieldOptional,
  encryptFieldOptional,
} from "./field-crypto";

/** Encrypt sensitive business strings for storage. */
export function sealMemo(value: string | null | undefined) {
  return encryptFieldOptional(value) as string | null | undefined;
}

export function sealExtractionJson(value: string | null | undefined) {
  return encryptFieldOptional(value) as string | null | undefined;
}

export function sealRegistration(value: string | null | undefined) {
  return encryptFieldOptional(value) as string | null | undefined;
}

export function sealEmail(value: string | null | undefined) {
  return encryptFieldOptional(value) as string | null | undefined;
}

export function sealPhone(value: string | null | undefined) {
  return encryptFieldOptional(value) as string | null | undefined;
}

/** Decrypt for API responses (plaintext legacy passes through). */
export function openMemo(value: string | null | undefined) {
  return decryptFieldOptional(value) as string | null | undefined;
}

export function openExtractionJson(value: string | null | undefined) {
  return decryptFieldOptional(value) as string | null | undefined;
}

export function openRegistration(value: string | null | undefined) {
  return decryptFieldOptional(value) as string | null | undefined;
}

export function openEmail(value: string | null | undefined) {
  return decryptFieldOptional(value) as string | null | undefined;
}

export function openPhone(value: string | null | undefined) {
  return decryptFieldOptional(value) as string | null | undefined;
}

export function revealPayment<T extends { memo?: string | null }>(row: T): T {
  return { ...row, memo: openMemo(row.memo) ?? null };
}

export function revealBatch<T extends { memo?: string | null; payments?: Array<{ memo?: string | null }> }>(
  row: T,
): T {
  return {
    ...row,
    memo: openMemo(row.memo) ?? null,
    payments: row.payments?.map((p) => revealPayment(p)),
  };
}

export function revealInvoice<
  T extends {
    extractionJson?: string | null;
    supplier?: { contactEmail?: string | null; contactPhone?: string | null } | null;
    payments?: Array<{ memo?: string | null }>;
  },
>(row: T): T {
  return {
    ...row,
    extractionJson: openExtractionJson(row.extractionJson) ?? null,
    supplier: row.supplier
      ? {
          ...row.supplier,
          contactEmail: openEmail(row.supplier.contactEmail) ?? null,
          contactPhone: openPhone(row.supplier.contactPhone) ?? null,
        }
      : row.supplier,
    payments: row.payments?.map((p) => revealPayment(p)),
  };
}

export function revealOrg<
  T extends {
    registrationNumber?: string | null;
    businessEmail?: string | null;
    treasuryConfig?: (Record<string, unknown> & { fundingWalletKeyEnc?: string | null }) | null;
  },
>(row: T): T {
  const treasuryConfig = row.treasuryConfig
    ? (() => {
        const { fundingWalletKeyEnc: _drop, ...safe } = row.treasuryConfig!;
        return safe;
      })()
    : row.treasuryConfig;
  return {
    ...row,
    registrationNumber: openRegistration(row.registrationNumber) ?? null,
    businessEmail: openEmail(row.businessEmail) ?? null,
    treasuryConfig: treasuryConfig as T["treasuryConfig"],
  };
}

export function revealSupplier<
  T extends { contactEmail?: string | null; contactPhone?: string | null },
>(row: T): T {
  return {
    ...row,
    contactEmail: openEmail(row.contactEmail) ?? null,
    contactPhone: openPhone(row.contactPhone) ?? null,
  };
}
