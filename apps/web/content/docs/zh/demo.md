# 演示手册

## 本地

按 [getting-started.md](./getting-started.md) 完成 seed 后：

| 邮箱 | 角色 |
|------|------|
| admin@avenza.demo | admin |
| approver@avenza.demo | approver |
| payer@avenza.demo | payer |

密码 = `DEMO_SEED_PASSWORD`。

```bash
./scripts/smoke-mvp.sh
./scripts/tapeout-verify.sh
```

## 生产冒烟

1. https://avenzafinance.site 注册/登录  
2. `curl -s https://avenza-api-7p71.onrender.com/api/v1/health` → `chainId: 196`  
3. Relayer 注 OKB；金库存入原生 USDC（`BusinessTreasury` `0x951adC…`）  
4. 走通 1 USDC 审批 → 授权 → 结算  
5. **禁止**对生产执行 `db:seed`  
