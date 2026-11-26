/**
 * Turn an uploaded invoice blob into extractable text.
 * Supports JSON, plain text, PDF (pdf-parse + literal-string fallback), and binary scrape.
 */

export type DocumentText = {
  text: string;
  kind: "json" | "text" | "pdf" | "image" | "binary";
  meta?: Record<string, unknown>;
};

function looksLikePdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

function printableRatio(buf: Buffer): number {
  if (!buf.length) return 0;
  let ok = 0;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i]!;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) ok++;
  }
  return ok / buf.length;
}

/** Decode PDF literal string escapes: \( \) \\ \n \r \t \ddd */
function decodePdfLiteral(raw: string): string {
  return raw
    .replace(/\\([nrtbf()\\])/g, (_, ch: string) => {
      const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
      return map[ch] ?? ch;
    })
    .replace(/\\(\d{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Pull human text from PDF content operators: (Hello) Tj  /  [(Hello) 10 (World)] TJ
 * Works even when pdf-parse fails on simple/hand-built PDFs.
 */
export function extractPdfLiteralStrings(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const lines: string[] = [];

  const tj = /\((?:\\.|[^\\)])*\)\s*Tj/gi;
  let m: RegExpExecArray | null;
  while ((m = tj.exec(raw))) {
    const inner = m[0].replace(/\)\s*Tj$/i, "").replace(/^\(/, "");
    const decoded = decodePdfLiteral(inner).trim();
    if (decoded) lines.push(decoded);
  }

  const tjArray = /\[((?:\\.|[^\]])*)\]\s*TJ/gi;
  while ((m = tjArray.exec(raw))) {
    const chunk = m[1] || "";
    const parts = [...chunk.matchAll(/\((?:\\.|[^\\)])*\)/g)].map((p) =>
      decodePdfLiteral(p[0].slice(1, -1)),
    );
    const joined = parts.join("").trim();
    if (joined) lines.push(joined);
  }

  // Quote operator: (text) '
  const quote = /\((?:\\.|[^\\)])*\)\s*'/g;
  while ((m = quote.exec(raw))) {
    const inner = m[0].replace(/\)\s*'$/, "").replace(/^\(/, "");
    const decoded = decodePdfLiteral(inner).trim();
    if (decoded) lines.push(decoded);
  }

  return [...new Set(lines)].join("\n");
}

/** Strip PDF structural noise from a scrape so heuristics don't pick up "Inc) Tj". */
export function cleanPdfArtifacts(text: string): string {
  return text
    .replace(/\)\s*Tj\b/gi, "")
    .replace(/\bT\*\b/g, "\n")
    .replace(/\bET\b|\bBT\b|\bendobj\b|\bendstream\b|\bstream\b/gi, "\n")
    .replace(/%PDF-[\d.]+/g, "")
    .replace(/\b\d+\s+\d+\s+obj\b/gi, "")
    .replace(/\/[A-Za-z]+\b/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Pull readable ASCII/UTF-8 runs from binary (weak OCR stand-in). */
function scrapeStrings(buf: Buffer, minLen = 4): string {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i]!;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) {
      cur += String.fromCharCode(c);
    } else if (cur.length >= minLen) {
      parts.push(cur.trim());
      cur = "";
    } else {
      cur = "";
    }
  }
  if (cur.length >= minLen) parts.push(cur.trim());
  return cleanPdfArtifacts(parts.filter(Boolean).join("\n"));
}

async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    // Prefer deep entry to avoid pdf-parse test-file side effects in some installs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
      data: Buffer,
    ) => Promise<{ text?: string; numpages?: number }>;
    const parsed = await pdfParse(buf);
    const text = (parsed.text || "").replace(/\u0000/g, " ").trim();
    if (text.length > 12) return cleanPdfArtifacts(text);
  } catch {
    // fall through
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (data: Buffer) => Promise<{ text?: string }>;
    const parsed = await pdfParse(buf);
    const text = (parsed.text || "").replace(/\u0000/g, " ").trim();
    if (text.length > 12) return cleanPdfArtifacts(text);
  } catch {
    // fall through to literal extraction
  }
  return "";
}

export async function bufferToDocumentText(buf: Buffer, filename = ""): Promise<DocumentText> {
  const lower = filename.toLowerCase();

  if (looksLikePdf(buf) || lower.endsWith(".pdf")) {
    const literals = extractPdfLiteralStrings(buf);
    let parsed = "";
    let parseError: string | undefined;
    try {
      parsed = await extractPdfText(buf);
    } catch (err) {
      parseError = String((err as Error).message || err);
    }

    // Prefer literal strings when they look like an invoice (Vendor/Invoice/Total).
    const literalScore =
      (/\binvoice\b/i.test(literals) ? 2 : 0) +
      (/\b(vendor|supplier|from|total|usdc)\b/i.test(literals) ? 2 : 0) +
      Math.min(3, literals.split("\n").length);
    const parsedScore =
      (/\binvoice\b/i.test(parsed) ? 2 : 0) +
      (/\b(vendor|supplier|from|total|usdc)\b/i.test(parsed) ? 2 : 0) +
      Math.min(3, parsed.split(/\s+/).length > 5 ? 3 : 1);

    let text = "";
    let method = "empty";
    if (literals.length > 10 && literalScore >= parsedScore) {
      text = literals;
      method = "pdf-literals";
    } else if (parsed.length > 10) {
      text = parsed;
      method = "pdf-parse";
    } else if (literals.length > 0) {
      text = literals;
      method = "pdf-literals";
    } else {
      text = scrapeStrings(buf);
      method = "scrape";
    }

    if (filename) text = `${text}\nfilename:${filename}`;
    return {
      text: cleanPdfArtifacts(text),
      kind: "pdf",
      meta: { filename, method, parseError },
    };
  }

  const asUtf8 = buf.toString("utf8");
  if (
    printableRatio(buf) > 0.85 ||
    lower.endsWith(".txt") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".json")
  ) {
    if (looksLikeJson(asUtf8) || lower.endsWith(".json")) {
      return { text: asUtf8, kind: "json", meta: { filename } };
    }
    return { text: asUtf8, kind: "text", meta: { filename } };
  }

  const isImage =
    lower.match(/\.(png|jpe?g|webp|gif|tif{1,2})$/) ||
    buf.subarray(0, 8).toString("hex").startsWith("89504e47") ||
    buf.subarray(0, 3).toString("hex") === "ffd8ff" ||
    buf.subarray(0, 4).toString("ascii") === "RIFF";

  const scraped = scrapeStrings(buf);
  const hint = filename ? `filename:${filename}` : "";
  return {
    text: [scraped, hint].filter(Boolean).join("\n"),
    kind: isImage ? "image" : "binary",
    meta: {
      filename,
      note: isImage ? "Image upload — use structured JSON/PDF/text for best extraction" : undefined,
    },
  };
}
