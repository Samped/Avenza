import { notFound } from "next/navigation";
import { DocsShell } from "@/components/DocsShell";
import { DocViewer } from "@/components/DocViewer";
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
  const enSource = readDocMarkdown(slug, "en");
  const zhSource = readDocMarkdown(slug, "zh");
  if (!meta || !enSource) notFound();

  return (
    <DocsShell activeSlug={slug}>
      <DocViewer
        slug={slug}
        enSource={enSource}
        zhSource={zhSource || enSource}
        basePath="/docs"
        variant="public"
      />
    </DocsShell>
  );
}
