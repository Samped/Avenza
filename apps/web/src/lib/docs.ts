import fs from "node:fs";
import path from "node:path";
import { DOC_CATALOG, getDocMeta, localizeDoc, type DocMeta } from "./docs-catalog";

export type { DocMeta };
export { DOC_CATALOG, getDocMeta, localizeDoc };

function docsDir(): string {
  // Prefer trees that include localized `zh/` bodies over the repo-root `docs/` mirror.
  const candidates = [
    path.join(process.cwd(), "content/docs"),
    path.join(process.cwd(), "apps/web/content/docs"),
    path.join(process.cwd(), "../../docs"),
  ];
  const withZh = candidates.find((dir) => fs.existsSync(path.join(dir, "zh")));
  if (withZh) return withZh;
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0]!;
}

/**
 * Server-only: read markdown from disk.
 * Chinese bodies live under `zh/<file>`; falls back to English if missing.
 * Do not import this module from client components.
 */
export function readDocMarkdown(slug: string, locale: "en" | "zh" = "en"): string | null {
  const meta = getDocMeta(slug);
  if (!meta) return null;
  const root = docsDir();
  const preferred =
    locale === "zh" ? path.join(root, "zh", meta.file) : path.join(root, meta.file);
  const fallback = path.join(root, meta.file);
  const filePath = fs.existsSync(preferred) ? preferred : fallback;
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

export function readDocMarkdownBoth(slug: string): { en: string | null; zh: string | null } {
  return {
    en: readDocMarkdown(slug, "en"),
    zh: readDocMarkdown(slug, "zh"),
  };
}
