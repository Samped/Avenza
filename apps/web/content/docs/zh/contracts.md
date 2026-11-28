# 智能合约

Foundry 项目：[`contracts/`](../../../contracts)

Solidity **0.8.24**，优化器 **200** runs，启用 **`via_ir`**。

**线上地址：** 见仓库 [`docs/deployments.md`](../../../docs/deployments.md)（X Layer 主网 `196`）。

## 合约目录

| Contract | File | Role |
|----------|------|------|
| `EmergencyControl` | `EmergencyControl.sol` | 全局 / 组织暂停 |
| `OrganizationRegistry` | `OrganizationRegistry.sol` | 注册组织；活跃检查 |
| `VendorRegistry` | `VendorRegistry.sol` | 供应商记录 + 验证 |
| `PaymentPolicyRegistry` | `PaymentPolicyRegistry.sol` | 版本化策略 → `processor`、`circuitId`、`configHash` |
| `PaymentAuthorization` | `PaymentAuthorization.sol` | 仅 relayer 授权；TapeOut 再评估；重放 / 过期 |
| `BusinessTreasury` | `BusinessTreasury.sol` | 按组织 USDC 余额；授权消耗后执行 |
| `PaymentRouter` | `PaymentRouter.sol` | 代币白名单 + 适配器白名单 |
| `AuditRegistry` | `AuditRegistry.sol` | 链上审计承诺 |
| `ITapeOutProcessor` | `interfaces/ITapeOutProcessor.sol` | `eval(uint256,bytes) returns (bytes)` |
| `MockUSDC` / `MockTapeOutProcessor` | `mocks/` | 本地测试、Anvil 与测试网结算再评估 |

## X Layer 测试网部署

| Contract | Address |
|----------|---------|
| EmergencyControl | `0xcc5661D1471e9e61B37Df5Ad5D2E1B2C5578c884` |
| OrganizationRegistry | `0xD2445389196f2c502AB5ec6f49a90cc04BB71ff5` |
| VendorRegistry | `0x3dE7a4C348F7415087a9Cf58FBC57256bAF1eb4b` |
| PaymentPolicyRegistry | `0x0Af7a5DDE4f2B30772eE60F80EfD516A94C56A52` |
| PaymentAuthorization | `0xE3F25b5e9Da3dFA72C0a12f05fd45cc0dD4243dD` |
| PaymentRouter | `0xF10cDEB14604F6311195dA90B6076713f7f42f14` |
| BusinessTreasury | `0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA` |
| AuditRegistry | `0x79Be215ec0478D616fC2704370c3590f323ef599` |

- **原生 USDC：** `0xB6CEceAB302E2E4948951eE7843FC24E92933061`  
- **Organization ID：** `0x603fd1000e3f9b350efdfbeaad5864a151b4bdac12228b5056569a9b2478f82a`  
- **Policy version：** `2`  
- **验证：** Sourcify `exact_match` — https://repo.sourcify.dev/196/

## 授权流程

```text
relayer → PaymentAuthorization.authorize(AuthRequest)
            ├─ emergency / org active
            ├─ approvals >= required
            ├─ vendorEligible
            ├─ policy version exists
            ├─ if policy.processor != 0:
            │     ITapeOutProcessor(processor).eval(circuitId, circuitInputs)
            │     require LSB of output == 1
            └─ store Authorization (unconsumed, 24h expiry)

relayer → BusinessTreasury.executeAuthorizedPayment(...)
            ├─ consume authorization (paymentId, amount, token, destination match)
            └─ transfer native USDC to destination
```

`AuthRequest` 包含 `circuitResult`（打包标志）与 `circuitInputs`（LSB 打包 TapeOut 输入）。绑定处理器时，仅凭非零不透明 `circuitResult` **不够**。

## BusinessTreasury

- `deposit(organizationId, amount)` — 将原生 USDC 拉入金库账务  
- `available(organizationId)` — 余额减去预留  
- `executeAuthorizedPayment` — 仅 relayer；每个 `paymentId` 一次执行  
- 构造时固定代币与 `chainIdAllow`  

## 测试

```bash
cd contracts
forge test
```

## 部署

```bash
export DEPLOYER_PRIVATE_KEY=0x...
export XLAYER_CHAIN_ID=196
export XLAYER_RPC_URL=https://testrpc.xlayer.tech/terigon
export USDC_TOKEN_ADDRESS=0xB6CEceAB302E2E4948951eE7843FC24E92933061
./scripts/deploy-xlayer.sh
```

测试网上，结算再评估使用链本地 TapeOut 兼容处理器。API TapeOut 评估使用主网 Cerebr（`TAPEOUT_EVAL_CHAIN_ID=196`）。

## 安全说明

见 [security.md](./security.md)。主网客户资金前：审计、多签所有权、KMS relayer、固定处理器字节码、暂停 runbook。