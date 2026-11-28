# 智能合约

Foundry 项目：`contracts/` · Solidity 0.8.24 · via_ir。

**线上地址：** [deployments.md](./deployments.md)（X Layer 主网 `196`）。

## 主网部署

| 合约 | 地址 |
|------|---------|
| PaymentAuthorization | `0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA` |
| BusinessTreasury | `0x951adC47425FB4441A3D057d3e10Fa5D4eC27Ed1` |
| PaymentRouter | `0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD` |
| ControlsRegistry | `0xF10cDEB14604F6311195dA90B6076713f7f42f14` |
| PaymentPolicyRegistry | `0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52` |
| OrganizationRegistry | `0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5` |
| VendorRegistry | `0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b` |
| EmergencyControl | `0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884` |
| AuditRegistry | `0xEc114e0B3d39CaFEBE9d9aC25932A75958A7fbDC` |

原生 USDC：`0xB6CEceAB302E2E4948951eE7843FC24E92933061` · Cerebr `#1`：`0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF`

授权时若 `policy.processor != 0`，合约会再次调用 TapeOut `eval`。详情见英文版 [contracts.md](../contracts.md)。
