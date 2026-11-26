"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, getOrgId } from "@/lib/api";
import { DashEmpty, DashHeader, DashPage, DashStatus } from "@/components/dash";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Payment = {
  id: string;
  status: string;
  kind?: string;
  amountMinor: string;
  currency: string;
  transactionHash: string | null;
  authorizationTxHash?: string | null;
  authorizationId?: string | null;
  policyVersion?: number | null;
  memo?: string | null;
  invoice?: { invoiceNumber: string | null };
  supplier?: { legalName: string; payeeType?: string } | null;
};

type Payee = {
  id: string;
  legalName: string;
  payeeType?: string;
  verificationStatus: string;
  paymentDestinations?: Array<{
    id: string;
    walletAddress: string;
    verificationStatus: string;
  }>;
};

type Batch = {
  id: string;
  status: string;
  memo?: string | null;
  totalAmountMinor: string;
  lineCount: number;
  requiredApprovals: number;
  currentApprovals: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  totalAmountMinor: string | null;
  supplier?: { legalName: string } | null;
};

type Network = {
  settlementMode: string;
  chainId: number;
  explorerTxBase: string;
  tapeOut: { paymentLimitCircuitId: string; explorerProcessor: string };
  fees?: {
    enabled: boolean;
    platformFeeBps?: number;
    platformFeeFlatMinor?: string;
    gasRecoveryUsdcMinor?: string;
    recipient?: string | null;
    example100Usdc?: {
      platformFeeMinor: string;
      gasRecoveryMinor: string;
      totalFeesMinor: string;
      totalDebitMinor: string;
    };
    note?: string;
  };
};

type AuthorizeResult = {
  payment: Payment;
  evaluation: {
    policyPass: boolean;
    tapeOut?: {
      mode: string;
      circuitId: string;
      inputs: string;
      pass: boolean;
      chainId: number;
    };
  };
};

type ExecuteResult = Payment & {
  settlement?: {
    chainId: number;
    policyVersion: number;
    authorizationId: string;
    authorizationTxHash: string;
    transactionHash: string;
    fees?: {
      platformFeeMinor: string;
      gasRecoveryMinor: string;
      totalFeesMinor: string;
      totalDebitMinor: string;
      feeTxHash: string | null;
      feeCollectionError: string | null;
    };
    explorer: { authorize: string; settle: string; fee?: string | null };
  };
};

type FlowStep = "idle" | "create" | "authorize" | "execute" | "confirm" | "done" | "error";
type Mode = "invoice" | "direct" | "group";

function statusTone(status: string): "ok" | "wait" | "bad" | "neutral" {
  const s = status.toUpperCase();
  if (["COMPLETED", "PAYMENT_CONFIRMED"].includes(s)) return "ok";
  if (["PENDING", "SUBMITTED", "AUTHORIZED", "PAYMENT_SUBMITTED", "APPROVED", "AWAITING_APPROVAL", "SETTLING"].includes(s))
    return "wait";
  if (["FAILED", "REJECTED", "CANCELLED", "PAYMENT_FAILED", "POLICY_REJECTED", "PARTIAL_FAILED"].includes(s))
    return "bad";
  return "neutral";
}

