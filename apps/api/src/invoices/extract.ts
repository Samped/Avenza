import { parseDecimalToMinor } from "@avenza/shared";

export type ExtractedField<T> = {
  value: T | null;
  confidence: number;
  source: "heuristic" | "ai" | "manual" | "json";
};

export type LineItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
};

export type ExtractionResult = {
  invoiceNumber: ExtractedField<string>;
  supplierName: ExtractedField<string>;
  invoiceDate: ExtractedField<string>;
  dueDate: ExtractedField<string>;
  currency: ExtractedField<string>;
  subtotal: ExtractedField<string>;
  taxAmount: ExtractedField<string>;
  totalAmount: ExtractedField<string>;
  purchaseOrderRef: ExtractedField<string>;
  paymentDestination: ExtractedField<string>;
  lineItems: ExtractedField<LineItem[]>;
  needsReview: boolean;
  documentKind?: string;
  rawPreview?: string;
};

function field<T>(
  value: T | null,
  confidence: number,
  source: ExtractedField<T>["source"] = "heuristic",
): ExtractedField<T> {
  return { value, confidence, source };
}

function cleanAmount(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.replace(/[,\s]/g, "").replace(/[^\d.-]/g, "");
  if (!n || n === "." || n === "-" || n === "-.") return null;
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(2);
}

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const mdy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (mdy) {
    let y = Number(mdy[3]);
    if (y < 100) y += 2000;
    const a = Number(mdy[1]);
    const b = Number(mdy[2]);
    // Prefer MDY when first > 12, else assume MDY for US-style invoices.
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/** Strip PDF/OCR junk from party names: "Arc Softgoods Inc) Tj" → "Arc Softgoods Inc" */
function cleanPartyName(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw
    .replace(/\)\s*Tj\b/gi, "")
    .replace(/\bTj\b/gi, "")
    .replace(/\bT\*\b/g, "")
    .replace(/[<>]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s:.\-]+|[\s:.\-]+$/g, "")
    .trim();
  // Drop trailing punctuation left by PDF operators
  s = s.replace(/[)\]}>]+$/g, "").trim();
  if (s.length < 2) return null;
  return s.slice(0, 120);
}

function pickBestAmount(text: string, labels: string[]): string | null {
  // Try labels in priority order so "total amount due" wins over bare "total".
  for (const label of labels) {
    const patterns = [
      new RegExp(
        `(?:${label})\\s*[:#]?\\s*(?:USDC|USD|\\$)?\\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,6})?|[0-9]+(?:\\.[0-9]{1,6})?)`,
        "i",
      ),
      new RegExp(`(?:${label})\\s*[:#]?\\s*([0-9]+(?:\\.[0-9]{1,6})?)\\s*(?:USDC|USD|\\$)`, "i"),
    ];
    for (const re of patterns) {
      const cleaned = cleanAmount(text.match(re)?.[1]);
      if (cleaned) return cleaned;
    }
  }
  return null;
}

/** Prefer the largest clearly labeled total-like amount. */
function findAmountCandidates(text: string): string[] {
  const out: string[] = [];
  const re =
    /(?:\bgrand\s+total\b|\bamount\s+due\b|\bbalance\s+due\b|\btotal\s+amount(?:\s+due)?\b|\btotal\s+due\b|\binvoice\s+total\b|\bpay(?:ment)?\s+due\b|(?<![\w-])\btotal\b(?![\w-]))\s*[:#]?\s*(?:USDC|USD|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,6})?|[0-9]+(?:\.[0-9]{1,6})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const c = cleanAmount(m[1]);
    if (c) out.push(c);
  }
  // Bare currency lines: "USDC 50.00" / "$1,250.00"
  const bare =
    /(?:^|\n)\s*(?:USDC|USD|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})\s*(?:$|\n)/gi;
  while ((m = bare.exec(text))) {
    const c = cleanAmount(m[1]);
    if (c) out.push(c);
  }
  return out;
}

function extractLineItems(text: string): LineItem[] {
  const items: LineItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // desc ... qty x price = total   OR   desc | qty | price | total
    const pipe = line.split("|").map((p) => p.trim());
    if (pipe.length >= 4) {
      const qty = cleanAmount(pipe[1]);
      const unit = cleanAmount(pipe[2]);
      const tot = cleanAmount(pipe[3]);
      if (qty && unit && tot && pipe[0] && !/^(desc|item|qty)/i.test(pipe[0])) {
        items.push({ description: pipe[0].slice(0, 200), quantity: qty, unitPrice: unit, total: tot });
        continue;
      }
    }
    const m = line.match(
      /^(.{3,80}?)\s+(\d+(?:\.\d+)?)\s*[x×@]\s*\$?([0-9,]+\.\d{2})\s*(?:=|→|->)?\s*\$?([0-9,]+\.\d{2})\s*$/i,
    );
    if (m) {
      items.push({
        description: m[1]!.trim(),
        quantity: cleanAmount(m[2]) || m[2]!,
        unitPrice: cleanAmount(m[3]) || m[3]!,
        total: cleanAmount(m[4]) || m[4]!,
      });
    }
  }
  return items.slice(0, 50);
}

