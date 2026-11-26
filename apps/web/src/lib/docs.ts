import fs from "node:fs";
import path from "node:path";

export type DocMeta = {
  slug: string;
  title: string;
  description: string;
  file: string;
};

/** Curated documentation index shown on /docs and the landing page. */
export const DOC_CATALOG: DocMeta[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Install, environment variables, run locally, and troubleshoot.",
    file: "getting-started.md",
  },
  {
    slug: "product-guide",
    title: "Product guide",
    description: "Console modules, operator workflows, roles, and happy path.",
    file: "product-guide.md",
  },
  {
    slug: "architecture",
    title: "Architecture",
    description: "Trust boundaries, components, state machine, and settlement modes.",
    file: "architecture.md",
  },
  {
    slug: "api",
    title: "API reference",
    description: "REST endpoints, auth headers, and permissions.",
    file: "api.md",
  },
  {
    slug: "contracts",
    title: "Smart contracts",
    description: "Solidity catalog, authorization flow, and deploy scripts.",
    file: "contracts.md",
  },
  {
    slug: "deployments",
    title: "Deployments",
    description: "Live X Layer testnet addresses, policy IDs, and verification.",
    file: "deployments.md",
  },
  {
    slug: "tapeout-xlayer",
    title: "TapeOut & X Layer",
    description: "Live circuit eval, networks, native USDC, and env binding.",
    file: "tapeout-xlayer.md",
  },
  {
    slug: "security",
    title: "Security",
    description: "Threat model, secrets handling, and pre-mainnet checklist.",
    file: "security.md",
  },
  {
    slug: "mainnet-go-live",
    title: "Mainnet go-live",
    description: "Production checklist for X Layer 196 and native USDC.",
    file: "mainnet-go-live.md",
  },
  {
    slug: "development",
    title: "Development",
    description: "Workspaces, tests, and contributor code map.",
    file: "development.md",
  },
  {
    slug: "demo",
    title: "Demo runbook",
    description: "Seed users and local end-to-end walkthrough.",
    file: "demo.md",
  },
  {
    slug: "mvp-acceptance",
    title: "MVP acceptance",
    description: "Acceptance criteria and negative test cases.",
    file: "mvp-acceptance.md",
  },
];

function docsDir(): string {
  const candidates = [
    path.join(process.cwd(), "content/docs"),
    path.join(process.cwd(), "apps/web/content/docs"),
    path.join(process.cwd(), "../../docs"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0]!;
}

export function getDocMeta(slug: string): DocMeta | undefined {
  return DOC_CATALOG.find((d) => d.slug === slug);
}

export function readDocMarkdown(slug: string): string | null {
  const meta = getDocMeta(slug);
  if (!meta) return null;
  const filePath = path.join(docsDir(), meta.file);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}
