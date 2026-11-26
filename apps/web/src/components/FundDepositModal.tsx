"use client";

import { useEffect, useState } from "react";
import { api, getOrgId } from "@/lib/api";
import { DashModal } from "@/components/dash";

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
  "https://www.oklink.com/x-layer-testnet/address/";

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
        chainId: initial.chainId ?? prev?.chainId ?? 1952,
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
        if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a USDC amount greater than zero");
        body = { amountMinor: String(Math.round(n * 1e6)) };
      }
      const res = await api<{ amountMinor: string; depositHash: string }>(
        `/organizations/${orgId}/treasury/deposit`,
        { method: "POST", orgId, body: JSON.stringify(body) },
      );
      setMsg(`Deposited ${formatUsdc(res.amountMinor)} USDC · ${shortAddr(res.depositHash)}`);
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
    <DashModal open={open} onClose={onClose} title="Fund & deposit">
      <div className="fund-modal">
        <div className="fund-step">
          <span className="fund-step-num">1</span>
          <div>
            <strong>Send USDC to your funding wallet</strong>
            <p>Native USDC on X Layer, plus a little OKB for gas.</p>
          </div>
        </div>

        <div className="fund-wallet-card">
          <p className="home-kicker">Funding wallet</p>
          <p className="fund-addr">{funding ? shortAddr(funding) : "Provisioning…"}</p>
          <p className="fund-addr-full">{funding || "—"}</p>
          <div className="fund-actions">
            <button type="button" className="home-chip" disabled={!funding} onClick={copyWallet}>
              {copied ? "Copied" : "Copy address"}
            </button>
            {funding ? (
              <a className="home-chip" href={`${EXPLORER}${funding}`} target="_blank" rel="noreferrer">
                Explorer
              </a>
            ) : null}
          </div>
        </div>

        <div className="fund-bals">
          <div>
            <span>Wallet USDC</span>
            <strong>{summary ? formatUsdc(walletUsdc) : "—"}</strong>
          </div>
          <div>
            <span>Wallet OKB</span>
            <strong>{summary ? formatOkb(summary.balances.fundingWalletOkbWei) : "—"}</strong>
          </div>
          <div>
            <span>Vault</span>
            <strong>{summary ? formatUsdc(summary.balances.vaultAvailableUsdcMinor) : "—"}</strong>
          </div>
        </div>

        <div className="fund-step">
          <span className="fund-step-num">2</span>
          <div>
            <strong>Deposit into the vault</strong>
            <p>Moves USDC from the funding wallet into BusinessTreasury for settlement.</p>
          </div>
        </div>

        <div className="fund-deposit-row">
          <div className="fund-amount">
            <label className="label" htmlFor="fund-amount">
              Amount (USDC)
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
            {busy ? "Working…" : "Deposit"}
          </button>
          <button type="button" className="btn-dark" disabled={busy || !hasBalance} onClick={() => deposit(true)}>
            {busy ? "Working…" : "Deposit all"}
          </button>
        </div>

        {!hasBalance && summary ? (
          <p className="fund-hint">Wallet is empty — send USDC to the address above, then deposit.</p>
        ) : null}
        {msg ? <p className="fund-ok">{msg}</p> : null}
        {err ? <p className="fund-err">{err}</p> : null}
      </div>
    </DashModal>
  );
}
