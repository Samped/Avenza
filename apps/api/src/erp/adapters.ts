/**
 * Normalized ERP adapter interfaces.
 * Core AVENZA never depends on Odoo/ERPNext-specific structures directly.
 */

export type NormalizedSupplier = {
  externalId: string;
  legalName: string;
  email?: string;
};

export type NormalizedInvoice = {
  externalId: string;
  invoiceNumber: string;
  supplierExternalId: string;
  currency: string;
  totalAmount: string;
  invoiceDate?: string;
  purchaseOrderNumber?: string;
};

export type NormalizedPurchaseOrder = {
  externalId: string;
  purchaseOrderNumber: string;
  supplierExternalId: string;
  currency: string;
  totalAmount: string;
};

export type PaymentWriteBack = {
  externalInvoiceId: string;
  amount: string;
  currency: string;
  transactionHash: string;
  paymentId: string;
  settledAt: string;
};

export interface ErpAdapter {
  readonly provider: "odoo" | "erpnext";
  testConnection(): Promise<{ ok: boolean; detail?: string }>;
  importSuppliers(): Promise<NormalizedSupplier[]>;
  importInvoices(): Promise<NormalizedInvoice[]>;
  importPurchaseOrders(): Promise<NormalizedPurchaseOrder[]>;
  writePaymentStatus(payload: PaymentWriteBack): Promise<{ wrote: boolean; reason?: string }>;
}

function minorToMajor(minor: string) {
  const n = Number(minor) / 1e6;
  return Number.isFinite(n) ? n.toFixed(2) : minor;
}

