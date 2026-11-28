# 主网上线 runbook（X Layer 196）— 企业版

**在下方每一道门禁检查完成前，勿接受第三方 USDC。**

| 项 | 值 |
|------|--------|
| 链 | X Layer **196** |
| 原生 USDC | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| TapeOut Cerebr | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| 电路 | `#1` — AND(`amountOk`, `budgetOk`) |
| 浏览器 | https://www.oklink.com/xlayer |

模板环境：[`apps/api/.env.mainnet.example`](../apps/api/.env.mainnet.example)  
预检：`./scripts/mainnet-preflight.sh`

---

## 0. 代码门禁（仓库内强制）

- [x] `PAYMENT_FAILED` 后无第二笔付款 — 在同一 id 上重试 `/execute`  
- [x] 组织 API 响应剥离 `fundingWalletKeyEnc`  
- [x] 生产密钥必填；禁止 TapeOut 本地回退  
- [x] 主网启动拒绝错误 USDC、测试 RPC、缺合约/relayer、确认数 &lt; 3  
- [x] 接入时 `VendorRegistry` 资格；仅金库 `consume`  
- [x] 待处理收款方验证前不能结算  
- [x] Partner API 职责分离（`payments:settle` 分离；不能决策审批）  
- [x] 控制台尊重双控  
- [x] 生产关闭 Swagger，除非 `ENABLE_SWAGGER=true`  
- [x] 主网生产阻止 `db:seed`，除非 `ALLOW_MAINNET_SEED=yes`  
- [x] 196 上部署脚本要求部署者与 relayer 不同  

---

## 1. 钱包与托管（任何部署前）

1. **部署者** — 优选冷/硬件；仅 OKB 用于合约部署。  
2. **Relayer** — 独立热钱包；仅 OKB 作 gas；**绝不**与部署者同钥。  
3. **运维多签** — 部署后将拥有 `EmergencyControl` + Ownable。  
4. 第三方资金前确认**托管**资金钱包的法律立场。

生成应用密钥（全新 — 勿复用测试网）：

```bash
openssl rand -hex 32   # JWT_SECRET / SESSION_SECRET / INTERNAL_WEBHOOK_TOKEN
openssl rand -hex 32   # ENCRYPTION_KEY (64 hex)
openssl rand -base64 48  # AVENZA_FIELD_ENCRYPTION_KEY
```

---

## 2. 部署合约

```bash
export CONFIRM_MAINNET_DEPLOY=yes
export XLAYER_CHAIN_ID=196
export XLAYER_RPC_URL=https://rpc.xlayer.tech
export USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
export TAPEOUT_PROCESSOR_ADDRESS=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
export DEPLOYER_PRIVATE_KEY=0x…   # cold
export RELAYER_PRIVATE_KEY=0x…    # hot, different
./scripts/deploy-xlayer.sh
./scripts/verify-xlayer.sh
```

将地址复制到 Fly secrets / 生产环境。Ownable → 多签。记录暂停：`EmergencyControl.pause()`。

---

## 3. 数据面与 API 主机

| 组件 | 建议 |
|-------|----------------|
| Postgres | Neon（生产项目）— **不要** `db:seed` |
| Redis | Upstash |
| API | Fly `avenza-api`（`fly.toml` 主网默认） |
| Web | Vercel — `NEXT_PUBLIC_API_URL`、主网浏览器基址 |

```bash
# 仅对生产 DATABASE_URL
npm run db:generate
npm run db:push
# 设置 AVENZA_FIELD_ENCRYPTION_KEY 后可选字段迁移
npm run encrypt:fields -w @avenza/api
./scripts/mainnet-preflight.sh
```

Fly secrets（示例）：

```bash
fly secrets set \
  DATABASE_URL=… REDIS_URL=… \
  JWT_SECRET=… SESSION_SECRET=… \
  ENCRYPTION_KEY=… AVENZA_FIELD_ENCRYPTION_KEY=… \
  INTERNAL_WEBHOOK_TOKEN=… \
  RELAYER_PRIVATE_KEY=… \
  APP_URL=https://YOUR_VERCEL_HOST \
  PAYMENT_AUTHORIZATION_ADDRESS=… TREASURY_ADDRESS=… \
  # …其余合约地址
```

---

## 4. 重新入驻组织（测试网状态不继承）

1. 注册生产 admin；创建工作区（新资金钱包）。  
2. 链上组织 + 策略，**非零 Cerebr 处理器** + 管控。  
3. 注册并 **验证** 收款方。  
4. 为资金钱包注资：少量 **原生 USDC** + OKB → 存入金库。  

---

## 5. 冒烟 + 暂停（必填）

1. 可付 **1 USDC**（或你接受的最低额）。  
2. 需要时双控审批。  
3. 授权 → 执行 → ≥3 确认 → 对账。  
4. 确认 OKLink 主网链接。  
5. 空金库失败 → 注资 → 在**同一付款 id** 上重试 `/execute`。  
6. 多签 `pause()` → 确认阻塞 → `unpause()`。  

---

## 6. 费用（AVENZA 如何盈利）

每次成功结算从组织金库扣除：

| 扣款 | 来源 |
|-------|--------|
| 供应商金额 | 收款方 |
| 平台费 | `PLATFORM_FEE_BPS` + `PLATFORM_FEE_FLAT_MINOR` → `PLATFORM_FEE_RECIPIENT` |
| Gas 回收 | `GAS_RECOVERY_USDC_MINOR` → 同一收款方 |

Relayer 仍支付 **OKB** gas；企业在 **USDC** 中偿还。需要金库 `collectFee`（若线上金库早于该函数则需重部署/升级套件）。

建议起步：`PLATFORM_FEE_BPS=30`，固定 `50000`（$0.05），gas 回收 `150000`（$0.15）。

## 7. 企业运维清单

- [ ] Relayer OKB 充值告警  
- [ ] 金库 USDC 余额告警（须覆盖 **付款 + 费用**）  
- [ ] 费用收款钱包监控  
- [ ] 日志脱敏（无原始密钥 / 完整备注入日志）  
- [ ] 事件 runbook：暂停 → 吊销 partner 密钥 → 轮换 JWT/relayer  
- [ ] Postgres 备份；加密密钥托管流程  
- [ ] CORS 锁定控制台 HTTPS 源  

---

## 8. 合规提醒

资金钱包为**托管**（API 持有加密密钥）。接受第三方 USDC 前确认货币传输 / 托管义务。在客户条款中披露平台与 gas 回收费用。