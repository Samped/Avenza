import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsShell } from "@/components/DocsShell";
import { Markdown } from "@/components/Markdown";
import { DOC_CATALOG, getDocMeta, readDocMarkdown } from "@/lib/docs";

export function generateStaticParams() {
  return DOC_CATALOG.map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const meta = getDocMeta(slug);
    return {
      title: meta ? `${meta.title} · AVENZA Docs` : "Docs · AVENZA",
      description: meta?.description,
    };
  });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = getDocMeta(slug);
  const source = readDocMarkdown(slug);
  if (!meta || !source) notFound();

  const idx = DOC_CATALOG.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? DOC_CATALOG[idx - 1] : null;
  const next = idx >= 0 && idx < DOC_CATALOG.length - 1 ? DOC_CATALOG[idx + 1] : null;

  // Page chrome already shows the formal title — drop duplicate leading H1 from markdown.
  const bodySource = source.replace(/^#\s+[^\n]+\n+/, "");

  return (
    <DocsShell activeSlug={slug}>
      <div className="docs-layout">
        <aside className="docs-sidebar" aria-label="Documentation topics">
          <p className="docs-sidebar-label">Topics</p>
          <nav className="docs-sidebar-nav">
            {DOC_CATALOG.map((doc, i) => {
              const active = doc.slug === slug;
              return (
                <Link
                  key={doc.slug}
                  href={`/docs/${doc.slug}`}
                  className={`docs-sidebar-link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="docs-sidebar-num">{String(i + 1).padStart(2, "0")}</span>
                  <span>{doc.title}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <article className="docs-article">
          <div className="docs-breadcrumb">
            <Link href="/docs">Documentation</Link>
            <span aria-hidden>/</span>
            <span>{meta.title}</span>
          </div>
          <h1 className="docs-article-title">{meta.title}</h1>
          <p className="docs-article-lede">{meta.description}</p>
          <div className="docs-article-rule" />
          <Markdown source={bodySource} />

          <nav className="docs-pager" aria-label="Adjacent topics">
            {prev ? (
              <Link href={`/docs/${prev.slug}`} className="docs-pager-card docs-pager-prev">
                <span className="docs-pager-label">Previous</span>
                <span className="docs-pager-title">{prev.title}</span>
                <span className="docs-pager-desc">{prev.description}</span>
              </Link>
            ) : (
              <div className="docs-pager-spacer" />
            )}
            {next ? (
              <Link href={`/docs/${next.slug}`} className="docs-pager-card docs-pager-next">
                <span className="docs-pager-label">Next</span>
                <span className="docs-pager-title">{next.title}</span>
                <span className="docs-pager-desc">{next.description}</span>
              </Link>
            ) : (
              <div className="docs-pager-spacer" />
            )}
          </nav>
        </article>
      </div>
    </DocsShell>
  );
}
