import { expect, it } from "vitest";

console.error("console-gate-top-level-sentinel");

it("fails on a console.error raised while loading the test module", () => {
  expect(true).toBe(true);
});
