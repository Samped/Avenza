# TapeOut 与 X Layer 集成

AVENZA 使用 **X Layer** 结算，使用 **TapeOut** 做确定性、可公开验证的策略门禁。

## 网络

| 网络 | Chain ID | 原生 Gas | 原生 USDC |
|---------|----------|------------|-------------|
| X Layer 主网 | `196` | OKB | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| X Layer 测试网 | `1952` | OKB | `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3` |

定义于 [`packages/chain/src/networks.ts`](../packages/chain/src/networks.ts)。**拒绝**桥接 USDC。

浏览器（OKLink）：

- 主网交易：`https://www.oklink.com/xlayer/tx/<hash>`  
- 测试网交易：`https://www.oklink.com/xlayer-test/tx/<hash>`  

## TapeOut 是什么（在 AVENZA 中的用法）

TapeOut 处理器将 NAND 网表存为电路 NFT。任何人可运行：

```solidity
function eval(uint256 circuitId, bytes calldata inputs) external view returns (bytes memory);
```

输入/输出 **按位打包，LSB 优先**。view 评估对调用方无 gas。

AVENZA 的 **PaymentLimit** 门禁为逻辑 AND(`amountOk`, `budgetOk`)。

## 默认线上绑定

| 项 | 值 |
|------|--------|
| Factory | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| Processor (Cerebr) | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| Circuit | `#1`（两个输入位的 AND） |
| Eval chain | `196`，经 `TAPEOUT_EVAL_CHAIN_ID` |

TapeOut Accelerate 常见问题允许使用现有处理器。Cerebr 公开 AND 神经元与 PaymentLimit 匹配。

### 随时验证

```bash
./scripts/tapeout-verify.sh
```

等价于：

```bash
cast call 0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF \
  "eval(uint256,bytes)(bytes)" 1 0x03 \
  --rpc-url https://rpc.xlayer.tech
# → 0x01  (两位均置 → AND 为真)

cast call 0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF \
  "eval(uint256,bytes)(bytes)" 1 0x01 \
  --rpc-url https://rpc.xlayer.tech
# → 0x00
```

## 运行时路径

1. **策略服务** 根据发票金额与单笔/日限额计算布尔输入。  
2. [`evalPaymentLimitOnTapeOut`](../packages/chain/src/tapeout.ts) 打包位并调用配置处理器上的 `eval`。  
3. 结果存于 `PolicyEvaluation.outputData`（`tapeOut` 对象）。  
4. **Authorize** 要求 `policyPass`（TapeOut 通过 ∧ 其他门禁）。  
5. **Execute** 将 `circuitInputs` 送入 `PaymentAuthorization`。  
6. 若 `PaymentPolicyRegistry` 中 `processor != address(0)`，合约 **重新运行** `eval` 并要求 LSB = 1。

`circuits/` 与 `policyEval.ts` 中的本地 NAND 辅助仍用于离线向量。设置：

```bash
ALLOW_TAPEOUT_LOCAL_FALLBACK=false
```

RPC 评估不可用时失败闭合。

## 环境

```bash
TAPEOUT_FACTORY_ADDRESS=0x1f09daefa827f02cbb40967cc91b259763760761
TAPEOUT_PROCESSOR_ADDRESS=0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF
TAPEOUT_PAYMENT_LIMIT_CIRCUIT_ID=1
TAPEOUT_EVAL_CHAIN_ID=196
TAPEOUT_RPC_URL=https://rpc.xlayer.tech
ALLOW_TAPEOUT_LOCAL_FALLBACK=true   # 严格模式设 false
```

生产结算使用主网（`XLAYER_CHAIN_ID=196`），与 TapeOut 评估共用 Cerebr。测试网结算（`1952`）仅用于隔离实验，并使用本地 MockTapeOutProcessor。

**实时结算地址：** [deployments.md](./deployments.md)。

## 控制台界面

- **策略** — 绑定处理器 + 电路；显示浏览器链接  
- **付款** — 最近评估模式 / 输入 / 输出；链上时显示交易浏览器  
- **金库** — 处理器、工厂、电路、结算模式  

## 自有处理器（可选）

1. 在 X Layer 经 TapeOut 工厂 `createCPU`。  
2. 铸造 NAND 晶体管；`tapeout` AND 网表 `0x0000000300000200000004000004`（`nIn=2`，`nOut=1`）。  
3. 设置 `TAPEOUT_PROCESSOR_ADDRESS` + 电路 id。  
4. 在 `PaymentPolicyRegistry` 注册同一对（部署脚本为演示组织执行）。  

见 [`circuits/README.md`](../circuits/README.md)。

## 相关

- [部署](./deployments.md)
- [合约](./contracts.md)  
- [架构](./architecture.md)  
- [安全](./security.md)  