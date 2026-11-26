"use client";

import Link from "next/link";
import { AvenzaLogo } from "@/components/AvenzaLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export function DocsShell({
  children,
  activeSlug,
}: {
  children: React.ReactNode;
  activeSlug?: string;
}) {
  const { t } = useI18n();

  return (
    <main className="docs-shell min-h-screen">
      <header className="docs-topbar">
        <div className="docs-topbar-inner">
          <div className="flex items-center gap-5">
            <AvenzaLogo
              tone="dark"
              size={24}
              href="/"
              withWordmark
              wordmarkClassName="docs-brand-wordmark"
            />
            <Link href="/docs" className="docs-top-link hidden sm:inline">
              {t("chrome.docs")}
            </Link>
          </div>
          <nav className="flex items-center gap-3 sm:gap-5">
            <LanguageSwitcher tone="docs" />
            <Link href="/" className="docs-top-link">
              {t("chrome.home")}
            </Link>
            <Link href="/login" className="docs-top-link">
              {t("chrome.signIn")}
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="docs-footer">
        <div className="docs-footer-inner">
          <p className="docs-footer-mark">{t("chrome.avenzaDocs")}</p>
          {activeSlug ? (
            <Link href="/docs" className="docs-top-link">
              {t("chrome.allTopics")}
            </Link>
          ) : (
            <Link href="/" className="docs-top-link">
              {t("chrome.home")}
            </Link>
          )}
        </div>
      </footer>
    </main>
  );
}
