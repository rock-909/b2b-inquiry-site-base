import { describe, expect, it } from "vitest";
import { getStaticPage } from "@/lib/content/static-pages";

describe("static content source", () => {
  it("resolves imported page content", () => {
    expect(getStaticPage("about", "en")).toMatchObject({
      slug: "about",
      filePath: "/src/content/pages/en/about.ts",
    });
  });
});
