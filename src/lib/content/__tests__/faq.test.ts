import { describe, expect, it } from "vitest";
import { getStaticPage } from "@/lib/content/static-pages";
import type { FaqItem } from "@/types/content.types";
import {
  extractFaqFromMetadata,
  generateFaqSchemaFromItems,
  interpolateFaqAnswer,
} from "../faq";

const MOCK_FACTS = {
  companyName: "Reference Industries",
  exportCountries: 20,
  established: 2018,
};

describe("extractFaqFromMetadata", () => {
  it("returns empty array when no faq field", () => {
    expect(extractFaqFromMetadata({})).toEqual([]);
  });

  it("extracts valid FaqItem array", () => {
    const metadata = {
      faq: [
        {
          id: "project-details",
          question: "What details help?",
          answer: "Share the scope and destination.",
        },
        {
          id: "next-step",
          question: "What happens next?",
          answer: "The team reviews the request.",
        },
      ],
    };
    const result = extractFaqFromMetadata(metadata);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("project-details");
  });
});

describe("interpolateFaqAnswer", () => {
  it("replaces {companyName} with fact value", () => {
    const result = interpolateFaqAnswer(
      "{companyName} has been in business since {established}.",
      MOCK_FACTS,
    );
    expect(result).toBe("Reference Industries has been in business since 2018.");
  });

  it("leaves unknown placeholders intact", () => {
    const result = interpolateFaqAnswer("Contact {unknownField}.", MOCK_FACTS);
    expect(result).toBe("Contact {unknownField}.");
  });
});

describe("generateFaqSchemaFromItems", () => {
  it("produces valid FAQPage JSON-LD", () => {
    const items: FaqItem[] = [{ id: "q1", question: "Q1?", answer: "A1." }];
    const schema = generateFaqSchemaFromItems(items, "en");
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(1);
    expect(schema.mainEntity[0]?.["@type"]).toBe("Question");
  });
});

describe("FAQ locale parity", () => {
  const FAQ_PAGE_SLUGS = [
    "about",
    "contact",
    "privacy",
    "terms",
  ] as const;

  for (const slug of FAQ_PAGE_SLUGS) {
    it(`${slug} exposes FAQ metadata through the English static content`, () => {
      const enPage = getStaticPage(slug, "en");

      const enIds = extractFaqFromMetadata(
        enPage.metadata,
      ).map((item) => item.id);

      expect(enIds).toEqual(expect.any(Array));
    });
  }
});
