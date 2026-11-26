"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, getOrgId } from "@/lib/api";
import { DashEmpty, DashHeader, DashPage, DashPanel, DashStatus } from "@/components/dash";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Policy = {
  id: string;
  policyName: string;
  version: number;
  dailySpendLimitMinor: string;
  perPaymentLimitMinor: string;
  status: string;
  processorAddress: string | null;
  circuitId: string | null;
};

type Network = {
  chainId: number;
  settlementMode: string;
  tapeOut: {
    processor: string;
    paymentLimitCircuitId: string;
    explorerProcessor: string;
  };
};

type ControlsRules = {
  autoApproveMaxUsdc: number;
  singleApproverMaxUsdc: number;
  dualControlAboveUsdc: number;
  minConfidenceBps: number;
  holdOnNewVendor: boolean;
  holdOnDestinationChange: boolean;
  holdOnDuplicate: boolean;
  requirePurchaseOrder: boolean;
  requirePoMatch: boolean;
  holdOnUnknownDestination: boolean;
  blockAutoApproveUntilAllowlisted: boolean;
};

type Controls = {
  version: number;
  source: string;
  onChainTxHash: string | null;
  onChainVersion: number | null;
  rules: ControlsRules;
};

type ControlsHistoryRow = {
  id: string;
  version: number;
  rulesJson: string;
  configHash: string;
  onChainTxHash: string | null;
  onChainVersion: number | null;
  active: boolean;
  createdAt: string;
};

const DEFAULT_PROCESSOR =
  process.env.NEXT_PUBLIC_TAPEOUT_PROCESSOR || "0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF";
const DEFAULT_CIRCUIT = process.env.NEXT_PUBLIC_TAPEOUT_CIRCUIT_ID || "1";

const STRICT: ControlsRules = {
  autoApproveMaxUsdc: 500,
  singleApproverMaxUsdc: 5_000,
  dualControlAboveUsdc: 5_000,
  minConfidenceBps: 8500,
  holdOnNewVendor: true,
  holdOnDestinationChange: true,
  holdOnDuplicate: true,
  requirePurchaseOrder: true,
  requirePoMatch: true,
  holdOnUnknownDestination: true,
  blockAutoApproveUntilAllowlisted: true,
};

