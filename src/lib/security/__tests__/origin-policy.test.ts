import { describe, expect, it } from "vitest";
import { isSameOrigin } from "../origin-policy";

describe("same-origin inquiry policy", () => {
  it.each([
    [null, "https://site.test/api/inquiry", true],
    ["https://site.test", "https://site.test/api/inquiry", true],
    ["http://localhost:3000", "http://localhost:3000/api/inquiry", true],
    ["https://other.test", "https://site.test/api/inquiry", false],
    ["http://site.test", "https://site.test/api/inquiry", false],
    ["https://site.test:8443", "https://site.test/api/inquiry", false],
    ["https://site.test/other", "https://site.test/api/inquiry", false],
    ["null", "https://site.test/api/inquiry", false],
  ])("checks %s against %s", (origin, url, allowed) => {
    expect(isSameOrigin(origin, url)).toBe(allowed);
  });
});