/** Odoo JSON-RPC: authenticate + search_read account.move (vendor bills). */
export class OdooAdapter implements ErpAdapter {
  readonly provider = "odoo" as const;
  private uid: number | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly credentials: Record<string, string>,
  ) {}

  private root() {
    return this.baseUrl.replace(/\/$/, "");
  }

  private async rpc(service: string, method: string, args: unknown[]) {
    const res = await fetch(`${this.root()}/jsonrpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
        id: Date.now(),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`);
    const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
    if (json.error) throw new Error(json.error.message || "Odoo RPC error");
    return json.result;
  }

  private async ensureUid() {
    if (this.uid != null) return this.uid;
    const db = this.credentials.db || this.credentials.database || "odoo";
    const login = this.credentials.login || this.credentials.username || this.credentials.apiKey || "";
    const password = this.credentials.password || this.credentials.apiKey || "";
    if (!login) throw new Error("Odoo credentials require login/password or apiKey");
    const uid = await this.rpc("common", "authenticate", [db, login, password, {}]);
    if (!uid || typeof uid !== "number") throw new Error("Odoo authentication failed");
    this.uid = uid;
    return uid;
  }

  private async executeKw(model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) {
    const uid = await this.ensureUid();
    const db = this.credentials.db || this.credentials.database || "odoo";
    const password = this.credentials.password || this.credentials.apiKey || "";
    return this.rpc("object", "execute_kw", [db, uid, password, model, method, args, kwargs]);
  }

  async testConnection() {
    if (!this.baseUrl) return { ok: false, detail: "missing baseUrl" };
    try {
      const ver = await this.rpc("common", "version", []);
      if (this.credentials.login || this.credentials.apiKey) {
        await this.ensureUid();
      }
      return {
        ok: true,
        detail: `odoo connected${ver && typeof ver === "object" && "server_version" in (ver as object) ? ` · ${(ver as { server_version?: string }).server_version}` : ""}`,
      };
    } catch (e) {
      return { ok: false, detail: (e as Error).message };
    }
  }

  async importSuppliers(): Promise<NormalizedSupplier[]> {
    try {
      const rows = (await this.executeKw(
        "res.partner",
        "search_read",
        [[["supplier_rank", ">", 0]]],
        { fields: ["id", "name", "email"], limit: 100 },
      )) as Array<{ id: number; name: string; email?: string }>;
      return (rows || []).map((r) => ({
        externalId: String(r.id),
        legalName: r.name,
        email: r.email || undefined,
      }));
    } catch {
      return [];
    }
  }

  async importInvoices(): Promise<NormalizedInvoice[]> {
    try {
      const rows = (await this.executeKw(
        "account.move",
        "search_read",
        [[["move_type", "=", "in_invoice"], ["state", "in", ["posted", "draft"]]]],
        {
          fields: ["id", "name", "partner_id", "amount_total", "currency_id", "invoice_date", "ref"],
          limit: 50,
        },
      )) as Array<{
        id: number;
        name: string;
        partner_id?: [number, string] | false;
        amount_total: number;
        currency_id?: [number, string] | false;
        invoice_date?: string;
        ref?: string;
      }>;
      return (rows || []).map((r) => ({
        externalId: String(r.id),
        invoiceNumber: r.name || String(r.id),
        supplierExternalId: r.partner_id ? String(r.partner_id[0]) : "unknown",
        currency: r.currency_id ? String(r.currency_id[1] || "USD") : "USD",
        totalAmount: String(r.amount_total ?? 0),
        invoiceDate: r.invoice_date || undefined,
        purchaseOrderNumber: r.ref || undefined,
      }));
    } catch {
      return [];
    }
  }

  async importPurchaseOrders(): Promise<NormalizedPurchaseOrder[]> {
    try {
      const rows = (await this.executeKw(
        "purchase.order",
        "search_read",
        [[["state", "in", ["purchase", "done"]]]],
        { fields: ["id", "name", "partner_id", "amount_total", "currency_id"], limit: 50 },
      )) as Array<{
        id: number;
        name: string;
        partner_id?: [number, string] | false;
        amount_total: number;
        currency_id?: [number, string] | false;
      }>;
      return (rows || []).map((r) => ({
        externalId: String(r.id),
        purchaseOrderNumber: r.name,
        supplierExternalId: r.partner_id ? String(r.partner_id[0]) : "unknown",
        currency: r.currency_id ? String(r.currency_id[1] || "USD") : "USD",
        totalAmount: String(r.amount_total ?? 0),
      }));
    } catch {
      return [];
    }
  }

  async writePaymentStatus(payload: PaymentWriteBack) {
    try {
      // Best-effort chatter note on the vendor bill — full payment create needs company-specific journals.
      const moveId = Number(payload.externalInvoiceId);
      if (!Number.isFinite(moveId)) {
        return { wrote: false, reason: "invalid_external_invoice_id" };
      }
      await this.executeKw("account.move", "message_post", [
        [moveId],
        {
          body: `AVENZA settled ${minorToMajor(payload.amount)} ${payload.currency} on X Layer. Tx ${payload.transactionHash}. paymentId=${payload.paymentId}`,
        },
      ]);
      return { wrote: true, reason: `odoo_chatter:${payload.paymentId}` };
    } catch (e) {
      return { wrote: false, reason: (e as Error).message };
    }
  }
}

