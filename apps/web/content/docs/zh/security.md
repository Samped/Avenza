# 安全

AVENZA 在 X Layer 主网上的威胁模型与控制基线。

## 威胁摘要

| 威胁 | 缓解 |
|------|------|
| 未授权付款 | RBAC + 双控审批 + TapeOut + Solidity 复核 + 金库 consume |
| Relayer 滥用 | 仅能执行已授权付款 |
| 重放 | 链上已执行映射 + 链下幂等键 |
| 桥接 USDC 混淆 | 仅原生 USDC 白名单 |
| 密钥泄漏 | 密钥拆分；Vercel 不持私钥；组织 GET 剥离托管密文 |
| 事件暂停 | `EmergencyControl` |

## 加密

| 密钥 | 保护对象 |
|------|----------|
| `ENCRYPTION_KEY` | 托管钱包、ERP、Webhook、文档（AES-256-GCM） |
| `AVENZA_FIELD_ENCRYPTION_KEY` | 备注、抽取 JSON、联系方式等业务字段 |

**链上不加密。** 金额与收款地址公开；完整性依赖承诺哈希与 TapeOut，而非密文。

## 已完成 / 待办

已完成：主网部署、Cerebr 绑定、生产启动门禁、双控、Partner API 职责分离、模拟结算移除。  

待办：独立合约审计、多签接管、Relayer HSM/KMS、文档对象存储、托管合规审查。

详见英文版 [security.md](../security.md)。