function extractFromJson(text: string): ExtractionResult | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    const obj = (raw.invoice && typeof raw.invoice === "object" ? raw.invoice : raw) as Record<
      string,
      unknown
    >;
    const str = (k: string) => {
      const v = obj[k] ?? obj[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)];
      return v == null ? null : String(v).trim();
    };
    const amount =
      cleanAmount(str("totalAmount") || str("total") || str("amount") || str("amountDue")) || null;
    const sub =
      cleanAmount(str("subtotal") || str("subTotal") || str("sub_total")) || amount;
    const tax = cleanAmount(str("taxAmount") || str("tax") || str("vat")) || "0.00";
    const invNo = str("invoiceNumber") || str("invoice_number") || str("number") || str("id");
    const supplier =
      str("supplierName") || str("supplier") || str("vendor") || str("from") || str("legalName");
    const currency = (str("currency") || "USDC")!.toUpperCase();
    const wallet = str("paymentDestination") || str("wallet") || str("walletAddress") || str("destination");
    const po = str("purchaseOrderRef") || str("purchaseOrder") || str("po") || str("poNumber");
    const invoiceDate = normalizeDate(str("invoiceDate") || str("date"));
    const dueDate = normalizeDate(str("dueDate") || str("due"));

    let lineItems: LineItem[] = [];
    const li = obj.lineItems ?? obj.lines ?? obj.items;
    if (Array.isArray(li)) {
      lineItems = li
        .map((row) => {
          const r = row as Record<string, unknown>;
          return {
            description: String(r.description ?? r.name ?? r.item ?? "Item").slice(0, 200),
            quantity: cleanAmount(String(r.quantity ?? r.qty ?? "1")) || "1.00",
            unitPrice: cleanAmount(String(r.unitPrice ?? r.price ?? r.unit_price ?? "0")) || "0.00",
            total: cleanAmount(String(r.total ?? r.amount ?? "0")) || "0.00",
          };
        })
        .slice(0, 50);
    }

    const conf = (v: unknown, high = 0.95, low = 0.35) => (v ? high : low);
    const result: ExtractionResult = {
      invoiceNumber: field(invNo, conf(invNo), "json"),
      supplierName: field(supplier, conf(supplier, 0.9, 0.3), "json"),
      invoiceDate: field(invoiceDate, conf(invoiceDate), "json"),
      dueDate: field(dueDate, conf(dueDate, 0.85, 0.3), "json"),
      currency: field(currency.includes("USD") ? (currency === "USD" ? "USDC" : currency) : currency, 0.95, "json"),
      subtotal: field(sub, conf(sub), "json"),
      taxAmount: field(tax, 0.9, "json"),
      totalAmount: field(amount, conf(amount, 0.98, 0.2), "json"),
      purchaseOrderRef: field(po, conf(po, 0.85, 0.3), "json"),
      paymentDestination: field(
        wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet) ? wallet : wallet,
        conf(wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet || ""), 0.98, 0.2),
        "json",
      ),
      lineItems: field(lineItems, lineItems.length ? 0.9 : 0.3, "json"),
      needsReview: false,
      documentKind: "json",
    };
    result.needsReview = !amount || !invNo;
    return result;
  } catch {
    return null;
  }
}

function filenameHints(text: string): { invoiceNumber: string | null } {
  const fromMeta = text.match(/filename:([^\n]+)/i)?.[1]?.trim() || "";
  const base = fromMeta.replace(/\.[^.]+$/, "");
  const inv =
    base.match(/\b(INV[-_]?[A-Z0-9][A-Z0-9\-\/]*\d[A-Z0-9\-\/]*)\b/i)?.[1]?.replace(/\s+/g, "-").toUpperCase() ||
    base.match(/([A-Z]{2,5}[-_]\d{2,}[A-Z0-9\-]*)/i)?.[1]?.toUpperCase() ||
    null;
  return { invoiceNumber: inv };
}

