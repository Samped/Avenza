# API 参考

基础 URL（本地）：`http://localhost:3001/api/v1`  
交互式 OpenAPI：`http://localhost:3001/api/docs`

所有组织作用域路由需要：

```http
Authorization: Bearer <accessToken>
x-organization-id: <organizationUuid>
```

（组织 id 亦出现在路径 `:orgId` 中。）

---

## 认证

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | Public | 创建用户；返回 `{ accessToken, user }` |
| `POST` | `/auth/login` | Public | 登录；返回 `{ accessToken, user }` |
| `POST` | `/auth/logout` | Optional | 客户端清除；返回 `{ ok: true }` |
| `GET` | `/auth/me` | JWT | 资料 + 成员关系 / 组织 |

**Register body:** `{ email, password, fullName }`  
**Login body:** `{ email, password }`

---

## 组织

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/organizations` | JWT | 创建组织；调用方成为 admin |
| `GET` | `/organizations/:orgId` | Member | 组织 + 金库配置 |
| `PATCH` | `/organizations/:orgId` | `org:manage` | 更新法定元数据 |
| `GET` | `/organizations/:orgId/members` | Member | 列出成员 |
| `POST` | `/organizations/:orgId/members` | `members:manage` | 邀请 / 更新成员角色 |

**Create body:** `{ legalName, country?, businessEmail?, registrationNumber? }`

---

## 供应商

前缀：`/organizations/:orgId/suppliers`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/` | `suppliers:manage` | 创建供应商 |
| `GET` | `/` | Member* | 列表 |
| `GET` | `/:id` | Member* | 获取 |
| `POST` | `/:id/payment-destinations` | `suppliers:manage` | 添加目的地 |
| `POST` | `/:id/payment-destinations/:destId/approve` | `suppliers:manage` | 批准目的地 |

\*读访问由成员关系强制；写由权限强制。

目的地字段包含 `chainId`、`tokenAddress`、`walletAddress`。

---

## 发票与采购单

前缀：`/organizations/:orgId/invoices`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/` | `invoices:write` | 创建发票 |
| `GET` | `/` | Member | 列表 |
| `GET` | `/:id` | Member | 获取 |
| `POST` | `/:id/upload` | `invoices:write` | 上传文档 |
| `POST` | `/:id/extract` | `invoices:write` | 运行抽取 |
| `POST` | `/:id/verify` | `invoices:review` | 标记已核验 |
| `POST` | `/:id/...` | varies | 其他生命周期操作 |

采购单：`/organizations/:orgId/purchase-orders`（创建需 `invoices:write`）。

---

## 审批

前缀：`/organizations/:orgId/approvals`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/` | Member | 列出请求 |
| `POST` | `/policies` | `policies:manage` | 配置审批策略 |
| `POST` | `/submit/:invoiceId` | `invoices:review` | 发起审批 |
| `POST` | `/:id/approve` | `approvals:decide` | 通过 |
| `POST` | `/:id/reject` | `approvals:decide` | 拒绝 |

---

## 付款策略

前缀：`/organizations/:orgId/policies`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/` | `policies:manage` | 发布策略版本 |
| `GET` | `/` | Member | 列表 |
| `GET` | `/:id` | Member | 获取 |
| `POST` | `/evaluate/:paymentId` | `payments:execute` | 评估（亦内部使用） |

**Create body（示例）：**

```json
{
  "policyName": "Default spend",
  "perPaymentLimitMinor": "25000000000",
  "dailySpendLimitMinor": "100000000000",
  "processorAddress": "0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF",
  "circuitId": "1"
}
```

最小单位：USDC **6 位小数**（例如 `1000000` = 1 USDC）。

---

## 付款

前缀：`/organizations/:orgId/payments`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/network` | Member | 链、USDC、TapeOut、结算模式 |
| `POST` | `/` | `payments:execute` | 创建付款（`invoiceId`、`idempotencyKey`） |
| `GET` | `/` | Member | 列表 |
| `GET` | `/:id` | Member | 获取 |
| `POST` | `/:id/authorize` | `payments:execute` | 策略 + TapeOut → `AUTHORIZED` |
| `POST` | `/:id/execute` | `payments:execute` | 提交结算 |
| `GET` | `/:id/status` | Member | 刷新确认数 |
| `POST` | `/:id/reconcile` | `payments:execute` | 标记完成路径 |

**Authorize response** 包含 `evaluation.tapeOut`（`mode`、`processor`、`circuitId`、`inputs`、`rawOutput`、`pass`、`chainId`）。

**Network response** 包含 `settlementMode`、`tapeOut`、`contracts`、`explorerTxBase`。

---

## 对账、ERP、审计

| 领域 | Prefix | Key permission |
|------|--------|----------------|
| 对账 | `/organizations/:orgId/reconciliation` | 执行需 `payments:execute` |
| ERP | `/organizations/:orgId/erp` | `erp:manage` |
| 审计 | `/organizations/:orgId/audit` | `audit:read` |

---

## 健康检查

`GET /health` — 编排存活探针。

---

## 错误形态

失败请求返回带 `message` / Nest 校验扁平化的 JSON。策略拒绝可能嵌入评估 `output` 供调试。

## 客户端辅助

Web 应用使用 [`apps/web/src/lib/api.ts`](../apps/web/src/lib/api.ts)：附加 JWT + 组织头，解析 JSON 错误。