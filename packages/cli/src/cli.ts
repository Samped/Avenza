#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Config = {
  apiUrl: string;
  apiKey?: string;
  token?: string;
  orgId?: string;
};

const CONFIG_DIR = join(homedir(), ".avenza");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return { apiUrl: process.env.AVENZA_API_URL || "http://127.0.0.1:3001/api/v1" };
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Config;
}

function saveConfig(cfg: Config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; config?: Config } = {},
): Promise<T> {
  const cfg = opts.config || loadConfig();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
  else if (cfg.token) headers.authorization = `Bearer ${cfg.token}`;
  if (cfg.orgId) headers["x-organization-id"] = cfg.orgId;

  const res = await fetch(`${cfg.apiUrl.replace(/\/$/, "")}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : text || res.statusText;
    throw new Error(`${res.status} ${msg}`);
  }
  return data as T;
}

function orgPath(suffix: string, cfg: Config) {
  if (!cfg.orgId) throw new Error("Set org with: avenza config set --org <id>");
  return `/organizations/${cfg.orgId}${suffix}`;
}

const program = new Command();
program.name("avenza").description("AVENZA Partner CLI — on-chain controls + X Layer settlement").version("0.1.0");

program
  .command("config")
  .description("Show or set CLI config")
  .option("--api-url <url>")
  .option("--api-key <key>")
  .option("--token <jwt>")
  .option("--org <orgId>")
  .action((opts) => {
    const cfg = loadConfig();
    if (opts.apiUrl) cfg.apiUrl = opts.apiUrl;
    if (opts.apiKey) cfg.apiKey = opts.apiKey;
    if (opts.token) cfg.token = opts.token;
    if (opts.org) cfg.orgId = opts.org;
    if (opts.apiUrl || opts.apiKey || opts.token || opts.org) {
      saveConfig(cfg);
      console.log("Saved", CONFIG_PATH);
    }
    console.log(JSON.stringify({ ...cfg, apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 12)}…` : undefined, token: cfg.token ? "[set]" : undefined }, null, 2));
  });

