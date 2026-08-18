import { describe, expect, it } from "vitest";
import { getStaticPage } from "@/lib/content/static-pages";
import { extractFaqFromMetadata } from "@/lib/content/faq";

describe("Contact page rendering data", () => {
  it("does not keep starter FAQ ids on the contact page", async () => {
    const page = getStaticPage("contact", "en");
    const ids = extractFaqFromMetadata(page.metadata).map((item) => item.id);

    expect(ids).toEqual([]);
  });
});
