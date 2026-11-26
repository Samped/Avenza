export type Locale = "en" | "zh";

export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: "en", label: "English", short: "EN" },
  { id: "zh", label: "中文", short: "中文" },
];

export const LOCALE_STORAGE_KEY = "avenza-locale";

const en = {
  brand: "AVENZA",
  language: "Language",
  nav: {
    operations: "Operations",
    finance: "Finance",
    workspace: "Workspace",
    overview: "Overview",
    invoices: "Invoices",
    approvals: "Approvals",
    payees: "Payees",
    payments: "Payments",
    controls: "Controls",
    settings: "Settings",
    docs: "Docs",
  },
  chrome: {
    signIn: "Sign in",
    signOut: "Sign out",
    createAccount: "Create account",
    getStarted: "Get started",
    home: "Home",
    docs: "Docs",
    allTopics: "All topics",
    loadingWorkspace: "Loading workspace…",
    documentation: "Documentation",
    avenzaDocs: "AVENZA documentation",
  },
  landing: {
    headline: "Programmable settlement for business payments.",
    lead:
      "Verify invoices. Enforce policy. Settle native USDC on X Layer — with TapeOut circuits and smart-contract authorization before funds move.",
    nativeUsdc: "Native USDC",
    xlayer: "X Layer",
    tapeout: "TapeOut",
    footer: "Financial operations infrastructure",
  },
  auth: {
    signInTitle: "Sign in",
    registerTitle: "Create account",
    workEmail: "Work email",
    password: "Password",
    fullName: "Full name",
    signingIn: "Signing in…",
    creating: "Creating…",
    noAccount: "No account yet?",
    haveAccount: "Already have an account?",
    createLink: "Create an account",
    signInLink: "Sign in",
    heroTitle: "Settlement with controls, not chaos.",
    heroLead: "Approvals, TapeOut evaluation, and on-chain authorization before any USDC moves.",
  },
  workspace: {
    title: "Create workspace",
    legalName: "Organization legal name",
    submit: "Create workspace",
    creating: "Creating…",
  },
  pages: {
    overviewEyebrow: "Home",
    overviewTitle: "Overview",
    overviewLead: "Native USDC settlement on X Layer — pay, fund, approve.",
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    syncing: "Syncing…",
    needAttention: "need attention",
    allClear: "All clear",
    workspaceFallback: "Workspace",
    payClient: "Pay client",
    groupPay: "Group pay",
    newInvoice: "New invoice",
    paymentsEyebrow: "Settlement",
    paymentsTitle: "Payments",
    paymentsLead:
      "Send USDC on X Layer — invoices, direct payouts, or groups. Vault covers vendor amount plus platform and gas-recovery fees.",
    invoicesEyebrow: "Accounts payable",
    invoicesTitle: "Invoices",
    invoicesLead: "Upload, extract, verify, and prepare invoices for approval.",
    approvalsEyebrow: "Controls",
    approvalsTitle: "Approvals",
    approvalsLead: "Dual-control decisions before funds can move.",
    payeesEyebrow: "Counterparties",
    payeesTitle: "Payees",
    payeesLead: "Register and verify payment destinations before settle.",
    controlsEyebrow: "Policy",
    controlsTitle: "Controls",
    controlsLead: "Spend bands and TapeOut-bound payment policies.",
    settingsEyebrow: "Workspace",
    settingsTitle: "Settings",
    settingsLead: "Organization, developers, integrations, people, and activity.",
    docsEyebrow: "Reference",
    docsTitle: "Docs",
    docsLead: "Setup, console workflows, API, contracts, and TapeOut on X Layer.",
    treasury: "Treasury",
  },
} as const;

type Dict = {
  [K in keyof typeof en]: (typeof en)[K] extends string
    ? string
    : { [P in keyof (typeof en)[K]]: string };
};

