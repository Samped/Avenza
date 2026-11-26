"use client";

import Link from "next/link";
import { DocsShell } from "@/components/DocsShell";
import { DOC_CATALOG } from "@/lib/docs";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function DocsIndexPage() {
  const { t } = useI18n();

  return (
    <DocsShell>
      <div className="docs-home">
        <header className="docs-home-intro">
          <p className="docs-home-eyebrow">{t("chrome.documentation")}</p>
          <h1 className="docs-home-title">{t("pages.docsEyebrow")}</h1>
          <p className="docs-home-lead">{t("pages.docsLead")}</p>
        </header>

        <ul className="docs-home-list">
          {DOC_CATALOG.map((doc) => (
            <li key={doc.slug}>
              <Link href={`/docs/${doc.slug}`} className="docs-home-row">
                <span className="docs-home-row-title">{doc.title}</span>
                <span className="docs-home-row-desc">{doc.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </DocsShell>
  );
}
