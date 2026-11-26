import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransitionInvoice } from "@avenza/shared";

describe("invoice state machine", () => {
  it("allows verified to awaiting approval", () => {
    assert.equal(canTransitionInvoice("VERIFIED", "AWAITING_APPROVAL"), true);
  });
  it("blocks completed to draft", () => {
    assert.equal(canTransitionInvoice("COMPLETED", "DRAFT"), false);
  });
});
