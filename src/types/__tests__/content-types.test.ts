import { describe, expect, it } from "vitest";
import type {
  FaqItem,
  LegalPageMetadata,
  PageMetadata,
} from "@/types/content.types";

describe("content type contracts", () => {
  it("LegalPageMetadata requires legal layout and showToc", () => {
    const meta: LegalPageMetadata = {
      title: "Privacy Policy",
      slug: "privacy",
      publishedAt: "2024-01-01",
      layout: "legal",
      showToc: true,
      lastReviewed: "2024-04-01",
    };
    expect(meta.layout).toBe("legal");
    expect(meta.showToc).toBe(true);
  });

  it("FaqItem has stable id, question, answer", () => {
    const item: FaqItem = {
      id: "what-is-moq",
      question: "What is the MOQ?",
      answer: "Our MOQ is 500 pieces per SKU.",
    };
    expect(item.id).toBe("what-is-moq");
    expect(item.question).toBeTruthy();
    expect(item.answer).toBeTruthy();
  });

  it("PageMetadata accepts optional faq array", () => {
    const meta: PageMetadata = {
      title: "About",
      slug: "about",
      publishedAt: "2024-01-10",
      faq: [
        {
          id: "test",
          question: "Q?",
          answer: "A.",
        },
      ],
    };
    expect(meta.faq).toHaveLength(1);
  });
});
