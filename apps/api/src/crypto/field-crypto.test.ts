import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decryptField,
  encryptField,
  encryptFieldOptional,
  looksEncrypted,
} from "./field-crypto";

describe("field-crypto", () => {
  it("round-trips plaintext", () => {
    const sealed = encryptField("confidential memo");
    assert.equal(looksEncrypted(sealed), true);
    assert.equal(decryptField(sealed), "confidential memo");
  });

  it("leaves legacy plaintext readable", () => {
    assert.equal(decryptField("plain old memo"), "plain old memo");
    assert.equal(looksEncrypted("plain old memo"), false);
  });

  it("skips re-encrypting already sealed values", () => {
    const once = encryptField("once");
    assert.equal(encryptFieldOptional(once), once);
  });
});
