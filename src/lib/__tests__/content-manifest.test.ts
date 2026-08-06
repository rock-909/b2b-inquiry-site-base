import { describe, expect, it } from "vitest";
import { resolveOptionalContentEntry } from "@/lib/content-manifest";

describe("content manifest source", () => {
  it("resolves active source-checkout content", () => {
    expect(resolveOptionalContentEntry("en", "about")?.source).toBe(
      "active-content",
    );
  });
});
