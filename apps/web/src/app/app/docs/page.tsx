import Link from "next/link";
import { DOC_CATALOG } from "@/lib/docs";

export const metadata = {
  title: "Docs · AVENZA",
  description: "In-console documentation for AVENZA operators and integrators",
};

export default function AppDocsIndexPage() {
  return (
    <div className="app-docs">
      <header className="dash-header">
        <p className="dash-eyebrow">Reference</p>
        <h1 className="dash-title">Docs</h1>
        <p className="dash-lead">
          Setup, console workflows, API, contracts, and TapeOut on X Layer — same catalog as public{" "}
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
