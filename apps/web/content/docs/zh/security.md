# 安全

## 威胁模型（摘要）

| 威胁 | 缓解 |
|--------|------------|
| 未授权付款 | RBAC + 审批 + TapeOut + Solidity 复查 + 金库消耗 |
| Relayer 滥用 | Relayer 仅能执行**预授权**付款；无法在不匹配授权的情况下设任意目的地/金额 |
| 重放 | 链上 `paymentSeen` / 已执行付款映射；链下幂等键 |
| 过期审批 | 目的地/金额/策略承诺不匹配使审批失效 |
| 桥接 USDC 混淆 | `assertNativeUsdc` + 路由白名单 |
| 静默「假成功」 | 模拟结算需明示 `ALLOW_SIMULATED_SETTLEMENT=true` |
| 不透明电路信任 | 注册处理器时合约自行调用 TapeOut `eval` |
| 暂停 / 事件 | `EmergencyControl` 门禁金库与授权 |

## 认证 / 授权

- 密码用 bcrypt 哈希（种子/注册路径 cost 12）。  
- JWT bearer 令牌；组织路由需组织成员资格。  
- 权限矩阵在 `@avenza/shared` 的 `ROLE_PERMISSIONS`。  
- 审批决策的审批人角色分离。

## 敏感配置

| 密钥 | 处理 |
|--------|----------|
| `JWT_SECRET` / `SESSION_SECRET` | 强随机；切勿提交 |
| `ENCRYPTION_KEY` | 32 字节 hex；**托管**密钥（资金钱包密钥、ERP 凭证）经 `secrets.ts` |
| `AVENZA_FIELD_ENCRYPTION_KEY` | 业务字段静态加密（备注、发票抽取、注册/邮箱、收款方联系人）经 `field-crypto.ts`。生产必填。 |
| `RELAYER_PRIVATE_KEY` | 最小权限热钱包；生产优选 KMS/HSM |
| 部署者密钥 | 所有权转移用离线 / 多签 |
| S3 凭证 | 仅发票桶作用域 |

`ENCRYPTION_KEY` 与 `AVENZA_FIELD_ENCRYPTION_KEY` 保持**分离**，轮换其一不必重包另一。

## 主网客户资金前

另见 [mainnet-go-live.md](./mainnet-go-live.md)。

- [x] `PAYMENT_FAILED` 后阻止双付；在同一付款 id 上重试 execute  
- [x] 组织 GET 剥离 `fundingWalletKeyEnc`；生产要求 `ENCRYPTION_KEY`  
- [x] 接入注册表时链上 `VendorRegistry.isEligible`；仅地址收款方为 pending  
- [x] Partner API 无法伪造 admin 审批；结算作用域分离  
- [x] 生产限流 + `INTERNAL_WEBHOOK_TOKEN` + 主网/生产关闭 TapeOut 回退  
- [ ] 独立智能合约审查  
- [ ] Relayer 密钥在 HSM/KMS；轮换 + 暂停流程文档化  
- [ ] `EmergencyControl` / Ownable 转移至多签  
- [ ] TapeOut 处理器字节码 + 可升级性评估；电路 ID 固定在 `PaymentPolicyRegistry`  
- [ ] 对照 Circle / X Layer 文档验证目标网络原生 USDC 地址  
- [x] 重复付款 / 重放 / 过期授权 / 供应商测试通过（`forge test`）  
- [ ] 主网部署（`CONFIRM_MAINNET_DEPLOY=yes`）+ Sourcify 验证  
- [ ] 生产环境 `ALLOW_TAPEOUT_LOCAL_FALLBACK=false`  
- [ ] 管辖区合规审查（托管 / 货币传输）  

## 运行时控制

- 付款创建幂等键  
- 目的地 / 金额 / 策略变更使审批承诺失效  
- 授权过期（链上 24h）  
- 确认数门禁 `PAYMENT_CONFIRMED`  
- 授权 / 提交 / 失败路径审计事件含 TapeOut 元数据  

## 数据处理

- 发票二进制与 PII 保留链下（文档根 / S3）。  
- **静态字段加密（AES-256-GCM）：** 付款/批次备注、`Invoice.extractionJson`、`Organization.registrationNumber` / `businessEmail`、`Supplier.contactEmail` / `contactPhone`。API 为授权组织成员解密。发票号、金额与钱包地址保持明文以便检索/运营。  
- 链上 USDC 结算与 TapeOut 策略评估仍**公开**（非机密转账）。  
- 用 `npm run encrypt:fields -w @avenza/api` 迁移现有明文（幂等）。  
- 不记录原始私钥或完整卡/银行密钥。  
- 字段加密密钥轮换需重加密存储密文；计划维护窗口。

## 报告

内部安全问题：视为高优先级；调查结算异常前冻结 relayer 并经 `EmergencyControl` 暂停。