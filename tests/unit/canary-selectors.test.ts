import { describe, expect, it } from "vitest";
import { buildCanarySelectors } from "../e2e/smoke/canary-selectors";

describe("buildCanarySelectors", () => {
  it("returns non-empty submit label and success prefix from message truth", () => {
    const selectors = buildCanarySelectors();

    expect(typeof selectors.submitLabel).toBe("string");
    expect(selectors.submitLabel.length).toBeGreaterThan(0);
    expect(typeof selectors.successPrefix).toBe("string");
    expect(selectors.successPrefix.length).toBeGreaterThan(0);
    expect(selectors.successPrefix.length).toBeLessThanOrEqual(40);
  });
});
