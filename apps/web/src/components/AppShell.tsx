"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AvenzaLogo } from "@/components/AvenzaLogo";
import { api, clearToken, getOrgId, getToken, setOrgId } from "@/lib/api";

/** Lean IA — secondary tools live under Settings tabs */
const navGroups = [
  {
    label: "Operations",
    links: [
      { href: "/app", label: "Overview" },
      { href: "/app/invoices", label: "Invoices" },
      { href: "/app/approvals", label: "Approvals" },
      { href: "/app/suppliers", label: "Payees" },
    ],
  },
  {
    label: "Finance",
    links: [
      { href: "/app/payments", label: "Payments" },
      { href: "/app/policies", label: "Controls" },
    ],
  },
  {
    label: "Workspace",
    links: [
      { href: "/app/settings", label: "Settings" },
      { href: "/app/docs", label: "Docs" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);

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
          <span className="animate-pulse">Loading workspace…</span>
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-quiet btn-sm"
              onClick={() => {
                clearToken();
                router.push("/login");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="shell-body">
        <aside className="shell-nav" aria-label="Primary">
          <nav>
            {navGroups.map((group) => (
              <div key={group.label} className="shell-nav-group">
                <p className="shell-nav-label">{group.label}</p>
                {group.links.map((l) => {
                  const active =
                    pathname === l.href || (l.href !== "/app" && pathname.startsWith(l.href));
                  return (
                    <Link key={l.href} href={l.href} className={`shell-nav-link${active ? " is-active" : ""}`}>
                      {l.label}
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
