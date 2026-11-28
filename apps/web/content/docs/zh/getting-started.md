# 快速开始

从干净检出到本机运行 API + 控制台。

**生产环境：** https://avenzafinance.site · API https://avenza-api-7p71.onrender.com — 见 [hosting-render-vercel.md](./hosting-render-vercel.md)。

## 前置

Node.js ≥ 22 · npm workspaces · Postgres（`npm run db:up` 或 Docker）· Redis（推荐）· Foundry（可选）

```bash
cd Avenza
cp .env.example .env
npm install
```

至少设置：`JWT_SECRET`、`SESSION_SECRET`、`ENCRYPTION_KEY`（64 hex）、`AVENZA_FIELD_ENCRYPTION_KEY`。

`.env.example` 默认指向 X Layer **主网** `196`。结算仅为链上（无模拟路径）；地址见 [deployments.md](./deployments.md)。

## 数据库

```bash
npm run db:up
npm run db:generate && npm run db:push
# DEMO_SEED_PASSWORD ≥10 字符
npm run db:seed
```

**切勿**对生产库执行 `db:seed`。

## 启动

```bash
npm run build -w @avenza/shared && npm run build -w @avenza/chain
npm run dev:api   # :3001
npm run dev:web   # :3000
```

| 表面 | URL |
|------|-----|
| 控制台 | http://localhost:3000/app |
| Swagger | http://localhost:3001/api/docs |
| Health | http://localhost:3001/api/v1/health |

## 主网结算

1. 从 [deployments.md](./deployments.md) 填入合约地址  
2. 设置已注资的 `RELAYER_PRIVATE_KEY`（OKB）  
3. 存入**原生** USDC 到金库  
4. 先验证收款人再结算  

生产上线：[mainnet-go-live.md](./mainnet-go-live.md) · 安全：[security.md](./security.md)
