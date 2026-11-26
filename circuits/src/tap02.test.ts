import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evalCircuit, evalPaymentLimitBits, paymentLimitCircuit } from "./tap02.js";

describe("tap02", () => {
  it("AND via NAND", () => {
    assert.equal(evalPaymentLimitBits(true, true), true);
    assert.equal(evalPaymentLimitBits(true, false), false);
    assert.equal(evalPaymentLimitBits(false, true), false);
    assert.equal(evalPaymentLimitBits(false, false), false);
  });

  it("rejects bad input arity", () => {
    assert.throws(() => evalCircuit(paymentLimitCircuit(), [true]));
  });
});