program
  .command("invoices")
  .description("List invoices")
  .action(async () => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api("/invoices", { config: cfg })
      : await api(orgPath("/invoices", cfg), { config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("invoice")
  .argument("<id>")
  .description("Get invoice")
  .action(async (id: string) => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api(`/invoices/${id}`, { config: cfg })
      : await api(orgPath(`/invoices/${id}`, cfg), { config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("approvals")
  .description("List pending approvals")
  .action(async () => {
    const cfg = loadConfig();
    const data = await api(orgPath("/approvals", cfg), { config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("approve")
  .argument("<requestId>")
  .option("--note <note>")
  .description("Approve an approval request")
  .action(async (requestId: string, opts: { note?: string }) => {
    const cfg = loadConfig();
    const body = { note: opts.note };
    const data = cfg.apiKey
      ? await api(`/approvals/${requestId}/decide`, { method: "POST", body: { decision: "approve", ...body }, config: cfg })
      : await api(orgPath(`/approvals/${requestId}/approve`, cfg), {
          method: "POST",
          body,
          config: cfg,
        });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("payments")
  .description("List payments")
  .action(async () => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api("/payments", { config: cfg })
      : await api(orgPath("/payments", cfg), { config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("settle")
  .argument("<paymentId>")
  .description("Settle payment on-chain (ControlsRegistry + PaymentAuthorization)")
  .action(async (paymentId: string) => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api(`/payments/${paymentId}/settle`, { method: "POST", config: cfg })
      : await api(orgPath(`/payments/${paymentId}/execute`, cfg), {
          method: "POST",
          config: cfg,
        });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("pay-direct")
  .requiredOption("--payee <supplierId>")
  .requiredOption("--amount <usdc>")
  .option("--destination <destinationId>")
  .option("--memo <memo>")
  .option("--key <idempotencyKey>")
  .description("Create a direct payout to a verified client/business/supplier (no invoice)")
  .action(async (opts: {
    payee: string;
    amount: string;
    destination?: string;
    memo?: string;
    key?: string;
  }) => {
    const cfg = loadConfig();
    const usdc = Number(opts.amount);
    if (!Number.isFinite(usdc) || usdc <= 0) throw new Error("--amount must be a positive USDC amount");
    const amountMinor = String(Math.round(usdc * 1e6));
    const body = {
      supplierId: opts.payee,
      destinationId: opts.destination,
      amountMinor,
      memo: opts.memo,
      idempotencyKey: opts.key || `cli-direct-${Date.now()}`,
    };
    const data = cfg.apiKey
      ? await api("/payments/direct", { method: "POST", body, config: cfg })
      : await api(orgPath("/payments/direct", cfg), { method: "POST", body, config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("pay-approve")
  .argument("<paymentId>")
  .option("--note <note>")
  .description("Approve a direct payout")
  .action(async (paymentId: string, opts: { note?: string }) => {
    const cfg = loadConfig();
    const body = { decision: "approve", note: opts.note };
    const data = cfg.apiKey
      ? await api(`/payments/${paymentId}/approve`, { method: "POST", body, config: cfg })
      : await api(orgPath(`/payments/${paymentId}/approve`, cfg), { method: "POST", body, config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("batches")
  .description("List group payment batches")
  .action(async () => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api("/payments/batches", { config: cfg })
      : await api(orgPath("/payments/batches", cfg), { config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("batch-create")
  .requiredOption("--lines <json>", "JSON array of {supplierId,amountMinor,destinationId?,memo?}")
  .option("--memo <memo>")
  .option("--key <idempotencyKey>")
  .description("Create a group payment to multiple clients/businesses")
  .action(async (opts: { lines: string; memo?: string; key?: string }) => {
    const cfg = loadConfig();
    let lines: unknown;
    try {
      lines = JSON.parse(opts.lines);
    } catch {
      throw new Error("--lines must be valid JSON");
    }
    const body = {
      lines,
      memo: opts.memo,
      idempotencyKey: opts.key || `cli-batch-${Date.now()}`,
    };
    const data = cfg.apiKey
      ? await api("/payments/batches", { method: "POST", body, config: cfg })
      : await api(orgPath("/payments/batches", cfg), { method: "POST", body, config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("batch-approve")
  .argument("<batchId>")
  .option("--note <note>")
  .description("Approve a group payment batch")
  .action(async (batchId: string, opts: { note?: string }) => {
    const cfg = loadConfig();
    const body = { decision: "approve", note: opts.note };
    const data = cfg.apiKey
      ? await api(`/payments/batches/${batchId}/approve`, { method: "POST", body, config: cfg })
      : await api(orgPath(`/payments/batches/${batchId}/approve`, cfg), {
          method: "POST",
          body,
          config: cfg,
        });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("batch-settle")
  .argument("<batchId>")
  .description("Authorize + settle every line in a group payment (fail-closed per line)")
  .action(async (batchId: string) => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api(`/payments/batches/${batchId}/settle`, { method: "POST", config: cfg })
      : await api(orgPath(`/payments/batches/${batchId}/settle`, cfg), {
          method: "POST",
          config: cfg,
        });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("suppliers")
  .description("List payees (suppliers, clients, businesses)")
  .action(async () => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api("/suppliers", { config: cfg })
      : await api(orgPath("/suppliers", cfg), { config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("treasury")
  .description("Show treasury snapshot")
  .action(async () => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api("/treasury", { config: cfg })
      : await api(orgPath("/treasury", cfg), { config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("controls")
  .description("Show active on-chain controls")
  .action(async () => {
    const cfg = loadConfig();
    const data = await api(orgPath("/controls", cfg), { config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("verify")
  .argument("<invoiceId>")
  .description("Verify an invoice (Partner API)")
  .action(async (invoiceId: string) => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api(`/invoices/${invoiceId}/verify`, { method: "POST", config: cfg })
      : await api(orgPath(`/invoices/${invoiceId}/verify`, cfg), { method: "POST", config: cfg });
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("submit-approval")
  .argument("<invoiceId>")
  .description("Submit invoice for approval")
  .action(async (invoiceId: string) => {
    const cfg = loadConfig();
    const data = cfg.apiKey
      ? await api(`/invoices/${invoiceId}/submit-approval`, { method: "POST", config: cfg })
      : await api(orgPath(`/approvals/submit/${invoiceId}`, cfg), {
          method: "POST",
          config: cfg,
        });
    console.log(JSON.stringify(data, null, 2));
  });

program.parseAsync(process.argv).catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
