"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, getOrgId } from "@/lib/api";
import { DashEmpty, DashHeader, DashPage, DashPanel, DashStatus } from "@/components/dash";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const DEFAULT_CHAIN = 1952;
const DEFAULT_USDC = "0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3";

type Supplier = {
  id: string;
  legalName: string;
  payeeType?: string;
  verificationStatus: string;
  paymentDestinations: Array<{ id: string; walletAddress: string; verificationStatus: string }>;
};

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

export default function SuppliersPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Supplier[]>([]);
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState("");
  const [payeeType, setPayeeType] = useState<"supplier" | "client" | "business">("supplier");
  const [error, setError] = useState("");

  async function load() {
    const orgId = getOrgId();
    if (!orgId) return;
    setItems(await api(`/organizations/${orgId}/suppliers`, { orgId }));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    const orgId = getOrgId()!;
    try {
      const supplier = await api<{ id: string }>(`/organizations/${orgId}/suppliers`, {
        method: "POST",
        orgId,
        body: JSON.stringify({ legalName: name, payeeType }),
      });
      if (wallet) {
        const dest = await api<{ id: string }>(
          `/organizations/${orgId}/suppliers/${supplier.id}/payment-destinations`,
          {
            method: "POST",
            orgId,
            body: JSON.stringify({
              chainId: DEFAULT_CHAIN,
              tokenAddress: DEFAULT_USDC,
              walletAddress: wallet,
            }),
          },
        );
        await api(
          `/organizations/${orgId}/suppliers/${supplier.id}/payment-destinations/${dest.id}/approve`,
          { method: "POST", orgId },
        );
      }
      setName("");
      setWallet("");
      setPayeeType("supplier");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashPage>
      <DashHeader
        eyebrow={t("pages.payeesEyebrow")}
        title={t("pages.payeesTitle")}
        lead={t("payeesPage.lead")}
      />

      <DashPanel title={t("payeesPage.register")}>
        <form onSubmit={onCreate} className="dash-form is-3">
          <div>
            <label className="label">{t("common.legalName")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">{t("payeesPage.type")}</label>
            <select
              className="input"
              value={payeeType}
              onChange={(e) => setPayeeType(e.target.value as typeof payeeType)}
            >
              <option value="supplier">{t("payeesPage.typeSupplier")}</option>
              <option value="client">{t("payeesPage.typeClient")}</option>
              <option value="business">{t("payeesPage.typeBusiness")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("payeesPage.usdcDestination")}</label>
            <input
              className="input font-mono text-xs"
              placeholder="0x…"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
          </div>
          <div className="dash-form-actions dash-span-3">
            <button className="btn-dark">{t("common.register")}</button>
          </div>
          {error ? <p className="dash-span-3 text-sm text-ink">{error}</p> : null}
        </form>
      </DashPanel>

      <DashPanel title={t("payeesPage.directory")}>
        {items.length === 0 ? (
          <DashEmpty>{t("payeesPage.empty")}</DashEmpty>
        ) : (
          <ul className="dash-list">
            {items.map((s) => (
              <li key={s.id} className="dash-row">
                <div className="dash-row-main">
                  <strong>
                    {s.legalName}
                    {s.payeeType ? ` · ${s.payeeType}` : ""}
                  </strong>
                  <em>
                    {s.paymentDestinations[0]?.walletAddress
                      ? shortAddr(s.paymentDestinations[0].walletAddress)
                      : t("payeesPage.noDestination")}
                  </em>
                </div>
                <DashStatus>{s.verificationStatus}</DashStatus>
              </li>
            ))}
          </ul>
        )}
      </DashPanel>
    </DashPage>
  );
}
