# 主网上线 — X Layer 196

| 项 | 值 |
|------|--------|
| 链 | X Layer **196** |
| 原生 USDC | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| TapeOut Cerebr | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| 电路 | `#1` |
| 控制台 | https://avenzafinance.site |
| API | https://avenza-api-7p71.onrender.com |

**结算合约已部署。** 地址簿：[deployments.md](./deployments.md) · 托管：[hosting-render-vercel.md](./hosting-render-vercel.md)

## 托管模型

| 钱包 | 职责 |
|------|------|
| Deployer | 合约 Ownable（冷钱包优先） |
| Relayer | 热钱包付 OKB Gas，≠ deployer |
| 平台收费地址 | `PLATFORM_FEE_RECIPIENT` |
| 组织注资钱包 | 原生 USDC 存入 `BusinessTreasury` |
| 多签 | 目标持有 EmergencyControl / Ownable |

## 上线门禁（摘要）

- [x] 主网合约 + Cerebr `#1`  
- [x] 生产密钥与 CORS  
- [ ] 多签接管 Ownable  
- [ ] Relayer KMS/HSM  
- [ ] 独立合约审计  
- [ ] 1 USDC 冒烟 + 暂停演练  

完整清单见英文版 [mainnet-go-live.md](../mainnet-go-live.md)。
