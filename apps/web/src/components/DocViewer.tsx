"use client";

import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { DOC_CATALOG, localizeDoc, type DocMeta } from "@/lib/docs-catalog";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function stripLeadingH1(source: string) {
  return source.replace(/^#\s+[^\n]+\n+/, "");
}

export function DocViewer({
  slug,
  enSource,
  zhSource,
  basePath,
  variant = "public",
}: {
  slug: string;
  enSource: string;
  zhSource: string;
  basePath: "/docs" | "/app/docs";
  variant?: "public" | "app";
}) {
  const { locale, t } = useI18n();
  const meta = DOC_CATALOG.find((d) => d.slug === slug);
  if (!meta) return null;

  const localized = localizeDoc(meta, locale);
  const source = stripLeadingH1(locale === "zh" ? zhSource || enSource : enSource);
  const idx = DOC_CATALOG.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? localizeDoc(DOC_CATALOG[idx - 1]!, locale) : null;
  const next =
    idx >= 0 && idx < DOC_CATALOG.length - 1 ? localizeDoc(DOC_CATALOG[idx + 1]!, locale) : null;

  if (variant === "app") {
    return (
      <div className="app-docs">
        <div className="app-docs-layout">
          <aside className="app-docs-sidebar" aria-label={t("docsUi.topics")}>
            <p className="app-docs-sidebar-label">{t("docsUi.topics")}</p>
            <nav className="app-docs-sidebar-nav">
              {DOC_CATALOG.map((doc) => {
                const item = localizeDoc(doc, locale);
                const active = doc.slug === slug;
                return (
                  <Link
                    key={doc.slug}
                    href={`${basePath}/${doc.slug}`}
                    className={`app-docs-sidebar-link${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <article className="app-docs-article">
            <div className="app-docs-breadcrumb">
              <Link href={basePath}>{t("docsUi.docs")}</Link>
              <span aria-hidden>/</span>
              <span>{localized.title}</span>
            </div>
            <header className="dash-header" style={{ marginBottom: "0.5rem" }}>
              <h1 className="dash-title">{localized.title}</h1>
              <p className="dash-lead">{localized.description}</p>
            </header>
            <div className="app-docs-rule" />
            <div className="app-docs-body" key={locale}>
              <Markdown source={source} docBase={basePath} />
            </div>

            <nav className="app-docs-pager" aria-label={t("docsUi.topics")}>
              {prev ? (
                <Link href={`${basePath}/${prev.slug}`} className="app-docs-pager-card">
                  <span className="app-docs-pager-label">{t("docsUi.previous")}</span>
                  <span className="app-docs-pager-title">{prev.title}</span>
                </Link>
              ) : (
                <div />
              )}
              {next ? (
                <Link href={`${basePath}/${next.slug}`} className="app-docs-pager-card is-next">
                  <span className="app-docs-pager-label">{t("docsUi.next")}</span>
                  <span className="app-docs-pager-title">{next.title}</span>
                </Link>
              ) : (
                <div />
              )}
            </nav>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="docs-layout">
      <aside className="docs-sidebar" aria-label={t("docsUi.topics")}>
        <p className="docs-sidebar-label">{t("docsUi.topics")}</p>
        <nav className="docs-sidebar-nav">
          {DOC_CATALOG.map((doc, i) => {
            const item = localizeDoc(doc, locale);
            const active = doc.slug === slug;
            return (
              <Link
                key={doc.slug}
                href={`${basePath}/${doc.slug}`}
                className={`docs-sidebar-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="docs-sidebar-num">{String(i + 1).padStart(2, "0")}</span>
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <article className="docs-article">
        <div className="docs-breadcrumb">
          <Link href={basePath}>{t("docsUi.documentation")}</Link>
          <span aria-hidden>/</span>
          <span>{localized.title}</span>
        </div>
        <h1 className="docs-article-title">{localized.title}</h1>
        <p className="docs-article-lede">{localized.description}</p>
        <div className="docs-article-rule" />
        <div key={locale}>
          <Markdown source={source} />
        </div>

        <nav className="docs-pager" aria-label={t("docsUi.topics")}>
          {prev ? (
            <Link href={`${basePath}/${prev.slug}`} className="docs-pager-card docs-pager-prev">
              <span className="docs-pager-label">{t("docsUi.previous")}</span>
              <span className="docs-pager-title">{prev.title}</span>
              <span className="docs-pager-desc">{prev.description}</span>
            </Link>
          ) : (
            <div className="docs-pager-spacer" />
          )}
          {next ? (
            <Link href={`${basePath}/${next.slug}`} className="docs-pager-card docs-pager-next">
              <span className="docs-pager-label">{t("docsUi.next")}</span>
              <span className="docs-pager-title">{next.title}</span>
              <span className="docs-pager-desc">{next.description}</span>
            </Link>
          ) : (
            <div className="docs-pager-spacer" />
          )}
        </nav>
      </article>
    </div>
  );
}

export function DocsIndexList({
  basePath,
  variant = "public",
}: {
  basePath: "/docs" | "/app/docs";
  variant?: "public" | "app";
}) {
  const { locale } = useI18n();

  if (variant === "app") {
    return (
      <ul className="app-docs-list">
        {DOC_CATALOG.map((doc, i) => {
          const item = localizeDoc(doc, locale);
          return (
            <li key={doc.slug}>
              <Link href={`${basePath}/${doc.slug}`} className="app-docs-row">
                <span className="app-docs-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="app-docs-row-body">
                  <span className="app-docs-row-title">{item.title}</span>
                  <span className="app-docs-row-desc">{item.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="docs-home-list">
      {DOC_CATALOG.map((doc) => {
        const item = localizeDoc(doc, locale);
        return (
          <li key={doc.slug}>
            <Link href={`${basePath}/${doc.slug}`} className="docs-home-row">
              <span className="docs-home-row-title">{item.title}</span>
              <span className="docs-home-row-desc">{item.description}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export type { DocMeta };
