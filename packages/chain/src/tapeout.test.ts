import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  packTapeOutInputs,
  unpackTapeOutOutputs,
  evalPaymentLimitOnTapeOut,
  AVENZA_TAPEOUT,
} from "./tapeout.js";

describe("tapeout packing", () => {
  it("packs LSB-first bits", () => {
    assert.equal(packTapeOutInputs([true, true]), "0x03");
    assert.equal(packTapeOutInputs([true, false]), "0x01");
    assert.equal(packTapeOutInputs([false, false]), "0x00");
  });

  it("unpacks outputs", () => {
    assert.deepEqual(unpackTapeOutOutputs("0x01", 1), [true]);
    assert.deepEqual(unpackTapeOutOutputs("0x00", 1), [false]);
  });
});

describe("tapeout onchain eval", () => {
  it("evaluates Cerebr AND circuit #1 on X Layer mainnet", async () => {
    const pass = await evalPaymentLimitOnTapeOut({
      amountOk: true,
      budgetOk: true,
      processor: AVENZA_TAPEOUT.processor,
      circuitId: AVENZA_TAPEOUT.paymentLimitCircuitId,
      chainId: 196,
      allowLocalFallback: false,
    });
    assert.equal(pass.mode, "onchain");
    assert.equal(pass.pass, true);

    const fail = await evalPaymentLimitOnTapeOut({
      amountOk: true,
      budgetOk: false,
      processor: AVENZA_TAPEOUT.processor,
      circuitId: AVENZA_TAPEOUT.paymentLimitCircuitId,
      chainId: 196,
      allowLocalFallback: false,
    });
    assert.equal(fail.pass, false);
  });
});
