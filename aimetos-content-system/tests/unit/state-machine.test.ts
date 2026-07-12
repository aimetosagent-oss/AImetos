import test from "node:test";
import assert from "node:assert/strict";
import { canTransition, transitionContentStatus } from "../../packages/core/src/state-machine.ts";

test("allows coherent content transitions", () => {
  assert.equal(canTransition("DRAFT_IDEA", "ANALYZED"), true);
  assert.equal(canTransition("DRAFT_IDEA", "PUBLISHED"), false);
});

test("records audit event for valid transition", () => {
  const event = transitionContentStatus({
    previousStatus: "IN_REVIEW",
    nextStatus: "APPROVED",
    user: "roger",
    comment: "Approved",
    version: 2,
    origin: "unit-test"
  });
  assert.equal(event.previousStatus, "IN_REVIEW");
  assert.equal(event.nextStatus, "APPROVED");
});
