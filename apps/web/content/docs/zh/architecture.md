> 生产：https://avenzafinance.site · API https://avenza-api-7p71.onrender.com

# 架构

## 概览

AVENZA 是 monorepo 金融运营栈。**Web 控制台**与 **NestJS API** 通信。API 在 **Postgres** 中持久化工作流状态，可选地将 **BullMQ** 作业入队，在 **X Layer** 上用 **TapeOut** 评估策略，并通过持有**原生 USDC** 的 **Foundry 部署合约**完成结算。

```text
┌─────────────┐     JWT + x-organization-id      ┌──────────────────┐
│  Next.js    │ ───────────────────────────────► │  NestJS API      │
│  console    │                                  │  + Prisma        │
└─────────────┘                                  └────────┬─────────┘
                                                          │
                    ┌─────────────────────────────────────┼──────────────────────────┐
                    ▼                                     ▼                          ▼
             ┌────────────┐                      ┌──────────────┐            ┌──────────────┐
             │ Postgres   │                      │ TapeOut eval │            │ X Layer txs  │
             │ (workflow) │                      │ (view call)  │            │ Auth+Treasury│
             └────────────┘                      └──────────────┘            └──────────────┘
```

## 信任边界

1. **AI / 启发式抽取** 辅助人工；不授权付款。  
2. **后端** 编排工作流、RBAC、幂等与策略输入准备。  
3. **TapeOut** 评估确定性 NAND 电路（`eval`）— 可公开复现。  
4. **Solidity** 独立复查组织状态、审批、供应商资格、策略版本、支出约束、暂停状态与重放保护；注册处理器时会 **重新运行** TapeOut `eval`。  
5. **BusinessTreasury** 持有组织存入的原生 USDC；relayer 无法在无新鲜、未消耗授权的情况下动用资金。

## 组件图

| 组件 | 职责 |
|-----------|----------------|
| `apps/web` | 体验、JWT 存储、组织上下文头 |
| `apps/api` | 领域服务、守卫、结算编排 |
| `apps/worker` | 预留队列：`invoice-pipeline`、`payment-monitor` |
| `packages/shared` | 状态机、RBAC、Zod DTO、金额/承诺辅助 |
| `packages/chain` | 网络、ABI、viem 客户端、TapeOut 客户端、本地策略数学 |
| `contracts` | 授权 + 金库 + 注册表 |
| `circuits` | 离线 TAP-02 风格 NAND 参考 |

## 请求身份

1. 来自 `/auth/login` 或 `/auth/register` 的 `Authorization: Bearer <jwt>`。  
2. `x-organization-id: <uuid>` 选择活跃组织（路径 `:orgId` 亦可）。  
3. `OrgGuard` 加载成员关系、附加 `role` 并检查 `@Permissions`。

## 发票 / 付款状态机

规范转换位于 `@avenza/shared` 的 `INVOICE_TRANSITIONS`。缺失边非法。

付款阶段概要：

| 阶段 | 含义 |
|-------|---------|
| Draft → verified | 数据质量 / 人工审核 |
| Awaiting approval → approved | 双控 / 策略层级 |
| Policy evaluation → authorized | TapeOut + 本地门禁 |
| Payment submitted → confirmed | 链上包含 / 确认数 |
| Reconciliation → completed | 账册与链一致 |

**Submitted ≠ confirmed ≠ completed。**

## 数据隐私

| 链下 | 链上 |
|-----------|----------|
| 发票 PDF、邮件、银行元数据 | 组织 / 付款 / 发票 **承诺** |
| Postgres 中完整审计载荷 | 可选 `AuditRegistry` 标识符 |
| 用户凭证（哈希） | 金库余额、授权事件 |

## 幂等性

付款创建需要按组织范围的 `idempotencyKey`，防止重试下重复创建。

## 结算模式

| 模式 | 条件 |
|------|------|
| `onchain` | 已设置 `PAYMENT_AUTHORIZATION_ADDRESS`、`TREASURY_ADDRESS` 与 `RELAYER_PRIVATE_KEY` |
| `simulated` | `ALLOW_SIMULATED_SETTLEMENT=true` 且合约未完全配置 |
| `blocked` | 两条路径都不可用 — execute 失败闭合 |

模拟绝不会在无明示标志时悄悄伪装主网成功。

## 相关文档

- [TapeOut 与 X Layer](./tapeout-xlayer.md)  
- [智能合约](./contracts.md)  
- [API](./api.md)  
- [安全](./security.md)  