import { describe, expect, it } from "vitest";
import {
  PRODUCT_INQUIRY_KINDS,
  PRODUCT_LEAD_TYPE,
  isCatalogProductInquiry,
  productLeadSchema,
} from "../lead-schema";

const GENERAL_INQUIRY = {
  type: PRODUCT_LEAD_TYPE,
  productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
  fullName: "Jane Buyer",
  email: "jane@example.com",
  message: "Need flood protection for a warehouse.",
} as const;

describe("productLeadSchema", () => {
  it("accepts a general RFQ without catalog identity", () => {
    const result = productLeadSchema.parse(GENERAL_INQUIRY);

    expect(result).toEqual(GENERAL_INQUIRY);
    expect(isCatalogProductInquiry(result)).toBe(false);
  });

  it("accepts a registry-backed catalog product inquiry", () => {
    const result = productLeadSchema.parse({
      ...GENERAL_INQUIRY,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
      catalogProductId: "abs-flood-barriers",
      buyerInterest: "OEM branding",
    });

    expect(result.catalogProductId).toBe("abs-flood-barriers");
    expect(isCatalogProductInquiry(result)).toBe(true);
  });

  it("rejects missing or invalid catalog identity", () => {
    expect(
      productLeadSchema.safeParse({
        ...GENERAL_INQUIRY,
        productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
      }).success,
    ).toBe(false);
    expect(
      productLeadSchema.safeParse({
        ...GENERAL_INQUIRY,
        productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
        catalogProductId: "not-a-product",
      }).success,
    ).toBe(false);
  });

  it("rejects catalog identity on a general RFQ", () => {
    expect(
      productLeadSchema.safeParse({
        ...GENERAL_INQUIRY,
        catalogProductId: "abs-flood-barriers",
      }).success,
    ).toBe(false);
  });

  it("strips retired company, quantity, and requirements fields", () => {
    const result = productLeadSchema.parse({
      ...GENERAL_INQUIRY,
      company: "Buyer Co",
      quantity: 100,
      requirements: "Legacy requirements",
    });

    expect(result).not.toHaveProperty("company");
    expect(result).not.toHaveProperty("quantity");
    expect(result).not.toHaveProperty("requirements");
  });

  it("preserves canonical multiline message and attribution", () => {
    const result = productLeadSchema.parse({
      ...GENERAL_INQUIRY,
      message: "Line one\nLine two",
      utmSource: "google",
      landingPage: "/request-quote",
    });

    expect(result.message).toBe("Line one\nLine two");
    expect(result.utmSource).toBe("google");
    expect(result.landingPage).toBe("/request-quote");
  });
});