function formatUsdc(minor: string | null | undefined) {
  if (!minor) return "—";
  return (Number(minor) / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortHash(hash: string | null | undefined, size = 6) {
  if (!hash) return "—";
  if (hash.length <= size * 2 + 2) return hash;
  return `${hash.slice(0, size + 2)}…${hash.slice(-size)}`;
}

function txHref(base: string | undefined, hash: string | null | undefined) {
  if (!hash || hash.startsWith("0xsim")) return undefined;
  const root = (base || "https://www.oklink.com/xlayer-test/tx").replace(/\/$/, "");
  return `${root}/${hash}`;
}

const FLOW_LABELS: Record<Exclude<FlowStep, "idle" | "error" | "done">, string> = {
  create: "Create",
  authorize: "Policy",
  execute: "Settle",
  confirm: "Confirm",
};

export default function PaymentsPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("invoice");
  const [items, setItems] = useState<Payment[]>([]);
  const [ready, setReady] = useState<Invoice[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [network, setNetwork] = useState<Network | null>(null);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "bad" | "wait" | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("idle");
  const [lastSettlement, setLastSettlement] = useState<ExecuteResult["settlement"] | null>(null);
  const [flowLabel, setFlowLabel] = useState("");

  const [directPayeeId, setDirectPayeeId] = useState("");
  const [directAddress, setDirectAddress] = useState("");
  const [directAmount, setDirectAmount] = useState("");
  const [directMemo, setDirectMemo] = useState("");
  const [batchMemo, setBatchMemo] = useState("");
  const [batchLines, setBatchLines] = useState<Array<{ supplierId: string; amount: string }>>([
    { supplierId: "", amount: "" },
    { supplierId: "", amount: "" },
  ]);

  const live = Boolean(busyId) && flowStep !== "idle" && flowStep !== "done" && flowStep !== "error";
  const onchain = network?.settlementMode === "onchain";

  async function load() {
    const orgId = getOrgId()!;
    const [payments, net, invoices, suppliers, batchList] = await Promise.all([
      api<Payment[]>(`/organizations/${orgId}/payments`, { orgId }),
      api<Network>(`/organizations/${orgId}/payments/network`, { orgId }),
      api<Invoice[]>(`/organizations/${orgId}/invoices`, { orgId }),
      api<Payee[]>(`/organizations/${orgId}/suppliers`, { orgId }),
      api<Batch[]>(`/organizations/${orgId}/payments/batches`, { orgId }).catch(() => []),
    ]);
    setItems(payments);
    setNetwork(net);
    setReady(invoices.filter((i) => i.status.toUpperCase() === "APPROVED"));
    setPayees(suppliers.filter((s) => s.verificationStatus === "verified"));
    setBatches(batchList);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const steps = useMemo(() => {
    const order: Array<Exclude<FlowStep, "idle" | "error" | "done">> = [
      "create",
      "authorize",
      "execute",
      "confirm",
    ];
    const idx = order.indexOf(flowStep as (typeof order)[number]);
    return order.map((key, i) => ({
      key,
      label: FLOW_LABELS[key],
      state:
        flowStep === "done"
          ? "done"
          : flowStep === "idle"
            ? "idle"
            : flowStep === "error"
              ? i < idx
                ? "done"
                : i === idx
                  ? "error"
                  : "idle"
              : i < idx
                ? "done"
                : i === idx
                  ? "active"
                  : "idle",
    }));
  }, [flowStep]);

  async function settleInvoice(invoice: Invoice) {
    const orgId = getOrgId()!;
    setBusyId(invoice.id);
    setFlowLabel(invoice.invoiceNumber || invoice.id.slice(0, 8));
    setMsg("");
    setMsgTone("wait");
    setLastSettlement(null);
    setFlowStep("create");
    try {
      const payment = await api<Payment>(`/organizations/${orgId}/payments`, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          invoiceId: invoice.id,
          idempotencyKey: `pay-${invoice.id}-${Date.now()}`,
        }),
      });
      setFlowStep("authorize");
      const auth = await api<AuthorizeResult>(
        `/organizations/${orgId}/payments/${payment.id}/authorize`,
        { method: "POST", orgId },
      );
      if (!auth.evaluation.policyPass) throw new Error("Policy evaluation failed on TapeOut");
      setFlowStep("execute");
      const executed = await api<ExecuteResult>(
        `/organizations/${orgId}/payments/${payment.id}/execute`,
        { method: "POST", orgId },
      );
      if (executed.settlement) setLastSettlement(executed.settlement);
      setFlowStep("confirm");
      await api(`/organizations/${orgId}/payments/${payment.id}/status`, { orgId });
      setFlowStep("done");
      setMsgTone("ok");
      setMsg(
        executed.settlement
          ? `Settled · ${shortHash(executed.settlement.transactionHash)}`
          : `Settled ${payment.id.slice(0, 8)}`,
      );
      await load();
    } catch (err) {
      setFlowStep("error");
      setMsgTone("bad");
      setMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function refresh(paymentId: string) {
    const orgId = getOrgId()!;
    try {
      await api(`/organizations/${orgId}/payments/${paymentId}/status`, { orgId });
      setMsgTone("ok");
      setMsg("Status refreshed");
      await load();
    } catch (e) {
      setMsgTone("bad");
      setMsg((e as Error).message);
    }
  }

  async function reconcile(paymentId: string) {
    const orgId = getOrgId()!;
    try {
      await api(`/organizations/${orgId}/payments/${paymentId}/reconcile`, {
        method: "POST",
        orgId,
      });
      setMsgTone("ok");
      setMsg("Reconciled");
      await load();
    } catch (e) {
      setMsgTone("bad");
      setMsg((e as Error).message);
    }
  }

  async function runDirectPayout() {
    const orgId = getOrgId()!;
    const wallet = directAddress.trim();
    if (!wallet && !directPayeeId) {
      setMsgTone("bad");
      setMsg("Enter a wallet address (client is optional)");
      return;
    }
    if (wallet && !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      setMsgTone("bad");
      setMsg("Address must be a valid 0x wallet");
      return;
    }
    const usdc = Number(directAmount);
    if (!Number.isFinite(usdc) || usdc <= 0) {
      setMsgTone("bad");
      setMsg("Enter a positive USDC amount");
      return;
    }
    setBusyId("direct");
    setFlowLabel("Direct payout");
    setMsgTone("wait");
    setMsg("Sending…");
    setLastSettlement(null);
    setFlowStep("create");
    try {
      let payment = await api<Payment>(`/organizations/${orgId}/payments/direct`, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          supplierId: directPayeeId || undefined,
          destinationAddress: wallet || undefined,
          amountMinor: String(Math.round(usdc * 1e6)),
          memo: directMemo || undefined,
          idempotencyKey: `direct-${(wallet || directPayeeId).slice(0, 18)}-${Date.now()}`,
        }),
      });
      if (payment.status === "AWAITING_APPROVAL") {
        setFlowStep("idle");
        setMsgTone("wait");
        setMsg("Payment needs dual-control approval — open Approvals, then settle from Payments");
        await load();
        return;
      }
      setFlowStep("authorize");
      await api<AuthorizeResult>(`/organizations/${orgId}/payments/${payment.id}/authorize`, {
        method: "POST",
        orgId,
      });
      setFlowStep("execute");
      const executed = await api<ExecuteResult>(
        `/organizations/${orgId}/payments/${payment.id}/execute`,
        { method: "POST", orgId },
      );
      if (executed.settlement) setLastSettlement(executed.settlement);
      setFlowStep("confirm");
      await api(`/organizations/${orgId}/payments/${payment.id}/status`, { orgId }).catch(() => null);
      setFlowStep("done");
      setMsgTone("ok");
      setMsg(`Paid ${formatUsdc(payment.amountMinor)} USDC`);
      setDirectAmount("");
      setDirectMemo("");
      await load();
    } catch (e) {
      setFlowStep("error");
      setMsgTone("bad");
      setMsg((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function runGroupPayment() {
    const orgId = getOrgId()!;
    const lines = batchLines
      .filter((l) => l.supplierId && l.amount)
      .map((l) => ({
        supplierId: l.supplierId,
        amountMinor: String(Math.round(Number(l.amount) * 1e6)),
      }));
    if (lines.length < 2) {
      setMsgTone("bad");
      setMsg("Add at least two payees");
      return;
    }
    if (lines.some((l) => !Number.isFinite(Number(l.amountMinor)) || Number(l.amountMinor) <= 0)) {
      setMsgTone("bad");
      setMsg("Each line needs a positive amount");
      return;
    }
    setBusyId("batch");
    setFlowLabel(batchMemo || "Group payment");
    setMsgTone("wait");
    setMsg("Settling group…");
    setFlowStep("create");
    try {
      let batch = await api<Batch>(`/organizations/${orgId}/payments/batches`, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          memo: batchMemo || undefined,
          lines,
          idempotencyKey: `batch-${Date.now()}`,
        }),
      });
      if (batch.status === "AWAITING_APPROVAL") {
        setFlowStep("idle");
        setMsgTone("wait");
        setMsg("Group payment needs dual-control approval — open Approvals, then settle");
        await load();
        return;
      }
      setFlowStep("execute");
      const result = await api<{ settled: string[]; failed: unknown[] }>(
        `/organizations/${orgId}/payments/batches/${batch.id}/settle`,
        { method: "POST", orgId },
      );
      setFlowStep(result.failed.length ? "error" : "done");
      setMsgTone(result.failed.length ? "bad" : "ok");
      setMsg(
        result.failed.length
          ? `${result.settled.length} settled · ${result.failed.length} failed`
          : `Group settled · ${result.settled.length} lines`,
      );
      setBatchMemo("");
      setBatchLines([
        { supplierId: "", amount: "" },
        { supplierId: "", amount: "" },
      ]);
      await load();
    } catch (e) {
      setFlowStep("error");
      setMsgTone("bad");
      setMsg((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const showFlow = live || flowStep === "done" || flowStep === "error" || lastSettlement;

  return (
    <DashPage className="pay-page">
      <DashHeader
        eyebrow={t("pages.paymentsEyebrow")}
        title={t("pages.paymentsTitle")}
        lead={t("pages.paymentsLead")}
        actions={
          <Link href="/app/settings?tab=workspace" className="btn-ghost btn-sm">
            {t("pages.treasury")}
          </Link>
        }
      />

      <div className="pay-statusbar">
        <div className="pay-status-pill">
          <span className={`pay-dot${onchain ? " is-live" : ""}`} />
          <strong>{onchain ? "Live" : "Blocked"}</strong>
          <em>X Layer {network?.chainId ?? "—"}</em>
        </div>
        <div className="pay-status-meta">
          <span>{ready.length} ready</span>
          <span>·</span>
          <span>{items.length} settled</span>
          {network ? (
            <>
              <span>·</span>
              <a href={network.tapeOut.explorerProcessor} target="_blank" rel="noreferrer">
                Circuit #{network.tapeOut.paymentLimitCircuitId}
              </a>
            </>
          ) : null}
          {network?.fees?.enabled ? (
            <>
              <span>·</span>
              <span>
                Fees {network.fees.platformFeeBps ?? 0} bps
                {network.fees.gasRecoveryUsdcMinor
                  ? ` + gas ${Number(network.fees.gasRecoveryUsdcMinor) / 1e6} USDC`
                  : ""}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {msg ? <p className={`dash-flash${msgTone ? ` is-${msgTone}` : ""}`}>{msg}</p> : null}

      <div className="pay-layout">
        <section className="pay-compose">
          <div className="pay-modes" role="tablist" aria-label="Payment type">
            {(
              [
                ["invoice", "Invoice", ready.length],
                ["direct", "Direct", null],
                ["group", "Group", batches.length || null],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                className={`pay-mode${mode === id ? " is-active" : ""}`}
                onClick={() => setMode(id)}
              >
                {label}
                {typeof count === "number" && count > 0 ? <i>{count}</i> : null}
              </button>
            ))}
          </div>

          <div className="pay-compose-body">
            {mode === "invoice" ? (
              ready.length === 0 ? (
                <DashEmpty>
                  No approved invoices. <Link href="/app/approvals">Open approvals</Link>
                </DashEmpty>
              ) : (
                <ul className="pay-queue">
                  {ready.map((inv) => (
                    <li key={inv.id}>
                      <div>
                        <strong>
                          <Link href={`/app/invoices/${inv.id}`}>
                            {inv.invoiceNumber || inv.id.slice(0, 8)}
                          </Link>
                        </strong>
                        <em>
                          {inv.supplier?.legalName || "Payee"} · {formatUsdc(inv.totalAmountMinor)} USDC
                        </em>
                      </div>
                      <button
                        type="button"
                        className="btn-dark btn-sm"
                        disabled={busyId === inv.id || !onchain}
                        onClick={() => void settleInvoice(inv)}
                      >
                        {busyId === inv.id ? "Settling…" : "Settle"}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {mode === "direct" ? (
              <div className="pay-form">
                <div>
                  <label className="label">Address</label>
                  <input
                    className="input"
                    value={directAddress}
                    onChange={(e) => setDirectAddress(e.target.value)}
                    placeholder="0x…"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className="label">
                    Client <em className="payout-optional">optional</em>
                  </label>
                  <select
                    className="input"
                    value={directPayeeId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setDirectPayeeId(id);
                      const payee = payees.find((p) => p.id === id);
                      const dest =
                        payee?.paymentDestinations?.find((d) => d.verificationStatus === "verified") ||
                        payee?.paymentDestinations?.[0];
                      if (dest?.walletAddress) setDirectAddress(dest.walletAddress);
                    }}
                  >
                    <option value="">None — pay by address</option>
                    {payees.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.legalName}
                        {p.payeeType ? ` · ${p.payeeType}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pay-form-row">
                  <div>
                    <label className="label">Amount</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={directAmount}
                      onChange={(e) => setDirectAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">
                      Message <em className="payout-optional">optional</em>
                    </label>
                    <input
                      className="input"
                      value={directMemo}
                      onChange={(e) => setDirectMemo(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="pay-form-actions">
                  <button
                    type="button"
                    className="btn-dark"
                    disabled={busyId === "direct" || !onchain}
                    onClick={() => void runDirectPayout()}
                  >
                    {busyId === "direct" ? "Paying…" : "Pay now"}
                  </button>
                </div>
              </div>
            ) : null}

            {mode === "group" ? (
              <div className="pay-form">
                <div>
                  <label className="label">Batch name</label>
                  <input
                    className="input"
                    value={batchMemo}
                    onChange={(e) => setBatchMemo(e.target.value)}
                    placeholder="Vendor run"
                  />
                </div>
                <div className="pay-lines">
                  {batchLines.map((line, idx) => (
                    <div key={idx} className="pay-line">
                      <select
                        className="input"
                        value={line.supplierId}
                        onChange={(e) => {
                          const next = [...batchLines];
                          next[idx] = { ...line, supplierId: e.target.value };
                          setBatchLines(next);
                        }}
                      >
                        <option value="">Payee…</option>
                        {payees.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.legalName}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="USDC"
                        value={line.amount}
                        onChange={(e) => {
                          const next = [...batchLines];
                          next[idx] = { ...line, amount: e.target.value };
                          setBatchLines(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="pay-form-actions">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setBatchLines([...batchLines, { supplierId: "", amount: "" }])}
                  >
                    Add line
                  </button>
                  <button
                    type="button"
                    className="btn-dark"
                    disabled={busyId === "batch" || !onchain}
                    onClick={() => void runGroupPayment()}
                  >
                    {busyId === "batch" ? "Settling…" : "Settle group"}
                  </button>
                </div>
                {batches.length > 0 ? (
                  <ul className="pay-batch-mini">
                    {batches.slice(0, 4).map((b) => (
                      <li key={b.id}>
                        <span>
                          {b.memo || b.id.slice(0, 8)} · {b.lineCount} lines ·{" "}
                          {formatUsdc(b.totalAmountMinor)}
                        </span>
                        <DashStatus tone={statusTone(b.status)}>{b.status}</DashStatus>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          {showFlow ? (
            <div className="pay-flow-compact" aria-live="polite">
              <div className="pay-flow-compact-head">
                <strong>{flowLabel || "Settlement"}</strong>
                {flowStep === "done" ? <DashStatus tone="ok">Done</DashStatus> : null}
                {flowStep === "error" ? <DashStatus tone="bad">Failed</DashStatus> : null}
                {live ? <DashStatus tone="wait">Running</DashStatus> : null}
              </div>
              <ol className="pay-steps-compact">
                {steps.map((s) => (
                  <li key={s.key} className={`is-${s.state}`}>
                    {s.label}
                  </li>
                ))}
              </ol>
              {lastSettlement ? (
                <div className="pay-tx-row">
                  <a href={lastSettlement.explorer.authorize} target="_blank" rel="noreferrer">
                    Auth {shortHash(lastSettlement.authorizationTxHash)}
                  </a>
                  <a href={lastSettlement.explorer.settle} target="_blank" rel="noreferrer">
                    Settle {shortHash(lastSettlement.transactionHash)}
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="pay-ledger-panel">
          <div className="pay-ledger-head">
            <h2>Ledger</h2>
            <span>{items.length}</span>
          </div>
          {items.length === 0 ? (
            <DashEmpty>No settlements yet.</DashEmpty>
          ) : (
            <ul className="pay-ledger-compact">
              {items.map((p) => {
                const settleHref = txHref(network?.explorerTxBase, p.transactionHash);
                return (
                  <li key={p.id}>
                    <div className="pay-ledger-top">
                      <strong>{formatUsdc(p.amountMinor)}</strong>
                      <DashStatus tone={statusTone(p.status)}>{p.status.replace("PAYMENT_", "")}</DashStatus>
                    </div>
                    <p>
                      {p.supplier?.legalName || "Payee"}
                      {p.kind && p.kind !== "invoice" ? ` · ${p.kind}` : ""}
                      {p.invoice?.invoiceNumber ? ` · ${p.invoice.invoiceNumber}` : ""}
                    </p>
                    <div className="pay-ledger-foot">
                      {p.transactionHash ? (
                        settleHref ? (
                          <a href={settleHref} target="_blank" rel="noreferrer">
                            {shortHash(p.transactionHash)}
                          </a>
                        ) : (
                          <code>{shortHash(p.transactionHash)}</code>
                        )
                      ) : (
                        <em>No tx yet</em>
                      )}
                      <div className="pay-ledger-actions">
                        {p.status === "PAYMENT_SUBMITTED" ? (
                          <button type="button" className="btn-quiet btn-sm" onClick={() => void refresh(p.id)}>
                            Confirm
                          </button>
                        ) : null}
                        {p.status === "PAYMENT_CONFIRMED" ? (
                          <button type="button" className="btn-quiet btn-sm" onClick={() => void reconcile(p.id)}>
                            Reconcile
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </DashPage>
  );
}
