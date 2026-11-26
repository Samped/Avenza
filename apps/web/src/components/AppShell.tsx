"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AvenzaLogo } from "@/components/AvenzaLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { api, clearToken, getOrgId, getToken, setOrgId } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [allowed, setAllowed] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);

  const navGroups = useMemo(
    () => [
      {
        labelKey: "nav.operations" as MessageKey,
        links: [
          { href: "/app", labelKey: "nav.overview" as MessageKey },
          { href: "/app/invoices", labelKey: "nav.invoices" as MessageKey },
          { href: "/app/approvals", labelKey: "nav.approvals" as MessageKey },
          { href: "/app/suppliers", labelKey: "nav.payees" as MessageKey },
        ],
      },
      {
        labelKey: "nav.finance" as MessageKey,
        links: [
          { href: "/app/payments", labelKey: "nav.payments" as MessageKey },
          { href: "/app/policies", labelKey: "nav.controls" as MessageKey },
        ],
      },
      {
        labelKey: "nav.workspace" as MessageKey,
        links: [
          { href: "/app/settings", labelKey: "nav.settings" as MessageKey },
          { href: "/app/docs", labelKey: "nav.docs" as MessageKey },
        ],
      },
    ],
    [],
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    api<{ organizations: Array<{ id: string; legalName?: string }> }>("/auth/me")
      .then((me) => {
        if (!me.organizations.length) {
          router.replace("/workspace/new");
          return;
        }
        if (!getOrgId()) setOrgId(me.organizations[0].id);
        const current = me.organizations.find((o) => o.id === getOrgId()) || me.organizations[0];
        setOrgName(current.legalName || null);
        setAllowed(true);
      })
      .catch(() => {
        clearToken();
        router.replace("/login");
      });
  }, [router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-mute">
        <div className="flex flex-col items-center gap-3">
          <AvenzaLogo tone="dark" size={28} withWordmark />
          <LanguageSwitcher tone="dark" />
          <span className="animate-pulse">{t("chrome.loadingWorkspace")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="shell min-h-screen">
      <header className="shell-top">
        <div className="shell-top-inner">
          <div className="flex items-center gap-4">
            <AvenzaLogo
              tone="dark"
              size={26}
              href="/app"
              withWordmark
              wordmarkClassName="font-display text-[1.05rem] font-semibold tracking-[-0.03em]"
            />
            {orgName ? (
              <>
                <span className="hidden h-4 w-px bg-line sm:block" />
                <span className="shell-org hidden sm:inline">{orgName}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher tone="dark" />
            <button
              type="button"
              className="btn-quiet btn-sm"
              onClick={() => {
                clearToken();
                router.push("/login");
              }}
            >
              {t("chrome.signOut")}
            </button>
          </div>
        </div>
      </header>

      <div className="shell-body">
        <aside className="shell-nav" aria-label={t("nav.operations")}>
          <nav>
            {navGroups.map((group) => (
              <div key={group.labelKey} className="shell-nav-group">
                <p className="shell-nav-label">{t(group.labelKey)}</p>
                {group.links.map((l) => {
                  const active =
                    pathname === l.href || (l.href !== "/app" && pathname.startsWith(l.href));
                  return (
                    <Link key={l.href} href={l.href} className={`shell-nav-link${active ? " is-active" : ""}`}>
                      {t(l.labelKey)}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
