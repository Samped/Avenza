"use client";

import Link from "next/link";
import { DocsIndexList } from "@/components/DocViewer";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AppDocsIndexPage() {
  const { t } = useI18n();

  return (
    <div className="app-docs">
      <header className="dash-header">
        <p className="dash-eyebrow">{t("pages.docsEyebrow")}</p>
        <h1 className="dash-title">{t("pages.docsTitle")}</h1>
        <p className="dash-lead">
          {t("pages.docsLead")}{" "}
          <Link href="/docs" className="app-docs-inline-link">
            /docs
          </Link>
          .
        </p>
      </header>

      <DocsIndexList basePath="/app/docs" variant="app" />
    </div>
  );
}
