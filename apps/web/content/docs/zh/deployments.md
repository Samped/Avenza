# 部署地址

AVENZA 链上与应用托管权威清单。**生产结算为 X Layer 主网（`196`）。**

## 生产应用

| 表面 | URL |
|------|-----|
| 控制台 | https://avenzafinance.site |
| API | https://avenza-api-7p71.onrender.com |
| 健康检查 | https://avenza-api-7p71.onrender.com/api/v1/health |
| 托管说明 | [hosting-render-vercel.md](../hosting-render-vercel.md) |

## X Layer 主网（链 ID `196`）

| 网络 | 值 |
|------|--------|
| Chain ID | `196` |
| RPC | `https://rpc.xlayer.tech` |
| 原生 Gas | OKB |
| 原生 USDC | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| 浏览器 | [OKLink X Layer](https://www.oklink.com/xlayer) |
| Deployer | `0xD9792Bf937D9673ab08c452fE55Ec4e26632Be54` |
| Relayer | `0x43C622c37AA6D9F4e0ADda249710c54E0eC09184` |
| TapeOut（Cerebr） | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| PaymentLimit 电路 | `#1` |

### 结算合约

| 合约 | 地址 |
|------|---------|
| EmergencyControl | `0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884` |
| OrganizationRegistry | `0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5` |
| VendorRegistry | `0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b` |
| PaymentPolicyRegistry | `0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52` |
| ControlsRegistry | `0xF10cDEB14604F6311195dA90B6076713f7f42f14` |
| PaymentAuthorization | `0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA` |
| PaymentRouter | `0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD` |
| BusinessTreasury | `0x951adC47425FB4441A3D057d3e10Fa5D4eC27Ed1` |
| AuditRegistry | `0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC` |

组织 ID：`0x603fd1000e3f9b350efdfbeaad5864a151b4bdac12228b5056569a9b2478f82a` · 策略版本 `1` · 结算与评估均绑定 Cerebr `#1`。

完整环境变量映射见英文版 [deployments.md](../deployments.md)。

## 测试网（`1952`）— 可选

勿与主网地址混用。见仓库 `deployed-testnet.json`。