function formatUsdc(minor: string) {
  const n = Number(minor) / 1e6;
  if (!Number.isFinite(n)) return minor;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PoliciesPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Policy[]>([]);
  const [network, setNetwork] = useState<Network | null>(null);
  const [controls, setControls] = useState<Controls | null>(null);
  const [history, setHistory] = useState<ControlsHistoryRow[]>([]);
  const [name, setName] = useState("Default spend");
  const [perPayment, setPerPayment] = useState("25000000000");
  const [daily, setDaily] = useState("100000000000");
  const [processor, setProcessor] = useState(DEFAULT_PROCESSOR);
  const [circuitId, setCircuitId] = useState(DEFAULT_CIRCUIT);
  const [autoMax, setAutoMax] = useState("5000");
  const [singleMax, setSingleMax] = useState("50000");
  const [dualAbove, setDualAbove] = useState("50000");
  const [minConf, setMinConf] = useState("7500");
  const [holdNew, setHoldNew] = useState(true);
  const [holdDup, setHoldDup] = useState(true);
  const [holdDest, setHoldDest] = useState(true);
  const [requirePo, setRequirePo] = useState(false);
  const [controlsMsg, setControlsMsg] = useState("");

  function applyRules(rules: ControlsRules) {
    setAutoMax(String(rules.autoApproveMaxUsdc));
    setSingleMax(String(rules.singleApproverMaxUsdc));
    setDualAbove(String(rules.dualControlAboveUsdc));
    setMinConf(String(rules.minConfidenceBps));
    setHoldNew(rules.holdOnNewVendor);
    setHoldDup(rules.holdOnDuplicate);
    setHoldDest(rules.holdOnDestinationChange || rules.holdOnUnknownDestination);
    setRequirePo(rules.requirePurchaseOrder || rules.requirePoMatch);
  }

  async function load() {
    const orgId = getOrgId()!;
    const [policies, net, ctrl, hist] = await Promise.all([
      api<Policy[]>(`/organizations/${orgId}/policies`, { orgId }),
      api<Network>(`/organizations/${orgId}/payments/network`, { orgId }),
      api<Controls>(`/organizations/${orgId}/controls`, { orgId }),
      api<ControlsHistoryRow[]>(`/organizations/${orgId}/controls/history`, { orgId }).catch(() => []),
    ]);
    setItems(policies);
    setNetwork(net);
    setControls(ctrl);
    setHistory(hist);
    if (net.tapeOut?.processor) setProcessor(net.tapeOut.processor);
    if (net.tapeOut?.paymentLimitCircuitId) setCircuitId(net.tapeOut.paymentLimitCircuitId);
    if (ctrl?.rules) applyRules(ctrl.rules);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const orgId = getOrgId()!;
    await api(`/organizations/${orgId}/policies`, {
      method: "POST",
      orgId,
      body: JSON.stringify({
        policyName: name,
        perPaymentLimitMinor: perPayment,
        dailySpendLimitMinor: daily,
        processorAddress: processor,
        circuitId,
      }),
    });
    await load();
  }

  async function onPublishControls(e: FormEvent) {
    e.preventDefault();
    const orgId = getOrgId()!;
    setControlsMsg("");
    try {
      const res = await api<{ onChain: { ok: boolean; hash?: string; reason?: string } }>(
        `/organizations/${orgId}/controls`,
        {
          method: "POST",
          orgId,
          body: JSON.stringify({
            name: "AP Controls",
            autoApproveMaxUsdc: Number(autoMax),
            singleApproverMaxUsdc: Number(singleMax),
            dualControlAboveUsdc: Number(dualAbove),
            minConfidenceBps: Number(minConf),
            holdOnNewVendor: holdNew,
            holdOnDuplicate: holdDup,
            holdOnDestinationChange: holdDest,
            holdOnUnknownDestination: holdDest,
            requirePurchaseOrder: requirePo,
            requirePoMatch: requirePo,
            blockAutoApproveUntilAllowlisted: true,
          }),
        },
      );
      setControlsMsg(
        res.onChain?.ok
          ? `Published on-chain · ${res.onChain.hash}`
          : `Saved locally · chain sync: ${res.onChain?.reason || "pending"}`,
      );
      await load();
    } catch (err) {
      setControlsMsg((err as Error).message);
    }
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow={t("pages.controlsEyebrow")}
        title={t("pages.controlsTitle")}
        lead={t("pages.controlsLead")}
      />

      {network ? (
        <div className="dash-grid is-3">
          <div className="dash-stat">
            <span>Settlement</span>
            <strong className="!text-base !font-mono">{network.settlementMode}</strong>
          </div>
          <div className="dash-stat">
            <span>Circuit</span>
            <strong className="!text-base !font-mono">#{network.tapeOut.paymentLimitCircuitId}</strong>
          </div>
          <div className="dash-stat">
            <span>Processor</span>
            <em>
              <a href={network.tapeOut.explorerProcessor} target="_blank" rel="noreferrer" className="underline">
                Open explorer
              </a>
            </em>
          </div>
        </div>
      ) : null}

      <DashPanel title="On-chain AP controls">
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={() => applyRules(STRICT)}>
            Apply Strict preset
          </button>
          <span className="text-xs text-mute self-center">
            Strict: $500 auto · dual above $5k · PO required · all holds on
          </span>
        </div>
        <form onSubmit={onPublishControls} className="dash-form is-2">
          <div>
            <label className="label">Auto-approve max (USDC)</label>
            <input className="input" value={autoMax} onChange={(e) => setAutoMax(e.target.value)} />
          </div>
          <div>
            <label className="label">Single approver max (USDC)</label>
            <input className="input" value={singleMax} onChange={(e) => setSingleMax(e.target.value)} />
          </div>
          <div>
            <label className="label">Dual-control above (USDC)</label>
            <input className="input" value={dualAbove} onChange={(e) => setDualAbove(e.target.value)} />
          </div>
          <div>
            <label className="label">Min confidence (bps)</label>
            <input className="input" value={minConf} onChange={(e) => setMinConf(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 justify-end text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={holdNew} onChange={(e) => setHoldNew(e.target.checked)} />
              Hold new vendor
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={holdDup} onChange={(e) => setHoldDup(e.target.checked)} />
              Hold duplicates
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={holdDest} onChange={(e) => setHoldDest(e.target.checked)} />
              Hold unknown / changed wallet
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requirePo} onChange={(e) => setRequirePo(e.target.checked)} />
              Require PO match
            </label>
          </div>
          <div className="dash-form-actions">
            <button className="btn-dark" type="submit">
              Publish to ControlsRegistry
            </button>
          </div>
          {controls ? (
            <p className="text-xs text-mute col-span-2">
              Active v{controls.version} ({controls.source})
              {controls.onChainVersion ? ` · on-chain v${controls.onChainVersion}` : ""}
              {controls.onChainTxHash ? ` · ${controls.onChainTxHash.slice(0, 18)}…` : ""}
            </p>
          ) : null}
          {controlsMsg ? <p className="text-sm text-mute col-span-2">{controlsMsg}</p> : null}
        </form>
      </DashPanel>

      <DashPanel title="Controls version history">
        {history.length === 0 ? (
          <DashEmpty>No published controls yet.</DashEmpty>
        ) : (
          <ul className="dash-list">
            {history.map((h) => {
              let rules: ControlsRules | null = null;
              try {
                rules = JSON.parse(h.rulesJson) as ControlsRules;
              } catch {
                /* ignore */
              }
              return (
                <li key={h.id} className="dash-row">
                  <div className="dash-row-main">
                    <strong>
                      v{h.version}
                      {h.active ? " · active" : ""}
                    </strong>
                    <em>
                      {rules
                        ? `auto ≤$${rules.autoApproveMaxUsdc} · dual >$${rules.dualControlAboveUsdc}`
                        : h.configHash.slice(0, 12)}
                      {h.onChainTxHash ? ` · ${h.onChainTxHash.slice(0, 14)}…` : " · local"}
                    </em>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.active ? <DashStatus tone="ok">live</DashStatus> : <DashStatus>archived</DashStatus>}
                    <button
                      type="button"
                      className="home-chip"
                      onClick={() => {
                        if (rules) applyRules(rules);
                      }}
                    >
                      Load
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashPanel>

      <DashPanel title="Publish TapeOut spend policy">
        <form onSubmit={onCreate} className="dash-form is-2">
          <div>
            <label className="label">Policy name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Per-payment limit (minor)</label>
            <input
              className="input font-mono text-xs"
              value={perPayment}
              onChange={(e) => setPerPayment(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Daily limit (minor)</label>
            <input
              className="input font-mono text-xs"
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Processor</label>
            <input
              className="input font-mono text-xs"
              value={processor}
              onChange={(e) => setProcessor(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Circuit id</label>
            <input className="input" value={circuitId} onChange={(e) => setCircuitId(e.target.value)} />
          </div>
          <div className="dash-form-actions">
            <button className="btn-dark" type="submit">
              Publish spend policy
            </button>
          </div>
        </form>
      </DashPanel>

      <DashPanel title="TapeOut policy versions">
        {items.length === 0 ? (
          <DashEmpty>No spend policies yet.</DashEmpty>
        ) : (
          <ul className="dash-list">
            {items.map((p) => (
              <li key={p.id} className="dash-row">
                <div className="dash-row-main">
                  <strong>
                    {p.policyName} · v{p.version}
                  </strong>
                  <em>
                    per {formatUsdc(p.perPaymentLimitMinor)} · daily {formatUsdc(p.dailySpendLimitMinor)} USDC
                  </em>
                </div>
                <DashStatus tone={p.status === "active" ? "ok" : "neutral"}>{p.status}</DashStatus>
              </li>
            ))}
          </ul>
        )}
      </DashPanel>
    </DashPage>
  );
}
