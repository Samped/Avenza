import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { DOC_CATALOG, getDocMeta, readDocMarkdown } from "@/lib/docs";

export function generateStaticParams() {
  return DOC_CATALOG.map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const meta = getDocMeta(slug);
    return {
      title: meta ? `${meta.title} · Docs · AVENZA` : "Docs · AVENZA",
      description: meta?.description,
    };
  });
}

export default async function AppDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = getDocMeta(slug);
  const source = readDocMarkdown(slug);
  if (!meta || !source) notFound();

  const idx = DOC_CATALOG.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? DOC_CATALOG[idx - 1] : null;
  const next = idx >= 0 && idx < DOC_CATALOG.length - 1 ? DOC_CATALOG[idx + 1] : null;

  const bodySource = source.replace(/^#\s+[^\n]+\n+/, "");

  return (
    <div className="app-docs">
      <div className="app-docs-layout">
        <aside className="app-docs-sidebar" aria-label="Documentation topics">
          <p className="app-docs-sidebar-label">Topics</p>
          <nav className="app-docs-sidebar-nav">
            {DOC_CATALOG.map((doc) => {
              const active = doc.slug === slug;
              return (
                <Link
                  key={doc.slug}
                  href={`/app/docs/${doc.slug}`}
                  className={`app-docs-sidebar-link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {doc.title}
                </Link>
              );
            })}
          </nav>
        </aside>

        <article className="app-docs-article">
          <div className="app-docs-breadcrumb">
            <Link href="/app/docs">Docs</Link>
            <span aria-hidden>/</span>
            <span>{meta.title}</span>
          </div>
          <header className="dash-header" style={{ marginBottom: "0.5rem" }}>
            <h1 className="dash-title">{meta.title}</h1>
            <p className="dash-lead">{meta.description}</p>
          </header>
          <div className="app-docs-rule" />
          <div className="app-docs-body">
            <Markdown source={bodySource} docBase="/app/docs" />
          </div>

          <nav className="app-docs-pager" aria-label="Adjacent topics">
            {prev ? (
              <Link href={`/app/docs/${prev.slug}`} className="app-docs-pager-card">
                <span className="app-docs-pager-label">Previous</span>
                <span className="app-docs-pager-title">{prev.title}</span>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link href={`/app/docs/${next.slug}`} className="app-docs-pager-card is-next">
                <span className="app-docs-pager-label">Next</span>
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
