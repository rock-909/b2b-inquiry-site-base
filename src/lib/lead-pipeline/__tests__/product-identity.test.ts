import { describe, expect, it, vi } from "vitest";
import * as productCatalog from "@/constants/product-catalog";
import {
  GENERAL_RFQ_PRODUCT_LABEL,
  resolveProductIdentity,
} from "@/lib/lead-pipeline/product-identity";
import {
  PRODUCT_LEAD_TYPE,
  PRODUCT_INQUIRY_KINDS,
  type ProductLeadInput,
} from "@/lib/lead-pipeline/lead-schema";

describe("resolveProductIdentity", () => {
  it("returns the catalog label for a validated catalog product lead", () => {
    const lead: ProductLeadInput = {
      type: PRODUCT_LEAD_TYPE,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
      fullName: "Buyer Name",
      email: "buyer@example.com",
      catalogProductId: "abs-flood-barriers",
    };

    expect(resolveProductIdentity(lead)).toEqual({
      productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
      catalogProductId: "abs-flood-barriers",
      productName: "ABS Interlocking Boxwall",
    });
  });

  it("returns the general RFQ label when no catalog product is attached", () => {
    const lead: ProductLeadInput = {
      type: PRODUCT_LEAD_TYPE,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
      fullName: "Buyer Name",
      email: "buyer@example.com",
    };

    expect(resolveProductIdentity(lead)).toEqual({
      productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
      productName: GENERAL_RFQ_PRODUCT_LABEL,
    });
  });

  it("throws when a catalog lead cannot resolve after schema validation", () => {
    vi.spyOn(productCatalog, "getMarketBySlug").mockReturnValue(undefined);

    const lead: ProductLeadInput = {
      type: PRODUCT_LEAD_TYPE,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
      fullName: "Buyer Name",
      email: "buyer@example.com",
      catalogProductId: "abs-flood-barriers",
    };

    expect(() => resolveProductIdentity(lead)).toThrow(
      /catalog product identity could not be resolved/i,
    );
  });
});
