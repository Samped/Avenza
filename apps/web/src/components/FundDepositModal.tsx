"use client";

import { useEffect, useState } from "react";
import { api, getOrgId } from "@/lib/api";
import { DashModal } from "@/components/dash";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type TreasurySummary = {
  onChainOrgId: string | null;
  chainId: number;
  vaultAddress: string | null;
  fundingWalletAddress: string | null;
  balances: {
    fundingWalletUsdcMinor: string;
    fundingWalletOkbWei: string;
    vaultAvailableUsdcMinor: string;
  };
  instructions: { fund: string; deposit: string; settle: string };
};

const EXPLORER =
  process.env.NEXT_PUBLIC_EXPLORER_ADDRESS_BASE ||
  (Number(process.env.NEXT_PUBLIC_XLAYER_CHAIN_ID || 196) === 196
    ? "https://www.oklink.com/xlayer/address/"
    : "https://www.oklink.com/xlayer-test/address/");

function formatUsdc(minor: string) {
  const n = Number(minor) / 1e6;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatOkb(wei: string) {
  const n = Number(wei) / 1e18;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function FundDepositModal({
  open,
  onClose,
  onDeposited,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onDeposited?: () => void;
  initial?: Partial<TreasurySummary> | null;
}) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const orgId = getOrgId();
    if (!orgId) return;
    const data = await api<TreasurySummary>(`/organizations/${orgId}/treasury`, { orgId });
    setSummary(data);
  }

  useEffect(() => {
    if (!open) return;
    setMsg("");
    setErr("");
    setAmount("");
    if (initial?.fundingWalletAddress) {
      setSummary((prev) => ({
        onChainOrgId: initial.onChainOrgId ?? prev?.onChainOrgId ?? null,
        chainId: initial.chainId ?? prev?.chainId ?? Number(process.env.NEXT_PUBLIC_XLAYER_CHAIN_ID || 196),
        vaultAddress: initial.vaultAddress ?? prev?.vaultAddress ?? null,
        fundingWalletAddress: initial.fundingWalletAddress ?? null,
        balances: initial.balances ??
          prev?.balances ?? {
            fundingWalletUsdcMinor: "0",
            fundingWalletOkbWei: "0",
            vaultAvailableUsdcMinor: "0",
          },
        instructions: initial.instructions ??
          prev?.instructions ?? {
            fund: "",
            deposit: "",
            settle: "",
          },
      }));
    }
    load().catch((e) => setErr((e as Error).message));
  }, [open]);

  const funding = summary?.fundingWalletAddress || null;
  const walletUsdc = summary?.balances.fundingWalletUsdcMinor || "0";
  const hasBalance = Number(walletUsdc) > 0;

  async function copyWallet() {
    if (!funding) return;
    await navigator.clipboard.writeText(funding);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function deposit(all = false) {
    const orgId = getOrgId();
    if (!orgId) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      let body: { amountMinor?: string } = {};
      if (!all) {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) throw new Error(t("fund.amountError"));
        body = { amountMinor: String(Math.round(n * 1e6)) };
      }
      const res = await api<{ amountMinor: string; depositHash: string }>(
        `/organizations/${orgId}/treasury/deposit`,
        { method: "POST", orgId, body: JSON.stringify(body) },
      );
      setMsg(
        t("fund.deposited", {
          amount: formatUsdc(res.amountMinor),
          hash: shortAddr(res.depositHash),
        }),
      );
      setAmount("");
      await load();
      onDeposited?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashModal open={open} onClose={onClose} title={t("fund.title")}>
      <div className="fund-modal">
        <div className="fund-step">
          <span className="fund-step-num">1</span>
          <div>
            <strong>{t("fund.step1Title")}</strong>
            <p>{t("fund.step1Lead")}</p>
          </div>
        </div>

        <div className="fund-wallet-card">
          <p className="home-kicker">{t("fund.fundingWallet")}</p>
          <p className="fund-addr">{funding ? shortAddr(funding) : t("fund.provisioning")}</p>
          <p className="fund-addr-full">{funding || t("common.empty")}</p>
          <div className="fund-actions">
            <button type="button" className="home-chip" disabled={!funding} onClick={copyWallet}>
              {copied ? t("common.copied") : t("common.copyAddress")}
            </button>
            {funding ? (
              <a className="home-chip" href={`${EXPLORER}${funding}`} target="_blank" rel="noreferrer">
                {t("common.explorer")}
              </a>
            ) : null}
          </div>
        </div>

        <div className="fund-bals">
          <div>
            <span>{t("fund.walletUsdc")}</span>
            <strong>{summary ? formatUsdc(walletUsdc) : t("common.empty")}</strong>
          </div>
          <div>
            <span>{t("fund.walletOkb")}</span>
            <strong>{summary ? formatOkb(summary.balances.fundingWalletOkbWei) : t("common.empty")}</strong>
          </div>
          <div>
            <span>{t("fund.vault")}</span>
            <strong>
              {summary ? formatUsdc(summary.balances.vaultAvailableUsdcMinor) : t("common.empty")}
            </strong>
          </div>
        </div>

        <div className="fund-step">
          <span className="fund-step-num">2</span>
          <div>
            <strong>{t("fund.step2Title")}</strong>
            <p>{t("fund.step2Lead")}</p>
          </div>
        </div>

        <div className="fund-deposit-row">
          <div className="fund-amount">
            <label className="label" htmlFor="fund-amount">
              {t("fund.amountUsdc")}
            </label>
            <input
              id="fund-amount"
              className="input"
              inputMode="decimal"
              placeholder={hasBalance ? formatUsdc(walletUsdc) : "0.00"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
            />
          </div>
          <button type="button" className="btn-ghost" disabled={busy || !hasBalance} onClick={() => deposit(false)}>
            {busy ? t("common.working") : t("fund.deposit")}
          </button>
          <button type="button" className="btn-dark" disabled={busy || !hasBalance} onClick={() => deposit(true)}>
            {busy ? t("common.working") : t("fund.depositAll")}
          </button>
        </div>

        {!hasBalance && summary ? <p className="fund-hint">{t("fund.emptyHint")}</p> : null}
        {msg ? <p className="fund-ok">{msg}</p> : null}
        {err ? <p className="fund-err">{err}</p> : null}
      </div>
    </DashModal>
  );
}
