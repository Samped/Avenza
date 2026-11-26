"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, getOrgId } from "@/lib/api";
import { FundDepositModal } from "@/components/FundDepositModal";
import { InvoiceUploadModal } from "@/components/InvoiceUploadModal";
import { PayoutModal } from "@/components/PayoutModal";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  dueDate: string | null;
  totalAmountMinor: string | null;
  currency?: string | null;
  supplier?: { legalName: string } | null;
};

type Payment = {
  id: string;
  status: string;
  amountMinor: string;
  createdAt?: string;
};

type Approval = {
  id: string;
  requiredApprovals: number;
  currentApprovals: number;
  status: string;
  invoice: { id: string; invoiceNumber: string | null; totalAmountMinor: string | null };
};

type Org = {
  legalName: string;
  status: string;
  treasuryConfig?: {
    vaultAddress: string | null;
    onChainOrgId: string | null;
    fundingWalletAddress?: string | null;
  };
};

type Network = {
  chainId: number;
  usdc: string;
  settlementMode: string;
  note?: string;
  contracts: { paymentAuthorization: string | null; treasury: string | null };
};

type TreasurySummary = {
  fundingWalletAddress: string | null;
  vaultAddress: string | null;
  onChainOrgId: string | null;
  balances: {
    fundingWalletUsdcMinor: string;
    fundingWalletOkbWei: string;
    vaultAvailableUsdcMinor: string;
  };
};

type ErpConn = { id: string; provider: string; status: string; baseUrl: string };

