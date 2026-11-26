"use client";

import Link from "next/link";
import { DOC_CATALOG } from "@/lib/docs";
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

      <ul className="app-docs-list">
        {DOC_CATALOG.map((doc, i) => (
          <li key={doc.slug}>
            <Link href={`/app/docs/${doc.slug}`} className="app-docs-row">
              <span className="app-docs-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="app-docs-row-body">
                <span className="app-docs-row-title">{doc.title}</span>
                <span className="app-docs-row-desc">{doc.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