const zh: Dict = {
  brand: "AVENZA",
  language: "语言",
  nav: {
    operations: "运营",
    finance: "财务",
    workspace: "工作区",
    overview: "总览",
    invoices: "发票",
    approvals: "审批",
    payees: "收款方",
    payments: "付款",
    controls: "风控",
    settings: "设置",
    docs: "文档",
  },
  chrome: {
    signIn: "登录",
    signOut: "退出",
    createAccount: "创建账户",
    getStarted: "开始使用",
    home: "首页",
    docs: "文档",
    allTopics: "全部主题",
    loadingWorkspace: "正在加载工作区…",
    documentation: "文档",
    avenzaDocs: "AVENZA 文档",
  },
  landing: {
    headline: "面向企业支付的可编程结算。",
    lead:
      "核验发票、执行策略，再在 X Layer 上结算原生 USDC——资金划转前经 TapeOut 电路与智能合约授权。",
    nativeUsdc: "原生 USDC",
    xlayer: "X Layer",
    tapeout: "TapeOut",
    footer: "金融运营基础设施",
  },
  auth: {
    signInTitle: "登录",
    registerTitle: "创建账户",
    workEmail: "工作邮箱",
    password: "密码",
    fullName: "姓名",
    signingIn: "正在登录…",
    creating: "正在创建…",
    noAccount: "还没有账户？",
    haveAccount: "已有账户？",
    createLink: "创建账户",
    signInLink: "登录",
    heroTitle: "有管控的结算，而非混乱。",
    heroLead: "审批、TapeOut 评估与链上授权之后，USDC 才会划转。",
  },
  workspace: {
    title: "创建工作区",
    legalName: "企业法定名称",
    submit: "创建工作区",
    creating: "正在创建…",
  },
  pages: {
    overviewEyebrow: "首页",
    overviewTitle: "总览",
    overviewLead: "在 X Layer 上结算原生 USDC——付款、注资、审批。",
    goodMorning: "早上好",
    goodAfternoon: "下午好",
    goodEvening: "晚上好",
    syncing: "同步中…",
    needAttention: "项待处理",
    allClear: "一切正常",
    workspaceFallback: "工作区",
    payClient: "付款给客户",
    groupPay: "批量付款",
    newInvoice: "新建发票",
    paymentsEyebrow: "结算",
    paymentsTitle: "付款",
    paymentsLead:
      "在 X Layer 上发送 USDC——发票付款、直接付款或批量付款。金库需覆盖收款金额以及平台费与 Gas 回收费。",
    invoicesEyebrow: "应付账款",
    invoicesTitle: "发票",
    invoicesLead: "上传、抽取、核验发票并提交审批。",
    approvalsEyebrow: "管控",
    approvalsTitle: "审批",
    approvalsLead: "资金划转前的双重控制决策。",
    payeesEyebrow: "交易对手",
    payeesTitle: "收款方",
    payeesLead: "结算前登记并核验收款地址。",
    controlsEyebrow: "策略",
    controlsTitle: "风控",
    controlsLead: "支出区间与绑定 TapeOut 的付款策略。",
    settingsEyebrow: "工作区",
    settingsTitle: "设置",
    settingsLead: "组织、开发者、集成、成员与活动记录。",
    docsEyebrow: "参考",
    docsTitle: "文档",
    docsLead: "安装、控制台流程、API、合约以及 X Layer 上的 TapeOut。",
    treasury: "金库",
  },
};

export const dictionaries: Record<Locale, Dict> = { en, zh };

export type MessageKey =
  | `nav.${keyof typeof en.nav}`
  | `chrome.${keyof typeof en.chrome}`
  | `landing.${keyof typeof en.landing}`
  | `auth.${keyof typeof en.auth}`
  | `workspace.${keyof typeof en.workspace}`
  | `pages.${keyof typeof en.pages}`
  | "brand"
  | "language";

export function translate(locale: Locale, key: MessageKey): string {
  const [group, leaf] = key.split(".") as [keyof Dict, string];
  if (!leaf) {
    const top = dictionaries[locale][key as "brand" | "language"];
    return typeof top === "string" ? top : key;
  }
  const section = dictionaries[locale][group];
  if (section && typeof section === "object" && leaf in section) {
    return (section as Record<string, string>)[leaf]!;
  }
  const fallback = dictionaries.en[group];
  if (fallback && typeof fallback === "object" && leaf in fallback) {
    return (fallback as Record<string, string>)[leaf]!;
  }
  return key;
}

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "en" || v === "zh";
}
