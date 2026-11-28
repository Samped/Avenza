# 开发

## Workspaces

```bash
npm run build -w @avenza/shared
npm run build -w @avenza/chain
npm run build -w @avenza/api
npm run build -w @avenza/web
npm run build -w @avenza/worker
```

根目录 `npm run build` 按顺序构建以上全部。

## 开发服务器

| 脚本 | 包 |
|--------|---------|
| `npm run dev:api` | Nest / tsx watch（见包脚本） |
| `npm run dev:web` | Next.js |
| `npm run dev:worker` | BullMQ worker |

修改 `@avenza/shared` 或 `@avenza/chain` 后，重启 API 前先重建这些包。

## 数据库

```bash
npm run db:generate   # Prisma client
npm run db:push       # 推送 schema（开发）
npm run db:migrate    # 启用迁移时使用
npm run db:seed       # 演示组织 + 用户 + 绑定 TapeOut 的策略
```

Schema：[`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)

## 合约

```bash
cd contracts
forge build
forge test
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

## 测试

```bash
npm test
npm run circuits:test
cd contracts && forge test
./scripts/tapeout-verify.sh
```

## 代码图（API）

| 模块 | Path |
|--------|------|
| 认证 | `apps/api/src/auth` |
| 组织 | `apps/api/src/organizations` |
| 供应商 | `apps/api/src/suppliers` |
| 发票 | `apps/api/src/invoices` |
| 审批 | `apps/api/src/approvals` |
| 策略 | `apps/api/src/policies` |
| 付款 / 结算 | `apps/api/src/payments` |
| 对账 | `apps/api/src/reconciliation` |
| ERP | `apps/api/src/erp` |
| 审计 | `apps/api/src/audit` |
| 存储 | `apps/api/src/storage` |

## 代码图（Web）

App Router 位于 `apps/web/src/app`。共享 UI：`components/`（`AppShell`、`AuthFrame`、`AvenzaLogo`、`OrbitLogos`、`BrandLogos`）。API 客户端：`lib/api.ts`。

## 约定

- 请求体优先使用 `@avenza/shared` 中的 Zod schema。  
- 组织作用域路由始终经 `JwtAuthGuard` + `OrgGuard`。  
- 金额为**整数最小单位**（USDC 6 位小数）。  
- 切勿将桥接 USDC 当作原生 USDC。  