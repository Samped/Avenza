# 快速入门

从全新克隆到在本地运行 AVENZA API 与 Web 控制台。

## 前置条件

| 工具 | 说明 |
|------|--------|
| **Node.js** | ≥ 22（`node -v`） |
| **npm** | Workspaces（随 Node 附带） |
| **Postgres** | `npm run db:up`（嵌入式）**或** Docker Compose |
| **Redis** | Worker 需要；建议始终启用 |
| **Foundry** | 可选 — 仅用于合约部署/测试 |
| **Git** | 克隆仓库 |

## 1. 克隆与安装

```bash
cd Avenza
cp .env.example .env
npm install
```

本地开发至少设置：

- `JWT_SECRET` / `SESSION_SECRET`
- `ENCRYPTION_KEY`（64 位十六进制字符）— 托管（资金钱包密钥、ERP）
- `AVENZA_FIELD_ENCRYPTION_KEY` — 业务字段静态加密（备注、抽取、联系人）

`.env.example` 已将嵌入式 Postgres 指向 `127.0.0.1:54329`，X Layer **主网** `196`。

> 仅当配置了合约与 `RELAYER_PRIVATE_KEY` 时，结算才为**纯链上**。模拟结算路径已移除。无合约时，付款保持阻塞（`settlementMode: blocked`），直至你部署或指向 [deployments.md](./deployments.md) 中的测试网地址。

## 2. 数据库与 Redis

### 方案 A — 嵌入式 Postgres（本地默认）

```bash
npm run db:up
```

监听 **54329**（`EMBEDDED_PG_PORT`），与 `.env.example` 一致。

### 方案 B — Docker Compose

```bash
docker compose up -d postgres redis
```

然后设置 `DATABASE_URL=postgresql://avenza:avenza@127.0.0.1:5432/avenza`。

### Redis

若未使用 Compose：

```bash
docker compose up -d redis
```

### Schema 与种子数据

```bash
npm run db:generate
npm run db:push
# 需在 .env 中设置 DEMO_SEED_PASSWORD（≥10 字符）
npm run db:seed
```

种子数据会创建组织 **Avenza Demo Trading Ltd**、已验证收款方、绑定 TapeOut 的付款策略，以及演示用户（密码 = `DEMO_SEED_PASSWORD`）。

**切勿对生产数据库执行 `db:seed`** — 会清空组织数据。

## 3. 构建包并启动

```bash
npm run build -w @avenza/shared
npm run build -w @avenza/chain
```

| 终端 | 命令 | 端口 |
|----------|---------|------|
| API | `npm run dev:api` | 3001 |
| Web | `npm run dev:web` | 3000 |
| Worker | `npm run dev:worker`（可选） | — |

或在根目录：`npm run dev`（同时启动 API + Web + Worker）。

| 入口 | URL |
|---------|-----|
| 控制台 | http://localhost:3000/app |
| 登录 | http://localhost:3000/login |
| 公开文档 | http://localhost:3000/docs |
| 应用内文档 | http://localhost:3000/app/docs |
| Swagger | http://localhost:3001/api/docs |
| 健康检查 | http://localhost:3001/api/v1/health |

### 种子账号登录

在 `npm run db:seed` 前于 `.env` 设置 `DEMO_SEED_PASSWORD`。账号：

| 邮箱 | 角色 |
|-------|------|
| `admin@avenza.demo` | admin |
| `approver@avenza.demo` | approver |
| `payer@avenza.demo` | payer |

## 4. 环境变量速查

### 应用 / 认证 / 加密

| 变量 | 用途 |
|----------|---------|
| `NODE_ENV` | `development` / `production` |
| `APP_URL` | Web 源（CORS） |
| `API_URL` / `API_PORT` | API 绑定 |
| `NEXT_PUBLIC_API_URL` | 浏览器 → API（`…/api/v1`） |
| `DATABASE_URL` | Postgres |
| `REDIS_URL` | BullMQ |
| `JWT_SECRET` | 访问令牌（生产环境必填） |
| `ENCRYPTION_KEY` | 托管密钥（生产环境必填） |
| `AVENZA_FIELD_ENCRYPTION_KEY` | 字段加密（生产环境必填） |
| `INTERNAL_WEBHOOK_TOKEN` | Worker → API（生产环境必填） |
| `REQUIRED_CONFIRMATIONS` | 主网建议 `≥ 3` |

### X Layer 结算

| 变量 | 用途 |
|----------|---------|
| `XLAYER_CHAIN_ID` | 主网 `196`（默认）或测试网 `1952` |
| `XLAYER_RPC_URL` | JSON-RPC |
| `USDC_TOKEN_ADDRESS` | 仅**原生** USDC |
| `RELAYER_PRIVATE_KEY` | 授权 + 执行 |
| `PAYMENT_AUTHORIZATION_ADDRESS` / `TREASURY_ADDRESS` / 其他 `*_ADDRESS` | 已部署套件 |
| `ALLOW_TAPEOUT_LOCAL_FALLBACK` | 实时评估设 `false`（生产 / 链 196 强制关闭） |

原生 USDC：

- 主网 `196`：`0xB6CEceAB302E2E4948951eE7843FC24E92933061`
- 测试网 `1952`：`0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`
- 主网 `196`：`0xB6CEceAB302E2E4948951eE7843FC24E92933061`

### TapeOut

| 变量 | 用途 |
|----------|---------|
| `TAPEOUT_PROCESSOR_ADDRESS` | 主网默认 Cerebr |
| `TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID` | 默认 `1` |
| `TAPEOUT_EVAL_CHAIN_ID` | 通常为 `196` |
| `TAPEOUT_RPC_URL` | 评估 RPC |

## 5. 可选：实时测试网结算

1. 从 [deployments.md](./deployments.md) 复制合约地址到 `.env`。
2. 设置有余额的 `RELAYER_PRIVATE_KEY`（OKB 作 Gas）。
3. 通过 **概览 → 充值** 存入原生 USDC（资金钱包 → 金库）。
4. 结算前验证收款方；需要时完成双控审批。
5. 从 **付款** 或发票详情页付款。

主网切换：[mainnet-go-live.md](./mainnet-go-live.md)。

## 6. 验证

```bash
curl -s http://localhost:3001/api/v1/health
./scripts/tapeout-verify.sh
./scripts/smoke-mvp.sh
```

## 故障排除

| 现象 | 处理 |
|---------|-----|
| 数据库连接被拒绝 | `npm run db:up` 或 Docker Postgres；检查 `DATABASE_URL` 端口 |
| Worker 中 Redis 报错 | `docker compose up -d redis` |
| Web 无法访问 API | 对齐 `NEXT_PUBLIC_API_URL`；重启 Next |
| TapeOut 评估失败 | 检查 `TAPEOUT_RPC_URL`；仅本地：`ALLOW_TAPEOUT_LOCAL_FALLBACK=true` |
| 结算被阻塞 | 设置合约 + relayer；为金库注资 |
| 「收款方未验证」 | 结算前在 **收款方** 下验证收款方与目的地 |
| 结算失败 / 勿重建付款 | 在**同一**付款 id 上重试 `/execute` |

## 下一步

- [产品指南](./product-guide.md) — 操作控制台  
- [部署](./deployments.md) — 线上 X Layer 地址  
- [安全](./security.md) — 加密与主网门禁  
- [主网上线](./mainnet-go-live.md) — 生产清单  