const EXPLORER =
  process.env.NEXT_PUBLIC_EXPLORER_ADDRESS_BASE ||
  "https://www.oklink.com/x-layer-testnet/address/";

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUsdc(minor: string | null | undefined) {
  if (!minor) return "0.00";
  const n = Number(minor) / 1e6;
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysUntil(due: string | null) {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function agingBucket(due: string | null): "current" | "d1_7" | "d8_30" | "d31_60" | "d60p" | "none" {
  const days = daysUntil(due);
  if (days == null) return "none";
  if (days < 0) return "d60p";
  if (days <= 0) return "current";
  if (days <= 7) return "d1_7";
  if (days <= 30) return "d8_30";
  if (days <= 60) return "d31_60";
  return "d60p";
}

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (["COMPLETED", "PAYMENT_CONFIRMED", "VERIFIED", "APPROVED"].includes(s)) return "ok";
  if (["PENDING", "PENDING_APPROVAL", "SUBMITTED", "DRAFT", "EXTRACTED"].includes(s)) return "wait";
  if (["REJECTED", "FAILED", "CANCELLED"].includes(s)) return "bad";
  return "neutral";
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [org, setOrg] = useState<Org | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [treasury, setTreasury] = useState<TreasurySummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [erp, setErp] = useState<ErpConn[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fundOpen, setFundOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutMode, setPayoutMode] = useState<"direct" | "group">("direct");

  function openPayout(mode: "direct" | "group") {
    setPayoutMode(mode);
    setPayoutOpen(true);
  }

  async function refresh() {
    const orgId = getOrgId();
    if (!orgId) return;
    setLoading(true);
    try {
      const [o, n, treas, inv, sup, pay, appr, connections] = await Promise.all([
        api<Org>(`/organizations/${orgId}`, { orgId }),
        api<Network>(`/organizations/${orgId}/payments/network`, { orgId }),
        api<TreasurySummary>(`/organizations/${orgId}/treasury`, { orgId }).catch(() => null),
        api<Invoice[]>(`/organizations/${orgId}/invoices`, { orgId }),
        api<unknown[]>(`/organizations/${orgId}/suppliers`, { orgId }),
        api<Payment[]>(`/organizations/${orgId}/payments`, { orgId }),
        api<Approval[]>(`/organizations/${orgId}/approvals`, { orgId }).catch(() => []),
        api<ErpConn[]>(`/organizations/${orgId}/erp`, { orgId }).catch(() => []),
      ]);
      setOrg(o);
      setNetwork(n);
      setTreasury(treas);
      setInvoices(inv);
      setSuppliers(sup.length);
      setPayments(pay);
      setApprovals(appr);
      setErp(connections);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const fundingWallet =
    treasury?.fundingWalletAddress || org?.treasuryConfig?.fundingWalletAddress || null;

  const vault =
    treasury?.vaultAddress ||
    org?.treasuryConfig?.vaultAddress ||
    network?.contracts.treasury ||
    null;

  const pulse = useMemo(() => {
    const pendingApprovals = approvals.filter((a) => a.status === "pending" || a.status === "PENDING").length;
    const needsReview = invoices.filter((i) =>
      ["DRAFT", "EXTRACTED", "NEEDS_REVIEW", "UPLOADED"].includes(i.status.toUpperCase()),
    ).length;
    const readyPay = invoices.filter((i) =>
      ["APPROVED", "READY_TO_PAY", "PAYMENT_QUEUED"].includes(i.status.toUpperCase()),
    ).length;
    const settled = payments.filter((p) =>
      ["COMPLETED", "PAYMENT_CONFIRMED"].includes(p.status.toUpperCase()),
    ).length;
    const openMinor = invoices
      .filter((i) => !["PAID", "CANCELLED", "REJECTED"].includes(i.status.toUpperCase()))
      .reduce((sum, i) => sum + Number(i.totalAmountMinor || 0), 0);
    return { pendingApprovals, needsReview, readyPay, settled, openMinor };
  }, [approvals, invoices, payments]);

  const aging = useMemo(() => {
    const buckets = { current: 0, d1_7: 0, d8_30: 0, d31_60: 0, d60p: 0 };
    for (const inv of invoices) {
      if (["PAID", "CANCELLED", "REJECTED", "COMPLETED"].includes(inv.status.toUpperCase())) continue;
      const b = agingBucket(inv.dueDate);
      const amt = Number(inv.totalAmountMinor || 0);
      if (b === "none" || b === "current") buckets.current += amt;
      else buckets[b] += amt;
    }
    return buckets;
  }, [invoices]);

  const agingMax = Math.max(1, ...Object.values(aging));

  const upcomingPayouts = useMemo(() => {
    return invoices
      .filter((i) => i.dueDate && !["PAID", "CANCELLED", "REJECTED"].includes(i.status.toUpperCase()))
      .map((i) => ({ ...i, days: daysUntil(i.dueDate) }))
      .filter((i) => i.days != null)
      .sort((a, b) => a.days! - b.days!)
      .slice(0, 5);
  }, [invoices]);

  const attention = useMemo(() => {
    const items: Array<{ kind: string; title: string; meta: string; href: string }> = [];
    for (const a of approvals.slice(0, 4)) {
      items.push({
        kind: "Approval",
        title: a.invoice.invoiceNumber || a.invoice.id.slice(0, 8),
        meta: `${a.currentApprovals}/${a.requiredApprovals} · ${formatUsdc(a.invoice.totalAmountMinor)} USDC`,
        href: `/app/invoices/${a.invoice.id}`,
      });
    }
    for (const inv of invoices
      .filter((i) => ["DRAFT", "EXTRACTED", "NEEDS_REVIEW"].includes(i.status.toUpperCase()))
      .slice(0, 4)) {
      items.push({
        kind: "Review",
        title: inv.invoiceNumber || inv.id.slice(0, 8),
        meta: `${inv.status} · ${inv.supplier?.legalName || "Supplier"}`,
        href: `/app/invoices/${inv.id}`,
      });
    }
    return items.slice(0, 5);
  }, [approvals, invoices]);

  const paymentBars = useMemo(() => {
    const done = payments.filter((p) =>
      ["COMPLETED", "PAYMENT_CONFIRMED"].includes(p.status.toUpperCase()),
    ).length;
    const open = payments.filter((p) =>
      ["SUBMITTED", "PAYMENT_SUBMITTED", "AUTHORIZED", "PENDING", "SETTLING"].includes(p.status.toUpperCase()),
    ).length;
    const failed = payments.filter((p) =>
      ["FAILED", "PAYMENT_FAILED", "CANCELLED", "REJECTED"].includes(p.status.toUpperCase()),
    ).length;
    const max = Math.max(1, done, open, failed);
    return [
      { label: "Settled", value: done, pct: Math.round((done / max) * 100) },
      { label: "In flight", value: open, pct: Math.round((open / max) * 100) },
      { label: "Failed", value: failed, pct: Math.round((failed / max) * 100) },
    ];
  }, [payments]);

  const agingBars = useMemo(
    () =>
      [
        { label: "Now", value: aging.current },
        { label: "1–7d", value: aging.d1_7 },
        { label: "8–30d", value: aging.d8_30 },
        { label: "31–60d", value: aging.d31_60 },
        { label: "60d+", value: aging.d60p },
      ].map((b) => ({
        ...b,
        pct: Math.round((b.value / agingMax) * 100),
        display: formatUsdc(String(b.value)),
      })),
    [aging, agingMax],
  );

  async function copyFunding() {
    if (!fundingWallet) return;
    await navigator.clipboard.writeText(fundingWallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const attentionCount = pulse.pendingApprovals + pulse.needsReview + pulse.readyPay;
  const kpis = [
    { label: "Approvals", value: String(pulse.pendingApprovals), href: "/app/approvals", hint: "Waiting on you" },
    { label: "In review", value: String(pulse.needsReview), href: "/app/invoices", hint: "Extraction / draft" },
    { label: "Ready to pay", value: String(pulse.readyPay), href: "/app/payments", hint: "Approved invoices" },
    {
      label: "Open payable",
      value: formatUsdc(String(pulse.openMinor)),
      suffix: "USDC",
      href: "/app/invoices",
      hint: "Across open invoices",
    },
  ] as const;

  return (
    <div className="home">
      <header className="home-top">
        <div className="home-top-copy">
          <p className="home-greeting">
            <span className={`home-live${attentionCount ? " is-alert" : ""}`} />
            {loading
              ? t("pages.syncing")
              : `${(() => {
                  const h = new Date().getHours();
                  if (h < 12) return t("pages.goodMorning");
                  if (h < 18) return t("pages.goodAfternoon");
                  return t("pages.goodEvening");
                })()} · ${
                  attentionCount
                    ? `${attentionCount} ${t("pages.needAttention")}`
                    : t("pages.allClear")
                }`}
          </p>
          <h1 className="home-title">{org?.legalName || t("pages.workspaceFallback")}</h1>
          <p className="home-lead">{t("pages.overviewLead")}</p>
        </div>
        <div className="home-actions">
          <button type="button" className="home-btn home-btn-dark" onClick={() => openPayout("direct")}>
            {t("pages.payClient")}
          </button>
          <button type="button" className="home-btn home-btn-line" onClick={() => openPayout("group")}>
            {t("pages.groupPay")}
          </button>
          <button type="button" className="home-btn home-btn-line" onClick={() => setInvoiceOpen(true)}>
            {t("pages.newInvoice")}
          </button>
        </div>
      </header>

      <section className="home-kpis">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="home-kpi">
            <span>{k.label}</span>
            <strong>
              {k.value}
              {"suffix" in k && k.suffix ? <small>{k.suffix}</small> : null}
            </strong>
            <em>{k.hint}</em>
          </Link>
        ))}
      </section>

      <section className="home-board">
        <div className="home-board-main">
          <article className="home-card home-treasury">
            <div className="home-card-head">
              <div>
                <p className="home-kicker">Treasury</p>
                <h2>Funding wallet</h2>
              </div>
              <button type="button" className="home-btn home-btn-dark home-btn-sm" onClick={() => setFundOpen(true)}>
                Deposit
              </button>
            </div>
            <div className="home-treasury-grid">
              <div className="home-treasury-primary">
                <p className="home-wallet-addr">{fundingWallet ? shortAddr(fundingWallet) : "—"}</p>
                <p className="home-wallet-full">{fundingWallet || "Provisioning unique wallet for this org…"}</p>
                <div className="home-wallet-cta">
                  <button type="button" className="home-chip" onClick={copyFunding} disabled={!fundingWallet}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                  {fundingWallet ? (
                    <a className="home-chip" href={`${EXPLORER}${fundingWallet}`} target="_blank" rel="noreferrer">
                      Explorer
                    </a>
                  ) : null}
                  <button type="button" className="home-chip" onClick={() => setFundOpen(true)}>
                    Fund
                  </button>
                </div>
              </div>
              <div className="home-treasury-bals">
                <div>
                  <span>Wallet</span>
                  <strong>{treasury ? formatUsdc(treasury.balances.fundingWalletUsdcMinor) : "—"}</strong>
                  <em>USDC</em>
                </div>
                <div>
                  <span>Vault</span>
                  <strong>{treasury ? formatUsdc(treasury.balances.vaultAvailableUsdcMinor) : "—"}</strong>
                  <em>USDC</em>
                </div>
                <div>
                  <span>Network</span>
                  <strong>X Layer {network?.chainId ?? "—"}</strong>
                  <em>{network?.settlementMode ?? "—"}</em>
                </div>
                <div>
                  <span>Vault addr</span>
                  <strong className="font-mono">{vault ? shortAddr(vault) : "—"}</strong>
                  <em>
                    {suppliers} payees · {erp.length} ERP
                  </em>
                </div>
              </div>
            </div>
          </article>

          <article className="home-card home-charts">
            <div className="home-card-head">
              <div>
                <p className="home-kicker">Analytics</p>
                <h2>Settlement & aging</h2>
              </div>
            </div>
            <div className="home-charts-grid">
              <div className="home-chart">
                <p className="home-chart-title">Payments by status</p>
                <div className="home-vbars" role="img" aria-label="Payment status chart">
                  {paymentBars.map((b) => (
                    <div key={b.label} className="home-vbar">
                      <div className="home-vbar-track">
                        <i style={{ height: `${Math.max(b.value ? 8 : 2, b.pct)}%` }} />
                      </div>
                      <strong>{b.value}</strong>
                      <span>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="home-chart">
                <p className="home-chart-title">Payables by age</p>
                <div className="home-hbars" role="img" aria-label="Aging chart">
                  {agingBars.map((b) => (
                    <div key={b.label} className="home-hbar">
                      <span>{b.label}</span>
                      <div className="home-hbar-track">
                        <i style={{ width: `${b.value === 0 ? 0 : Math.max(4, b.pct)}%` }} />
                      </div>
                      <strong>{b.display}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="home-card">
            <div className="home-card-head">
              <div>
                <p className="home-kicker">Queue</p>
                <h2>Needs you</h2>
              </div>
              <Link href="/app/approvals" className="home-link">
                Open queue
              </Link>
            </div>
            {attention.length === 0 ? (
              <div className="home-empty">
                <p>Nothing waiting — upload an invoice or pay a client.</p>
                <div className="home-empty-actions">
                  <button type="button" className="home-btn home-btn-dark home-btn-sm" onClick={() => setInvoiceOpen(true)}>
                    Upload invoice
                  </button>
                  <button type="button" className="home-btn home-btn-line home-btn-sm" onClick={() => openPayout("direct")}>
                    Pay client
                  </button>
                </div>
              </div>
            ) : (
              <ul className="home-work">
                {attention.map((item, idx) => (
                  <li key={`${item.href}-${idx}`} className="home-work-card">
                    <Link href={item.href}>
                      <span className="home-badge">{item.kind}</span>
                      <strong>{item.title}</strong>
                      <em>{item.meta}</em>
                      <span className="home-work-cta">Open</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="home-card home-ledger">
            <div className="home-card-head">
              <div>
                <p className="home-kicker">Activity</p>
                <h2>Recent invoices</h2>
              </div>
              <Link href="/app/invoices" className="home-link">
                View all
              </Link>
            </div>
            <div className="home-table-wrap">
              <table className="home-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Supplier</th>
                    <th>Amount</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 8).map((inv) => {
                    const days = daysUntil(inv.dueDate);
                    return (
                      <tr key={inv.id}>
                        <td>
                          <Link href={`/app/invoices/${inv.id}`}>{inv.invoiceNumber || inv.id.slice(0, 8)}</Link>
                        </td>
                        <td>{inv.supplier?.legalName || "—"}</td>
                        <td className="num">{formatUsdc(inv.totalAmountMinor)}</td>
                        <td>
                          {days == null
                            ? "—"
                            : days < 0
                              ? `${Math.abs(days)}d late`
                              : days === 0
                                ? "Today"
                                : `${days}d`}
                        </td>
                        <td>
                          <span className={`home-status home-status--${statusTone(inv.status)}`}>{inv.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && invoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="home-table-empty">
                        No invoices yet.{" "}
                        <button type="button" className="home-link-btn" onClick={() => setInvoiceOpen(true)}>
                          Upload one
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <aside className="home-board-side">
          <article className="home-card">
            <div className="home-card-head">
              <div>
                <p className="home-kicker">Schedule</p>
                <h2>Next due</h2>
              </div>
              <Link href="/app/payments" className="home-link">
                Payments
              </Link>
            </div>
            <div className="home-due">
              {upcomingPayouts.length === 0 ? (
                <p className="home-muted">No dated payables yet.</p>
              ) : (
                <ul>
                  {upcomingPayouts.map((inv) => (
                    <li key={inv.id}>
                      <Link href={`/app/invoices/${inv.id}`}>
                        <span>{inv.invoiceNumber || inv.id.slice(0, 8)}</span>
                        <span>
                          {inv.days! < 0
                            ? `${Math.abs(inv.days!)}d late`
                            : inv.days === 0
                              ? "Today"
                              : `${inv.days}d`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          <article className="home-card home-actions-card">
            <div className="home-card-head">
              <div>
                <p className="home-kicker">Shortcuts</p>
                <h2>Move faster</h2>
              </div>
            </div>
            <div className="home-shortcuts">
              <button type="button" className="home-shortcut" onClick={() => openPayout("direct")}>
                <span>01</span>
                <div>
                  <strong>Pay client</strong>
                  <em>Individual USDC payout</em>
                </div>
              </button>
              <button type="button" className="home-shortcut" onClick={() => openPayout("group")}>
                <span>02</span>
                <div>
                  <strong>Group pay</strong>
                  <em>Batch settle multiple</em>
                </div>
              </button>
              <button type="button" className="home-shortcut" onClick={() => setInvoiceOpen(true)}>
                <span>03</span>
                <div>
                  <strong>Upload</strong>
                  <em>New invoice</em>
                </div>
              </button>
              <Link href="/app/settings?tab=workspace" className="home-shortcut">
                <span>04</span>
                <div>
                  <strong>Fund</strong>
                  <em>Wallet · vault</em>
                </div>
              </Link>
            </div>
          </article>
        </aside>
      </section>

      <FundDepositModal
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        initial={treasury}
        onDeposited={() => {
          refresh();
        }}
      />
      <InvoiceUploadModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        onCreated={() => {
          refresh();
        }}
      />
      <PayoutModal
        open={payoutOpen}
        initialMode={payoutMode}
        onClose={() => setPayoutOpen(false)}
        onPaid={() => {
          refresh();
        }}
      />
    </div>
  );
}