/** ERPNext REST: Purchase Invoice list + Payment Entry note. */
export class ErpNextAdapter implements ErpAdapter {
  readonly provider = "erpnext" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly credentials: Record<string, string>,
  ) {}

  private root() {
    return this.baseUrl.replace(/\/$/, "");
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
    const key = this.credentials.apiKey || this.credentials.api_key;
    const secret = this.credentials.apiSecret || this.credentials.api_secret || this.credentials.password;
    if (key && secret) {
      h.authorization = `token ${key}:${secret}`;
    } else if (this.credentials.apiKey) {
      h.authorization = `token ${this.credentials.apiKey}`;
    }
    return h;
  }

  private async get(path: string) {
    const res = await fetch(`${this.root()}${path}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`ERPNext HTTP ${res.status}`);
    return res.json() as Promise<{ data?: unknown; message?: unknown }>;
  }

  private async post(path: string, body: unknown) {
    const res = await fetch(`${this.root()}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`ERPNext HTTP ${res.status}`);
    return res.json() as Promise<{ data?: unknown; message?: unknown }>;
  }

  async testConnection() {
    if (!this.baseUrl) return { ok: false, detail: "missing baseUrl" };
    try {
      await this.get("/api/method/frappe.auth.get_logged_user");
      return { ok: true, detail: "erpnext connected" };
    } catch (e) {
      // Some sites expose resource without auth method — try a light resource ping
      try {
        await this.get("/api/resource/Purchase%20Invoice?limit_page_length=1");
        return { ok: true, detail: "erpnext resource reachable" };
      } catch {
        return { ok: false, detail: (e as Error).message };
      }
    }
  }

  async importSuppliers(): Promise<NormalizedSupplier[]> {
    try {
      const json = await this.get(
        "/api/resource/Supplier?fields=%5B%22name%22%2C%22supplier_name%22%2C%22email_id%22%5D&limit_page_length=100",
      );
      const rows = (json.data || []) as Array<{ name: string; supplier_name?: string; email_id?: string }>;
      return rows.map((r) => ({
        externalId: r.name,
        legalName: r.supplier_name || r.name,
        email: r.email_id || undefined,
      }));
    } catch {
      return [];
    }
  }

  async importInvoices(): Promise<NormalizedInvoice[]> {
    try {
      const json = await this.get(
        "/api/resource/Purchase%20Invoice?fields=%5B%22name%22%2C%22supplier%22%2C%22grand_total%22%2C%22currency%22%2C%22posting_date%22%2C%22bill_no%22%5D&filters=%5B%5B%22docstatus%22%2C%22%3D%22%2C1%5D%5D&limit_page_length=50",
      );
      const rows = (json.data || []) as Array<{
        name: string;
        supplier: string;
        grand_total: number;
        currency?: string;
        posting_date?: string;
        bill_no?: string;
      }>;
      return rows.map((r) => ({
        externalId: r.name,
        invoiceNumber: r.bill_no || r.name,
        supplierExternalId: r.supplier,
        currency: r.currency || "USD",
        totalAmount: String(r.grand_total ?? 0),
        invoiceDate: r.posting_date || undefined,
      }));
    } catch {
      return [];
    }
  }

  async importPurchaseOrders(): Promise<NormalizedPurchaseOrder[]> {
    try {
      const json = await this.get(
        "/api/resource/Purchase%20Order?fields=%5B%22name%22%2C%22supplier%22%2C%22grand_total%22%2C%22currency%22%5D&filters=%5B%5B%22docstatus%22%2C%22%3D%22%2C1%5D%5D&limit_page_length=50",
      );
      const rows = (json.data || []) as Array<{
        name: string;
        supplier: string;
        grand_total: number;
        currency?: string;
      }>;
      return rows.map((r) => ({
        externalId: r.name,
        purchaseOrderNumber: r.name,
        supplierExternalId: r.supplier,
        currency: r.currency || "USD",
        totalAmount: String(r.grand_total ?? 0),
      }));
    } catch {
      return [];
    }
  }

  async writePaymentStatus(payload: PaymentWriteBack) {
    try {
      await this.post("/api/resource/Comment", {
        reference_doctype: "Purchase Invoice",
        reference_name: payload.externalInvoiceId,
        content: `AVENZA settled ${minorToMajor(payload.amount)} ${payload.currency}. Tx ${payload.transactionHash}. avenza:${payload.paymentId}`,
        comment_type: "Comment",
      });
      return { wrote: true, reason: `erpnext_comment:${payload.paymentId}` };
    } catch (e) {
      return { wrote: false, reason: (e as Error).message };
    }
  }
}

export function createAdapter(
  provider: "odoo" | "erpnext",
  baseUrl: string,
  credentials: Record<string, string>,
): ErpAdapter {
  if (provider === "odoo") return new OdooAdapter(baseUrl, credentials);
  return new ErpNextAdapter(baseUrl, credentials);
}
