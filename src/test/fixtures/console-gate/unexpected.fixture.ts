import { expect, it } from "vitest";

it("fails on an unhandled console.error", () => {
  console.error("console-gate-unexpected-sentinel");
  expect(true).toBe(true);
});
