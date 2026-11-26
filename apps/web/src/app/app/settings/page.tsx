"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getOrgId } from "@/lib/api";
import { DashEmpty, DashHeader, DashPage, DashPanel, DashStatus } from "@/components/dash";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { FundDepositModal } from "@/components/FundDepositModal";

type Tab = "workspace" | "developers" | "integrations" | "people" | "activity";

type Org = {
  legalName: string;
  status: string;
  onChainOrgId?: string | null;
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

type Treasury = {
  fundingWalletAddress: string | null;
  balances: {
    fundingWalletUsdcMinor: string;
    fundingWalletOkbWei: string;
    vaultAvailableUsdcMinor: string;
  };
};

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopesJson: string;
  revokedAt: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
};

type WebhookRow = {
  id: string;
  url: string;
  eventsJson: string;
  active: boolean;
};

type Conn = {
  id: string;
  provider: string;
  baseUrl: string;
  status: string;
};

type Member = {
  id: string;
  role: string;
  status: string;
  user: { email: string; fullName: string };
};

type AuditRow = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

const ALL_SCOPES = [
  "invoices:read",
  "invoices:write",
  "approvals:submit",
  "payments:read",
  "payments:initiate",
  "payments:settle",
  "suppliers:read",
  "treasury:read",
] as const;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "workspace", label: "Workspace" },
  { id: "developers", label: "Developers" },
  { id: "integrations", label: "Integrations" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
];

