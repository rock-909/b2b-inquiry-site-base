import { describe, expect, it } from "vitest";
import { findDuplicateJsonObjectKeys } from "../../../scripts/quality/checks/translations.js";

describe("translations duplicate object-key scan", () => {
  it("detects sibling duplicate keys that JSON.parse would silently collapse", () => {
    const source = '{"submit":"first","submit":"second"}';

    expect(JSON.parse(source)).toEqual({ submit: "second" });
    expect(findDuplicateJsonObjectKeys(source)).toEqual([
      { key: "submit", line: 1, path: "submit" },
    ]);
  });

  it("detects nested sibling duplicates with path and line", () => {
    const source = `{
  "errors": {
    "required": "first",
    "required": "second"
  }
}`;

    expect(findDuplicateJsonObjectKeys(source)).toEqual([
      { key: "required", line: 4, path: "errors.required" },
    ]);
  });

  it("accepts unique sibling keys", () => {
    expect(
      findDuplicateJsonObjectKeys('{"submit":"ok","cancel":"ok"}'),
    ).toEqual([]);
  });
});
