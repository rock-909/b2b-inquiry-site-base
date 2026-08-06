import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

function extractRule(selector: string): string {
  const selectorStart = globalsCss.indexOf(`${selector} {`);

  if (selectorStart === -1) {
    throw new Error(`Expected ${selector} rule in globals.css.`);
  }

  const ruleStart = globalsCss.indexOf("{", selectorStart);
  const ruleEnd = globalsCss.indexOf("}", ruleStart);

  if (ruleStart === -1 || ruleEnd === -1) {
    throw new Error(`Expected complete ${selector} rule in globals.css.`);
  }

  return globalsCss.slice(ruleStart + 1, ruleEnd);
}

describe("skip link touch target", () => {
  it("keeps hidden and focus-visible skip link boxes large enough for mobile target checks", () => {
    const baseRule = extractRule(".skip-link");
    const focusRule = extractRule(".skip-link:focus-visible");

    expect(baseRule).toContain("min-width: 44px");
    expect(baseRule).toContain("min-height: 44px");
    expect(focusRule).toContain("min-width: 44px");
    expect(focusRule).toContain("min-height: 44px");
  });
});
