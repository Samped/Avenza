import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSettlementFees, feesEnabled, type FeeConfig } from "./fees";

describe("computeSettlementFees", () => {
  it("applies bps + flat + gas recovery", () => {
    const config: FeeConfig = {
      platformFeeBps: 30, // 0.30%
      platformFeeFlatMinor: 50_000n, // $0.05
      gasRecoveryMinor: 150_000n, // $0.15
    };
    // 100 USDC = 100_000_000 minor
    const fees = computeSettlementFees(100_000_000n, config);
    assert.equal(fees.platformFeeMinor, 300_000n + 50_000n); // 0.30 + 0.05
    assert.equal(fees.gasRecoveryMinor, 150_000n);
    assert.equal(fees.totalFeesMinor, 500_000n);
    assert.equal(fees.totalDebitMinor, 100_500_000n);
    assert.equal(feesEnabled(config), true);
  });

  it("returns zero fees when disabled", () => {
    const config: FeeConfig = {
      platformFeeBps: 0,
      platformFeeFlatMinor: 0n,
      gasRecoveryMinor: 0n,
    };
    const fees = computeSettlementFees(1_000_000n, config);
    assert.equal(fees.totalFeesMinor, 0n);
    assert.equal(fees.totalDebitMinor, 1_000_000n);
    assert.equal(feesEnabled(config), false);
  });
});
