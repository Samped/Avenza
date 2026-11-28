"use client";

import { DocsShell } from "@/components/DocsShell";
import { DocsIndexList } from "@/components/DocViewer";
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

        <DocsIndexList basePath="/docs" variant="public" />
      </div>
    </DocsShell>
  );
}
