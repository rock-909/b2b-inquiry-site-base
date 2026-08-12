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
      id: "what-details-help",
      question: "What details help?",
      answer: "Share the requirement, scope, destination, and timing.",
    };
    expect(item.id).toBe("what-details-help");
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