/** Heuristic + JSON extraction — never auto-authorizes payment. */
export function extractInvoiceText(text: string, opts?: { documentKind?: string }): ExtractionResult {
  const kind = opts?.documentKind;
  if (kind === "json" || text.trim().startsWith("{")) {
    const fromJson = extractFromJson(text);
    if (fromJson) {
      fromJson.rawPreview = text.slice(0, 400);
      return fromJson;
    }
  }

  const normalized = text.replace(/\u0000/g, " ").replace(/[ \t]+\n/g, "\n");
  const hints = filenameHints(normalized);

  const invoiceNumber =
    firstMatch(normalized, [
      /invoice\s*(?:number|no\.?|num|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/]*\d[A-Z0-9\-\/]*)/i,
      /\b(PAY[-_]?[A-Z0-9][A-Z0-9\-\/]*\d[A-Z0-9\-\/]*)\b/i,
      /\b(INV[-_]?[A-Z0-9][A-Z0-9\-\/]*\d[A-Z0-9\-\/]*)\b/i,
      /(?:^|\n)\s*#\s*([A-Z]{2,5}-\d{2,})\s*(?:$|\n)/i,
    ]) || hints.invoiceNumber;

  const supplierNameRaw = firstMatch(normalized, [
    /(?:from|supplier|vendor|bill\s*from|sold\s*by|payee|company)\s*[:\-]\s*([A-Za-z0-9 &.,'()\-]{2,80})/i,
    /(?:^|\n)\s*([A-Z][A-Za-z0-9 &.,'()\-]{3,60})\s*(?:\n).*?(?:invoice)/i,
  ]);
  const supplierName = cleanPartyName(supplierNameRaw);

  const invoiceDate = normalizeDate(
    firstMatch(normalized, [
      /(?:invoice\s*date|issue\s*date|date\s*issued|dated?)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    ]),
  );

  const dueDate = normalizeDate(
    firstMatch(normalized, [
      /(?:due\s*date|payment\s*due|pay\s*by)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    ]),
  );

  const currencyRaw =
    firstMatch(normalized, [/\b(USDC|USD|EUR|GBP|NGN)\b/i])?.toUpperCase() || "USDC";
  const currency = currencyRaw === "USD" ? "USDC" : currencyRaw;

  const labeledTotal = pickBestAmount(normalized, [
    "grand\\s+total",
    "amount\\s+due",
    "balance\\s+due",
    "total\\s+amount\\s+due",
    "total\\s+due",
    "invoice\\s+total",
    "total\\s+amount",
    "(?<![\\w-])total(?![\\w-])",
  ]);
  const candidates = findAmountCandidates(normalized);
  // Prefer labeled totals; never let a smaller "subtotal" win when a larger due amount exists.
  const total =
    labeledTotal ||
    candidates.sort((a, b) => Number(b) - Number(a))[0] ||
    null;

  const tax =
    pickBestAmount(normalized, ["tax\\s+amount", "vat\\s+amount", "sales\\s+tax", "\\bvat\\b", "(?<![\\w-])tax(?![\\w-])"]) ||
    "0.00";
  const subtotal =
    pickBestAmount(normalized, ["sub\\s*-?\\s*total", "subtotal", "net\\s+amount"]) || total;

  const po = firstMatch(normalized, [
    /\bpurchase\s*order\s*(?:#|number|no\.?)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/]{1,40})/i,
    /\bP\.?O\.?\s*(?:#|number|no\.?)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/]*\d[A-Z0-9\-\/]*)/i,
  ]);

  const wallet = firstMatch(normalized, [
    /(?:wallet|destination|pay(?:ment)?\s*to|usdc\s*address|arc\s*address|address)\s*[:#]?\s*(0x[a-fA-F0-9]{40})/i,
    /(0x[a-fA-F0-9]{40})/,
  ]);

  const lineItems = extractLineItems(normalized);

  const conf = (v: unknown, high = 0.85, low = 0.35) => (v ? high : low);
  // Images / binary scrapes are lower confidence overall
  const kindPenalty = kind === "image" || kind === "binary" ? 0.2 : 0;
  const bump = (c: number) => Math.max(0.05, Math.min(0.99, c - kindPenalty));

  const result: ExtractionResult = {
    invoiceNumber: field(invoiceNumber, bump(conf(invoiceNumber, 0.9, 0.25))),
    supplierName: field(supplierName, bump(conf(supplierName, 0.75, 0.25))),
    invoiceDate: field(invoiceDate, bump(conf(invoiceDate))),
    dueDate: field(dueDate, bump(conf(dueDate, 0.7, 0.25))),
    currency: field(currency, bump(0.9)),
    subtotal: field(subtotal, bump(conf(subtotal))),
    taxAmount: field(tax, bump(tax === "0.00" ? 0.55 : 0.8)),
    totalAmount: field(total, bump(conf(total, 0.92, 0.15))),
    purchaseOrderRef: field(po, bump(conf(po, 0.8, 0.25))),
    paymentDestination: field(wallet, bump(conf(wallet, 0.95, 0.15))),
    lineItems: field(lineItems, bump(lineItems.length ? 0.7 : 0.2)),
    needsReview: false,
    documentKind: kind,
    rawPreview: normalized.slice(0, 500),
  };

  const criticalMissing = !total || !invoiceNumber;
  const lowConfidence = [
    result.invoiceNumber,
    result.totalAmount,
    result.supplierName,
  ].some((f) => f.confidence < 0.55);
  result.needsReview = criticalMissing || lowConfidence || kind === "image";
  return result;
}

export function extractionToMinor(amount: string | null | undefined): string | null {
  if (!amount) return null;
  try {
    return parseDecimalToMinor(amount, 6).toString();
  } catch {
    return null;
  }
}

export function minorToDecimal(amountMinor: string | null | undefined): string | null {
  if (!amountMinor) return null;
  try {
    const n = BigInt(amountMinor);
    const neg = n < 0n;
    const abs = neg ? -n : n;
    const whole = abs / 1_000_000n;
    const frac = (abs % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "") || "0";
    return `${neg ? "-" : ""}${whole}.${frac}`;
  } catch {
    return null;
  }
}