function formatUsdc(minor: string) {
  return (Number(minor) / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function short(addr?: string | null) {
  if (!addr) return "—";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

function readTab(): Tab {
  if (typeof window === "undefined") return "workspace";
  const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
  return TABS.some((x) => x.id === t) ? (t as Tab) : "workspace";
}

export default function SettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTabState] = useState<Tab>("workspace");

  const [org, setOrg] = useState<Org | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "bad" | "">("");
  const [busy, setBusy] = useState(false);

  const [keyName, setKeyName] = useState("Partner key");
  const [scopes, setScopes] = useState<string[]>([...ALL_SCOPES]);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [probe, setProbe] = useState("");

  const [hookUrl, setHookUrl] = useState("");
  const [hookSecret, setHookSecret] = useState<string | null>(null);

  const [provider, setProvider] = useState<"odoo" | "erpnext">("odoo");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [db, setDb] = useState("odoo");

  useEffect(() => {
    setTabState(readTab());
  }, []);

  const setTab = useCallback(
    (next: Tab) => {
      setTabState(next);
      router.replace(`/app/settings?tab=${next}`);
    },
    [router],
  );

  const load = useCallback(async () => {
    const orgId = getOrgId()!;
    const [o, n, t, keys, hooks, erp, team, events] = await Promise.all([
      api<Org>(`/organizations/${orgId}`, { orgId }),
      api<Network>(`/organizations/${orgId}/payments/network`, { orgId }),
      api<Treasury>(`/organizations/${orgId}/treasury`, { orgId }).catch(() => null),
      api<ApiKeyRow[]>(`/organizations/${orgId}/api-keys`, { orgId }),
      api<WebhookRow[]>(`/organizations/${orgId}/webhooks`, { orgId }),
      api<Conn[]>(`/organizations/${orgId}/erp`, { orgId }),
      api<Member[]>(`/organizations/${orgId}/members`, { orgId }).catch(() => []),
      api<AuditRow[]>(`/organizations/${orgId}/audit`, { orgId }).catch(() => []),
    ]);
    setOrg(o);
    setNetwork(n);
    setTreasury(t);
    setApiKeys(keys);
    setWebhooks(hooks);
    setConns(erp);
    setMembers(team);
    setAudit(events.slice(0, 40));
  }, []);

  useEffect(() => {
    load().catch((e) => {
      setMsgTone("bad");
      setMsg((e as Error).message);
    });
  }, [load]);

  const curlExample = useMemo(() => {
    const key = rawKey || "avz_live_…";
    return `curl -s http://localhost:3001/api/v1/invoices \\\n  -H "Authorization: Bearer ${key}"`;
  }, [rawKey]);

  async function createKey(e: FormEvent) {
    e.preventDefault();
    const orgId = getOrgId()!;
    setBusy(true);
    setMsg("");
    setMsgTone("");
    setRawKey(null);
    setProbe("");
    try {
      const res = await api<{ rawKey: string; name: string }>(`/organizations/${orgId}/api-keys`, {
        method: "POST",
        orgId,
        body: JSON.stringify({ name: keyName, scopes }),
      });
      setRawKey(res.rawKey);
      setMsgTone("ok");
      setMsg(`API key “${res.name}” created — copy it now.`);
      // Live probe
      try {
        const invoices = await fetch("http://localhost:3001/api/v1/invoices", {
          headers: { Authorization: `Bearer ${res.rawKey}` },
        });
        if (!invoices.ok) throw new Error(`Probe HTTP ${invoices.status}`);
        const data = (await invoices.json()) as unknown[];
        setProbe(`Live · listed ${Array.isArray(data) ? data.length : 0} invoices with this key`);
      } catch (err) {
        setProbe(`Key saved, probe failed: ${(err as Error).message}`);
      }
      await load();
    } catch (err) {
      setMsgTone("bad");
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    const orgId = getOrgId()!;
    setBusy(true);
    try {
      await api(`/organizations/${orgId}/api-keys/${id}`, { method: "DELETE", orgId });
      setMsgTone("ok");
      setMsg("API key revoked");
      await load();
    } catch (err) {
      setMsgTone("bad");
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createWebhook(e: FormEvent) {
    e.preventDefault();
    const orgId = getOrgId()!;
    setBusy(true);
    setMsg("");
    try {
      const res = await api<{ secret: string }>(`/organizations/${orgId}/webhooks`, {
        method: "POST",
        orgId,
        body: JSON.stringify({
          url: hookUrl,
          events: [
            "invoice.verified",
            "invoice.held",
            "invoice.approved",
            "payment.submitted",
            "payment.failed",
            "payment.confirmed",
            "*",
          ],
          description: "Partner webhook",
        }),
      });
      setHookSecret(res.secret);
      setHookUrl("");
      setMsgTone("ok");
      setMsg("Webhook endpoint created — store the signing secret.");
      await load();
    } catch (err) {
      setMsgTone("bad");
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeWebhook(id: string) {
    const orgId = getOrgId()!;
    await api(`/organizations/${orgId}/webhooks/${id}`, { method: "DELETE", orgId });
    await load();
  }

  async function connectErp(e: FormEvent) {
    e.preventDefault();
    const orgId = getOrgId()!;
    setBusy(true);
    setMsg("");
    const credentials: Record<string, string> = {};
    if (apiKey) credentials.apiKey = apiKey;
    if (login) credentials.login = login;
    if (password) credentials.password = password;
    if (db) credentials.db = db;
    try {
      const res = await api<{ connection: Conn; test: { ok: boolean; detail?: string } }>(
        `/organizations/${orgId}/erp/connect`,
        {
          method: "POST",
          orgId,
          body: JSON.stringify({
            provider,
            baseUrl,
            credentials: Object.keys(credentials).length ? credentials : undefined,
          }),
        },
      );
      setMsgTone(res.test?.ok ? "ok" : "bad");
      setMsg(
        res.test?.ok
          ? `${provider} connected · ${res.test.detail || "ok"}`
          : `Saved ${provider} · remote ping: ${res.test?.detail || "unreachable"} (you can still Pull later)`,
      );
      setBaseUrl("");
      setApiKey("");
      setLogin("");
      setPassword("");
      await load();
    } catch (err) {
      setMsgTone("bad");
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function erpAction(kind: "test" | "pull", providerName: string) {
    const orgId = getOrgId()!;
    setBusy(true);
    setMsg("");
    try {
      if (kind === "test") {
        const res = await api<{ results: Array<{ ok: boolean; detail?: string; provider: string }> }>(
          `/organizations/${orgId}/erp/test`,
          { method: "POST", orgId, body: JSON.stringify({ provider: providerName }) },
        );
        setMsgTone(res.results.every((r) => r.ok) ? "ok" : "bad");
        setMsg(res.results.map((r) => `${r.provider}: ${r.ok ? "ok" : "fail"} — ${r.detail || ""}`).join(" · "));
      } else {
        const res = await api<{ summary: unknown }>(`/organizations/${orgId}/erp/pull`, {
          method: "POST",
          orgId,
          body: JSON.stringify({ provider: providerName }),
        });
        setMsgTone("ok");
        setMsg(`Pull complete: ${JSON.stringify(res.summary)}`);
        await load();
      }
    } catch (err) {
      setMsgTone("bad");
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function writeBackLatest() {
    const orgId = getOrgId()!;
    setBusy(true);
    try {
      const payments = await api<Array<{ id: string; status: string }>>(
        `/organizations/${orgId}/payments`,
        { orgId },
      );
      const settled = payments.find((p) => ["PAYMENT_CONFIRMED", "COMPLETED"].includes(p.status));
      if (!settled) {
        setMsgTone("bad");
        setMsg("No confirmed payment to write back");
        return;
      }
      const res = await api(`/organizations/${orgId}/erp/payments/${settled.id}/writeback`, {
        method: "POST",
        orgId,
      });
      setMsgTone("ok");
      setMsg(`Write-back: ${JSON.stringify(res)}`);
    } catch (err) {
      setMsgTone("bad");
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow={t("pages.settingsEyebrow")}
        title={t("pages.settingsTitle")}
        lead={t("pages.settingsLead")}
        actions={
          <button type="button" className="btn-dark" onClick={() => setFundOpen(true)}>
            Fund treasury
          </button>
        }
      />

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`settings-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg ? (
        <p className={`dash-flash${msgTone ? ` is-${msgTone}` : ""}`} style={{ marginTop: "0.75rem" }}>
          {msg}
        </p>
      ) : null}

      {tab === "workspace" ? (
        <>
          <div className="dash-grid is-2">
            <DashPanel title="Organization">
              <div className="dash-panel-body space-y-3">
                <div className="dash-stat">
                  <span>Legal name</span>
                  <strong className="!text-base">{org?.legalName || "—"}</strong>
                </div>
                <div className="dash-stat">
                  <span>Status</span>
                  <strong className="!text-base">{org?.status || "—"}</strong>
                </div>
                <div className="dash-stat">
                  <span>On-chain org</span>
                  <em className="!font-mono !text-[11px]">
                    {org?.treasuryConfig?.onChainOrgId || org?.onChainOrgId || "—"}
                  </em>
                </div>
              </div>
            </DashPanel>
            <DashPanel title="Settlement network">
              <div className="dash-panel-body space-y-3">
                <div className="dash-stat">
                  <span>Mode</span>
                  <strong className="!text-base !font-mono">{network?.settlementMode || "—"}</strong>
                </div>
                <div className="dash-stat">
                  <span>X Layer</span>
                  <strong className="!text-base">Chain {network?.chainId ?? "—"}</strong>
                </div>
                <div className="dash-stat">
                  <span>USDC</span>
                  <em className="!font-mono !text-[11px]">{short(network?.usdc)}</em>
                </div>
                <div className="dash-stat">
                  <span>Authorization</span>
                  <em className="!font-mono !text-[11px]">
                    {short(network?.contracts.paymentAuthorization)}
                  </em>
                </div>
              </div>
            </DashPanel>
          </div>
          <DashPanel title="Treasury">
            <div className="dash-grid is-3" style={{ padding: "1.1rem" }}>
              <div className="dash-stat">
                <span>Funding wallet</span>
                <em className="!font-mono !text-xs">{short(treasury?.fundingWalletAddress)}</em>
              </div>
              <div className="dash-stat">
                <span>Wallet USDC</span>
                <strong>
                  {treasury ? formatUsdc(treasury.balances.fundingWalletUsdcMinor) : "—"}
                </strong>
              </div>
              <div className="dash-stat">
                <span>Vault USDC</span>
                <strong>
                  {treasury ? formatUsdc(treasury.balances.vaultAvailableUsdcMinor) : "—"}
                </strong>
              </div>
            </div>
            <div className="px-4 pb-4">
              <button type="button" className="home-chip" onClick={() => router.push("/app/policies")}>
                Edit controls
              </button>
            </div>
          </DashPanel>
        </>
      ) : null}

      {tab === "developers" ? (
        <div className="dash-grid is-2">
          <DashPanel title="Partner API keys">
            <form onSubmit={createKey} className="dash-form" style={{ padding: "1rem" }}>
              <div>
                <label className="label">Name</label>
                <input className="input" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
              </div>
              <div>
                <label className="label">Scopes</label>
                <div className="flex flex-col gap-1 text-sm mt-1 max-h-40 overflow-auto">
                  {ALL_SCOPES.map((s) => (
                    <label key={s} className="flex items-center gap-2 font-mono text-xs">
                      <input
                        type="checkbox"
                        checked={scopes.includes(s)}
                        onChange={(e) => {
                          setScopes((prev) =>
                            e.target.checked ? [...prev, s] : prev.filter((x) => x !== s),
                          );
                        }}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="dash-form-actions">
                <button type="submit" className="btn-dark" disabled={busy || scopes.length === 0}>
                  {busy ? "Creating…" : "Generate key"}
                </button>
              </div>
              {rawKey ? (
                <div className="space-y-2">
                  <p className="text-xs font-mono break-all rounded-md bg-soft p-3 border border-line">
                    {rawKey}
                  </p>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(rawKey);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? "Copied" : "Copy key"}
                  </button>
                  {probe ? <p className="text-xs text-mute">{probe}</p> : null}
                  <pre className="text-[11px] font-mono whitespace-pre-wrap text-mute bg-soft p-3 rounded-md border border-line">
                    {curlExample}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-mute">
                  Base <code className="font-mono">http://localhost:3001/api/v1</code> · Bearer{" "}
                  <code className="font-mono">avz_live_…</code>
                </p>
              )}
            </form>
            {apiKeys.length === 0 ? (
              <DashEmpty>No API keys yet. Generate one to use the Partner API or CLI.</DashEmpty>
            ) : (
              <ul className="dash-list">
                {apiKeys.map((k) => (
                  <li key={k.id} className="dash-row">
                    <div className="dash-row-main">
                      <strong>{k.name}</strong>
                      <em className="!font-mono">
                        {k.keyPrefix}… · {k.revokedAt ? "revoked" : "live"}
                        {k.lastUsedAt ? ` · used ${new Date(k.lastUsedAt).toLocaleString()}` : ""}
                      </em>
                    </div>
                    {k.revokedAt ? (
                      <DashStatus>revoked</DashStatus>
                    ) : (
                      <button type="button" className="home-chip" disabled={busy} onClick={() => revokeKey(k.id)}>
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </DashPanel>

          <DashPanel title="Webhooks">
            <form onSubmit={createWebhook} className="dash-form" style={{ padding: "1rem" }}>
              <div>
                <label className="label">Endpoint URL</label>
                <input
                  className="input"
                  placeholder="https://hooks.example.com/avenza"
                  value={hookUrl}
                  onChange={(e) => setHookUrl(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-mute">
                Signed with <code className="font-mono">x-avenza-signature</code> · invoice + payment
                events.
              </p>
              <div className="dash-form-actions">
                <button type="submit" className="btn-dark" disabled={busy}>
                  Add webhook
                </button>
              </div>
              {hookSecret ? (
                <p className="text-xs font-mono break-all rounded-md bg-soft p-3 border border-line">
                  {hookSecret}
                </p>
              ) : null}
            </form>
            {webhooks.length === 0 ? (
              <DashEmpty>No webhooks configured.</DashEmpty>
            ) : (
              <ul className="dash-list">
                {webhooks.map((w) => (
                  <li key={w.id} className="dash-row">
                    <div className="dash-row-main">
                      <strong className="!text-sm !font-mono">{w.url}</strong>
                      <em>{w.active ? "active" : "inactive"}</em>
                    </div>
                    {w.active ? (
                      <button type="button" className="home-chip" onClick={() => revokeWebhook(w.id)}>
                        Revoke
                      </button>
                    ) : (
                      <DashStatus>off</DashStatus>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </DashPanel>
        </div>
      ) : null}

      {tab === "integrations" ? (
        <>
          <div className="dash-grid is-2">
            <DashPanel title="Connect Odoo / ERPNext">
              <form onSubmit={connectErp} className="dash-form" style={{ padding: "1rem" }}>
                <div>
                  <label className="label">Provider</label>
                  <select
                    className="input"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as "odoo" | "erpnext")}
                  >
                    <option value="odoo">Odoo</option>
                    <option value="erpnext">ERPNext</option>
                  </select>
                </div>
                <div>
                  <label className="label">Base URL</label>
                  <input
                    className="input"
                    required
                    placeholder="https://erp.yourcompany.com"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
                {provider === "odoo" ? (
                  <>
                    <div>
                      <label className="label">Database</label>
                      <input className="input" value={db} onChange={(e) => setDb(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Login</label>
                      <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Password</label>
                      <input
                        className="input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="label">API key</label>
                      <input
                        className="input"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">API secret</label>
                      <input
                        className="input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <p className="text-xs text-mute">
                  Credentials encrypted at rest. Connection is saved even if the remote host is
                  unreachable from this machine.
                </p>
                <div className="dash-form-actions">
                  <button className="btn-dark" type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save connection"}
                  </button>
                </div>
              </form>
            </DashPanel>
            <DashPanel title="Active connectors">
              {conns.length === 0 ? (
                <DashEmpty>No ERP connectors yet.</DashEmpty>
              ) : (
                <ul className="dash-list">
                  {conns.map((c) => (
                    <li key={c.id} className="dash-row">
                      <div className="dash-row-main">
                        <strong className="uppercase tracking-wide">{c.provider}</strong>
                        <em className="!font-mono">{c.baseUrl}</em>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="home-chip"
                          disabled={busy}
                          onClick={() => erpAction("test", c.provider)}
                        >
                          Test
                        </button>
                        <button
                          type="button"
                          className="home-chip"
                          disabled={busy}
                          onClick={() => erpAction("pull", c.provider)}
                        >
                          Pull bills
                        </button>
                        <DashStatus tone={c.status === "active" ? "ok" : "wait"}>{c.status}</DashStatus>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="p-4">
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => void writeBackLatest()}>
                  Write back latest settlement
                </button>
              </div>
            </DashPanel>
          </div>
        </>
      ) : null}

      {tab === "people" ? (
        <div className="dash-grid is-2">
          <DashPanel title="Invite">
            <form
              className="dash-form"
              style={{ padding: "1rem" }}
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const orgId = getOrgId()!;
                setBusy(true);
                setMsg("");
                try {
                  await api(`/organizations/${orgId}/members`, {
                    method: "POST",
                    orgId,
                    body: JSON.stringify({
                      email: String(fd.get("email") || ""),
                      fullName: String(fd.get("fullName") || ""),
                      role: String(fd.get("role") || "approver"),
                    }),
                  });
                  setMsgTone("ok");
                  setMsg("Member invited");
                  (e.target as HTMLFormElement).reset();
                  await load();
                } catch (err) {
                  setMsgTone("bad");
                  setMsg((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div>
                <label className="label">Email</label>
                <input className="input" name="email" type="email" required />
              </div>
              <div>
                <label className="label">Full name</label>
                <input className="input" name="fullName" required />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" name="role" defaultValue="approver">
                  <option value="admin">Admin</option>
                  <option value="approver">Approver</option>
                  <option value="payer">Payer</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>
              <div className="dash-form-actions">
                <button className="btn-dark" type="submit" disabled={busy}>
                  Invite
                </button>
              </div>
            </form>
          </DashPanel>
          <DashPanel title="Team">
            {members.length === 0 ? (
              <DashEmpty>No members loaded.</DashEmpty>
            ) : (
              <ul className="dash-list">
                {members.map((m) => (
                  <li key={m.id} className="dash-row">
                    <div className="dash-row-main">
                      <strong>{m.user?.fullName || "—"}</strong>
                      <em>
                        {m.user?.email} · {m.role}
                      </em>
                    </div>
                    <DashStatus tone={m.status === "active" ? "ok" : "neutral"}>{m.status}</DashStatus>
                  </li>
                ))}
              </ul>
            )}
          </DashPanel>
        </div>
      ) : null}

      {tab === "activity" ? (
        <DashPanel title="Audit trail">
          {audit.length === 0 ? (
            <DashEmpty>No recent events.</DashEmpty>
          ) : (
            <ul className="dash-list">
              {audit.map((a) => (
                <li key={a.id} className="dash-row">
                  <div className="dash-row-main">
                    <strong className="!font-mono !text-sm">{a.eventType}</strong>
                    <em>
                      {a.entityType} · {a.entityId.slice(0, 8)} ·{" "}
                      {new Date(a.createdAt).toLocaleString()}
                    </em>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashPanel>
      ) : null}

      <FundDepositModal
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        initial={treasury}
        onDeposited={() => load().catch(console.error)}
      />
    </DashPage>
  );
}
