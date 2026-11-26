import Link from "next/link";
import { AvenzaLogo } from "@/components/AvenzaLogo";

export function DocsShell({
  children,
  activeSlug,
}: {
  children: React.ReactNode;
  activeSlug?: string;
}) {
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
              Docs
            </Link>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/" className="docs-top-link">
              Home
            </Link>
            <Link href="/login" className="docs-top-link">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="docs-footer">
        <div className="docs-footer-inner">
          <p className="docs-footer-mark">AVENZA documentation</p>
          {activeSlug ? (
            <Link href="/docs" className="docs-top-link">
              All topics
            </Link>
          ) : (
            <Link href="/" className="docs-top-link">
              Home
            </Link>
          )}
        </div>
      </footer>
    </main>
  );
}
