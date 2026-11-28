# 生产托管 — Render + Vercel

| 层级 | 平台 | 生产地址 |
|------|------|----------|
| 控制台 | **Vercel**（`apps/web`） | https://avenzafinance.site |
| API | **Render**（`Dockerfile.api`） | https://avenza-api-7p71.onrender.com |
| Postgres / Redis | Render | 经 `DATABASE_URL` / `REDIS_URL` |
| 结算 | X Layer **196** | [deployments.md](./deployments.md) |

## 要点

1. Vercel **永不**存放 `RELAYER_PRIVATE_KEY` / `ENCRYPTION_KEY` / 数据库凭证。  
2. 仅 API 签署结算交易并解密托管密钥。  
3. `APP_URL` + `CORS_ORIGINS` 必须包含控制台 HTTPS 源。  
4. API 启动时执行 `prisma migrate deploy`。  
5. 面向客户的结算建议使用常开（非免费休眠）算力。

## Vercel

- Root Directory = `apps/web`（单服务 Next.js，非 multi-service）  
- `NEXT_PUBLIC_API_URL=https://avenza-api-7p71.onrender.com/api/v1`  
- 主网浏览器与 USDC / Cerebr 公共变量见英文托管文档  

## Render 必填密钥

`JWT_SECRET`、`SESSION_SECRET`、`ENCRYPTION_KEY`、`AVENZA_FIELD_ENCRYPTION_KEY`、`INTERNAL_WEBHOOK_TOKEN`、`RELAYER_PRIVATE_KEY`、`PLATFORM_FEE_RECIPIENT`，以及：

```
APP_URL=https://avenzafinance.site
CORS_ORIGINS=https://avenzafinance.site,https://www.avenzafinance.site
API_URL=https://avenza-api-7p71.onrender.com
```

## 验收

```bash
curl -s https://avenza-api-7p71.onrender.com/api/v1/health
# chainId: 196
```

详情见英文版 [hosting-render-vercel.md](../hosting-render-vercel.md)。
