import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDecimalToMinor, minorToDecimalString } from "./money";

describe("money", () => {
  it("round-trips USDC decimals", () => {
    const minor = parseDecimalToMinor("123.456789", 6);
    assert.equal(minor, 123456789n);
    assert.equal(minorToDecimalString(minor, 6), "123.456789");
  });

  it("rejects invalid input", () => {
    assert.throws(() => parseDecimalToMinor("abc"));
  });
});
