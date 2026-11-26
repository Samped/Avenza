"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, getOrgId } from "@/lib/api";
import { DashModal, DashStatus } from "@/components/dash";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Payee = {
  id: string;
  legalName: string;
  payeeType?: string;
  verificationStatus: string;
  paymentDestinations?: Array<{
    id: string;
    walletAddress: string;
    verificationStatus: string;
    active?: boolean;
  }>;
};

type Payment = {
  id: string;
  status: string;
  amountMinor: string;
};

type Mode = "direct" | "group";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function formatUsdc(minor: string) {
  const n = Number(minor) / 1e6;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function primaryWallet(p: Payee) {
  const dest =
    p.paymentDestinations?.find((d) => d.verificationStatus === "verified") ||
    p.paymentDestinations?.[0];
  return dest?.walletAddress || "";
}

export function PayoutModal({
  open,
  onClose,
  onPaid,
  initialMode = "direct",
}: {
  open: boolean;
  onClose: () => void;
  onPaid?: () => void;
  initialMode?: Mode;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "bad" | "wait" | "">("");

  const [address, setAddress] = useState("");
  const [payeeId, setPayeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const [batchMemo, setBatchMemo] = useState("");
  const [lines, setLines] = useState<Array<{ address: string; supplierId: string; amount: string; memo: string }>>([
    { address: "", supplierId: "", amount: "", memo: "" },
    { address: "", supplierId: "", amount: "", memo: "" },
  ]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setMsg("");
    setMsgTone("");
    setBusy(false);
    const orgId = getOrgId();
    if (!orgId) return;
    setLoading(true);
    api<Payee[]>(`/organizations/${orgId}/suppliers`, { orgId })
      .then((list) =>
        setPayees(list.filter((s) => s.verificationStatus.toLowerCase() === "verified")),
      )
      .catch((e) => {
        setMsgTone("bad");
        setMsg((e as Error).message);
      })
      .finally(() => setLoading(false));
  }, [open, initialMode]);

  function onPickClient(id: string) {
    setPayeeId(id);
    if (!id) return;
    const payee = payees.find((p) => p.id === id);
    const wallet = payee ? primaryWallet(payee) : "";
    if (wallet) setAddress(wallet);
  }

  async function runDirect() {
    const orgId = getOrgId()!;
    const wallet = address.trim();
    if (!wallet && !payeeId) {
      setMsgTone("bad");
      setMsg("Enter a wallet address (client is optional)");
      return;
    }
    if (wallet && !ADDR_RE.test(wallet)) {
      setMsgTone("bad");
      setMsg("Address must be a valid 0x wallet");
      return;
    }
    const usdc = Number(amount);
    if (!Number.isFinite(usdc) || usdc <= 0) {
      setMsgTone("bad");
      setMsg("Enter a positive USDC amount");
      return;
    }
    setBusy(true);
    setMsgTone("wait");
    setMsg("Paying…");
    try {
      let payment = await api<Payment>(`/organizations/${orgId}/payments/direct`, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          supplierId: payeeId || undefined,
          destinationAddress: wallet || undefined,
          amountMinor: String(Math.round(usdc * 1e6)),
          memo: memo.trim() || undefined,
          idempotencyKey: `direct-${(wallet || payeeId).slice(0, 18)}-${Date.now()}`,
        }),
      });
      if (payment.status === "AWAITING_APPROVAL") {
        payment = await api<Payment>(`/organizations/${orgId}/payments/${payment.id}/approve`, {
          method: "POST",
          orgId,
          body: JSON.stringify({ decision: "approve" }),
        });
      }
      await api(`/organizations/${orgId}/payments/${payment.id}/authorize`, {
        method: "POST",
        orgId,
      });
      const executed = await api<Payment & { settlement?: { transactionHash: string } }>(
        `/organizations/${orgId}/payments/${payment.id}/execute`,
        { method: "POST", orgId },
      );
      await api(`/organizations/${orgId}/payments/${payment.id}/status`, { orgId }).catch(() => null);
      setMsgTone("ok");
      setMsg(`Paid ${formatUsdc(executed.amountMinor || payment.amountMinor)} USDC`);
      setAmount("");
      setMemo("");
      onPaid?.();
    } catch (e) {
      setMsgTone("bad");
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runGroup() {
    const orgId = getOrgId()!;
    const ready = lines
      .map((l) => ({
        address: l.address.trim(),
        supplierId: l.supplierId || undefined,
        amount: l.amount,
        memo: l.memo.trim() || undefined,
      }))
      .filter((l) => (l.address || l.supplierId) && l.amount);

    if (ready.length < 2) {
      setMsgTone("bad");
      setMsg("Add at least two lines with address or client + amount");
      return;
    }
    for (const l of ready) {
      if (l.address && !ADDR_RE.test(l.address)) {
        setMsgTone("bad");
        setMsg("Each address must be a valid 0x wallet");
        return;
      }
      if (!Number.isFinite(Number(l.amount)) || Number(l.amount) <= 0) {
        setMsgTone("bad");
        setMsg("Each line needs a positive amount");
        return;
      }
    }

    setBusy(true);
    setMsgTone("wait");
    setMsg("Settling group…");
    try {
      let settled = 0;
      const failed: string[] = [];
      for (const [i, l] of ready.entries()) {
        try {
          let payment = await api<Payment>(`/organizations/${orgId}/payments/direct`, {
            method: "POST",
            orgId,
            body: JSON.stringify({
              supplierId: l.supplierId,
              destinationAddress: l.address || undefined,
              amountMinor: String(Math.round(Number(l.amount) * 1e6)),
              memo: l.memo || batchMemo || undefined,
              idempotencyKey: `batch-line-${Date.now()}-${i}`,
            }),
          });
          if (payment.status === "AWAITING_APPROVAL") {
            payment = await api<Payment>(`/organizations/${orgId}/payments/${payment.id}/approve`, {
              method: "POST",
              orgId,
              body: JSON.stringify({ decision: "approve" }),
            });
          }
          await api(`/organizations/${orgId}/payments/${payment.id}/authorize`, {
            method: "POST",
            orgId,
          });
          await api(`/organizations/${orgId}/payments/${payment.id}/execute`, {
            method: "POST",
            orgId,
          });
          settled += 1;
        } catch (e) {
          failed.push((e as Error).message);
        }
      }
      setMsgTone(failed.length ? "bad" : "ok");
      setMsg(
        failed.length
          ? `${settled} settled · ${failed.length} failed`
          : `Group settled · ${settled} lines`,
      );
      if (!failed.length) {
        setBatchMemo("");
        setLines([
          { address: "", supplierId: "", amount: "", memo: "" },
          { address: "", supplierId: "", amount: "", memo: "" },
        ]);
      }
      onPaid?.();
    } catch (e) {
      setMsgTone("bad");
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashModal open={open} onClose={onClose} title={t("payout.title")} wide>
      <div className="payout-modal">
        <div className="payout-modes" role="tablist" aria-label={t("payout.title")}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "direct"}
            className={`payout-mode${mode === "direct" ? " is-active" : ""}`}
            onClick={() => setMode("direct")}
          >
            {t("payout.individual")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "group"}
            className={`payout-mode${mode === "group" ? " is-active" : ""}`}
            onClick={() => setMode("group")}
          >
            {t("payout.group")}
          </button>
        </div>

        {msg ? (
          <p className={`dash-flash${msgTone ? ` is-${msgTone}` : ""}`} style={{ margin: 0 }}>
            {msg}
          </p>
        ) : null}

        {loading ? (
          <p className="fund-hint">{t("payout.loading")}</p>
        ) : mode === "direct" ? (
          <div className="fund-modal">
            <div>
              <label className="label">{t("payout.address")}</label>
              <input
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x…"
                spellCheck={false}
                disabled={busy}
              />
            </div>
            <div>
              <label className="label">
                {t("payout.clientOptional")} <em className="payout-optional">{t("common.optional")}</em>
              </label>
              <select
                className="input"
                value={payeeId}
                onChange={(e) => onPickClient(e.target.value)}
                disabled={busy}
              >
                <option value="">{t("payout.nonePayByAddress")}</option>
                {payees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.legalName}
                    {p.payeeType ? ` · ${p.payeeType}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("payout.amountUsdc")}</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="label">
                {t("payout.messageOptional")} <em className="payout-optional">{t("common.optional")}</em>
              </label>
              <input
                className="input"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder={t("payout.messagePlaceholder")}
                disabled={busy}
              />
            </div>
            <div className="fund-actions">
              <button type="button" className="btn-dark" disabled={busy} onClick={() => void runDirect()}>
                {busy ? t("payout.paying") : t("payout.payNow")}
              </button>
              <Link href="/app/payments" className="btn-ghost btn-sm" onClick={onClose}>
                {t("payout.fullLedger")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="fund-modal">
            <p className="fund-hint">{t("payout.groupHint")}</p>
            <div>
              <label className="label">
                {t("payout.batchName")} <em className="payout-optional">{t("common.optional")}</em>
              </label>
              <input
                className="input"
                value={batchMemo}
                onChange={(e) => setBatchMemo(e.target.value)}
                placeholder={t("payout.batchPlaceholder")}
                disabled={busy}
              />
            </div>
            <div className="payout-lines">
              {lines.map((line, idx) => (
                <div key={idx} className="payout-line-card">
                  <input
                    className="input"
                    value={line.address}
                    placeholder={t("payout.addressPlaceholder")}
                    spellCheck={false}
                    disabled={busy}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...line, address: e.target.value };
                      setLines(next);
                    }}
                  />
                  <div className="payout-line-row">
                    <select
                      className="input"
                      value={line.supplierId}
                      disabled={busy}
                      onChange={(e) => {
                        const id = e.target.value;
                        const payee = payees.find((p) => p.id === id);
                        const wallet = payee ? primaryWallet(payee) : "";
                        const next = [...lines];
                        next[idx] = {
                          ...line,
                          supplierId: id,
                          address: wallet || line.address,
                        };
                        setLines(next);
                      }}
                    >
                      <option value="">{t("payout.clientOptionalSelect")}</option>
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
                      placeholder={t("payout.amountPlaceholder")}
                      value={line.amount}
                      disabled={busy}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...line, amount: e.target.value };
                        setLines(next);
                      }}
                    />
                  </div>
                  <input
                    className="input"
                    value={line.memo}
                    placeholder={t("payout.messageLinePlaceholder")}
                    disabled={busy}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...line, memo: e.target.value };
                      setLines(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="fund-actions">
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={busy}
                onClick={() =>
                  setLines([...lines, { address: "", supplierId: "", amount: "", memo: "" }])
                }
              >
                {t("payout.addLine")}
              </button>
              <button type="button" className="btn-dark" disabled={busy} onClick={() => void runGroup()}>
                {busy ? t("payout.settling") : t("payout.settleGroup")}
              </button>
              {msgTone === "ok" ? <DashStatus tone="ok">{t("payout.done")}</DashStatus> : null}
            </div>
          </div>
        )}
      </div>
    </DashModal>
  );
}
