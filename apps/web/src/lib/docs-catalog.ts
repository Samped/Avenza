export type DocMeta = {
  slug: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  file: string;
};

/** Curated documentation index — safe for client components (no Node APIs). */
export const DOC_CATALOG: DocMeta[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    titleZh: "快速开始",
    description: "Install, environment variables, run locally, and troubleshoot.",
    descriptionZh: "安装、环境变量、本地运行与排查。",
    file: "getting-started.md",
  },
  {
    slug: "product-guide",
    title: "Product guide",
    titleZh: "产品指南",
    description: "Console modules, operator workflows, roles, and happy path.",
    descriptionZh: "控制台模块、操作流程、角色与主路径。",
    file: "product-guide.md",
  },
  {
    slug: "architecture",
    title: "Architecture",
    titleZh: "架构",
    description: "Trust boundaries, components, state machine, and settlement modes.",
    descriptionZh: "信任边界、组件、状态机与结算模式。",
    file: "architecture.md",
  },
  {
    slug: "api",
    title: "API reference",
    titleZh: "API 参考",
    description: "REST endpoints, auth headers, and permissions.",
    descriptionZh: "REST 接口、鉴权头与权限。",
    file: "api.md",
  },
  {
    slug: "contracts",
    title: "Smart contracts",
    titleZh: "智能合约",
    description: "Solidity catalog, authorization flow, and deploy scripts.",
    descriptionZh: "Solidity 目录、授权流程与部署脚本。",
    file: "contracts.md",
  },
  {
    slug: "deployments",
    title: "Deployments",
    titleZh: "部署",
    description: "Live X Layer mainnet addresses, policy IDs, and verification.",
    descriptionZh: "X Layer 测试网地址、策略 ID 与核验。",
    file: "deployments.md",
  },
  {
    slug: "tapeout-xlayer",
    title: "TapeOut & X Layer",
    titleZh: "TapeOut 与 X Layer",
    description: "Live circuit eval, networks, native USDC, and env binding.",
    descriptionZh: "实况电路评估、网络、原生 USDC 与环境绑定。",
    file: "tapeout-xlayer.md",
  },
  {
    slug: "security",
    title: "Security",
    titleZh: "安全",
    description: "Threat model, secrets handling, and pre-mainnet checklist.",
    descriptionZh: "威胁模型、密钥处理与主网上线前清单。",
    file: "security.md",
  },
  {
    slug: "mainnet-go-live",
    title: "Mainnet go-live",
    titleZh: "主网上线",
    description: "Production checklist for X Layer 196 and native USDC.",
    descriptionZh: "X Layer 196 与原生 USDC 生产清单。",
    file: "mainnet-go-live.md",
  },
  {
    slug: "development",
    title: "Development",
    titleZh: "开发",
    description: "Workspaces, tests, and contributor code map.",
    descriptionZh: "工作区、测试与贡献者代码地图。",
    file: "development.md",
  },
  {
    slug: "demo",
    title: "Demo runbook",
    titleZh: "演示手册",
    description: "Seed users and local end-to-end walkthrough.",
    descriptionZh: "种子用户与本地端到端演示。",
    file: "demo.md",
  },
  {
    slug: "mvp-acceptance",
    title: "MVP acceptance",
    titleZh: "MVP 验收",
    description: "Acceptance criteria and negative test cases.",
    descriptionZh: "验收标准与负面测试用例。",
    file: "mvp-acceptance.md",
  },
];

export function getDocMeta(slug: string): DocMeta | undefined {
  return DOC_CATALOG.find((d) => d.slug === slug);
}

export function localizeDoc(
  doc: DocMeta,
  locale: "en" | "zh",
): { title: string; description: string; slug: string; file: string } {
  return {
    slug: doc.slug,
    file: doc.file,
    title: locale === "zh" ? doc.titleZh : doc.title,
    description: locale === "zh" ? doc.descriptionZh : doc.description,
  };
}
