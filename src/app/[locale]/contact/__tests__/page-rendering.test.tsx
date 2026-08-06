import { describe, expect, it } from "vitest";
import { getPageBySlug } from "@/lib/content-query/queries";
import { extractFaqFromMetadata } from "@/lib/content/mdx-faq";

describe("Contact page rendering data", () => {
  it("does not keep starter FAQ ids on the Tucsenberg contact page", async () => {
    const page = await getPageBySlug("contact", "en");
    const ids = extractFaqFromMetadata(page.metadata).map((item) => item.id);

    expect(ids).toEqual([]);
  });
});
