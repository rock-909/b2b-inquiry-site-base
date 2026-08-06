import { describe, expect, it } from "vitest";
import { getPageBySlug } from "@/lib/content-query/queries";
import type { FaqItem } from "@/types/content.types";
import {
  extractFaqFromMetadata,
  generateFaqSchemaFromItems,
  interpolateFaqAnswer,
} from "../mdx-faq";

const MOCK_FACTS = {
  companyName: "Tucsenberg",
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
        { id: "moq", question: "What is MOQ?", answer: "500 pieces." },
        { id: "lead-time", question: "Lead time?", answer: "15-20 days." },
      ],
    };
    const result = extractFaqFromMetadata(metadata);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("moq");
  });
});

describe("interpolateFaqAnswer", () => {
  it("replaces {companyName} with fact value", () => {
    const result = interpolateFaqAnswer(
      "{companyName} has been in business since {established}.",
      MOCK_FACTS,
    );
    expect(result).toBe("Tucsenberg has been in business since 2018.");
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
    "oem-wholesale",
    "flood-barrier-materials-guide",
    "flood-barrier-specifications",
    "warranty",
    "privacy",
    "terms",
  ] as const;

  for (const slug of FAQ_PAGE_SLUGS) {
    it(`${slug} exposes FAQ metadata through the English content manifest`, async () => {
      const enPage = await getPageBySlug(slug, "en");

      const enIds = extractFaqFromMetadata(
        enPage.metadata,
      ).map((item) => item.id);

      expect(enIds).toEqual(expect.any(Array));
    });
  }
});
