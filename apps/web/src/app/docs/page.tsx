import Link from "next/link";
import { DocsShell } from "@/components/DocsShell";
import { DOC_CATALOG } from "@/lib/docs";

export const metadata = {
  title: "Documentation · AVENZA",
  description: "AVENZA product, architecture, API, contracts, and TapeOut / X Layer guides",
};

export default function DocsIndexPage() {
  return (
    <DocsShell>
      <div className="docs-home">
        <header className="docs-home-intro">
          <p className="docs-home-eyebrow">Documentation</p>
          <h1 className="docs-home-title">Reference</h1>
          <p className="docs-home-lead">
            Setup, console workflows, API surface, contracts, and how AVENZA uses TapeOut on X Layer.
          </p>
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
