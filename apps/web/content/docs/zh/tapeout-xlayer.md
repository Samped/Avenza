# TapeOut 与 X Layer

生产结算与策略评估均在 **X Layer 主网 196**，使用 **Cerebr** 处理器电路 `#1`（AND：amountOk ∧ budgetOk）。

| 项 | 值 |
|------|--------|
| Processor | `0xB04EB79D1A5EECaabAAfF7B77d7c27578EE693FF` |
| Circuit | `#1` |
| 验证 | `./scripts/tapeout-verify.sh` |

API 先 `eval`；`PaymentAuthorization.authorize` 在链上再次 `eval`。生产必须 `ALLOW_TAPEOUT_LOCAL_FALLBACK=false`。

加密在链下；链上金额与地址公开。完整说明见英文版 [tapeout-xlayer.md](../tapeout-xlayer.md) · 地址 [deployments.md](./deployments.md)。
