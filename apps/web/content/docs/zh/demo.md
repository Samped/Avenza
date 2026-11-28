# 本地演示 runbook

## 前置条件

按 [getting-started.md](./getting-started.md) 完成种子数据 + API + Web。

```bash
# 推荐：未部署合约时仅本地结算
grep ALLOW_SIMULATED_SETTLEMENT .env || echo 'ALLOW_SIMULATED_SETTLEMENT=true' >> .env
```

## 种子用户

在 `.env` 设置 `DEMO_SEED_PASSWORD`，然后种子。使用以下账号登录：

| 邮箱 | 角色 |
|-------|------|
| admin@avenza.demo | admin |
| approver@avenza.demo | approver |
| payer@avenza.demo | payer |

密码 = 你的 `DEMO_SEED_PASSWORD`（不入 git）。

## 脚本验收

```bash
./scripts/smoke-mvp.sh
```

## TapeOut 检查

```bash
./scripts/tapeout-verify.sh
```

## 手动控制台路径

1. 以 admin 登录。  
2. 确认种子供应商 / 目的地。  
3. 创建 → 抽取/核验发票（或使用 API）。  
4. 提交审批；通过。  
5. 策略：确认处理器 + 电路 `#1`。  
6. 付款：授权并执行。  
7. 金库 / 审计：检查模式与事件。  

## 链上主网

合约已部署在 X Layer 主网（`196`）。地址：[deployments.md](./deployments.md)。

1. 确认 `.env` 合约地址 + `RELAYER_PRIVATE_KEY`  
2. 获取主网原生 USDC（`0xB6CEce…`）  
3. 存入 `BusinessTreasury`（`0x96778c369D85aaCCBF6DE0BcD0671B048E16E5CA`）  
4. 设置 `ALLOW_SIMULATED_SETTLEMENT=false`  
5. 对实时授权重新运行冒烟 / 控制台付款  

仅在需要时重部署：`./scripts/deploy-xlayer.sh` 

## 安全门禁

[security.md](./security.md) 清单完成前勿启用主网客户资金。