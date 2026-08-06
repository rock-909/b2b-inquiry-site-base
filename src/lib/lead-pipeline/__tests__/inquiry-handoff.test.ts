import { describe, expect, it } from "vitest";
import {
  createCatalogInquiryHref,
  resolveInquiryContext,
} from "@/lib/lead-pipeline/inquiry-handoff";
import {
  MAX_INQUIRY_CONFIG_PREFILL_LENGTH,
  MAX_LEAD_PRODUCT_NAME_LENGTH,
} from "@/constants/validation-limits";

describe("resolveInquiryContext", () => {
  it("returns catalog-context for one valid scalar catalogProductId", () => {
    expect(
      resolveInquiryContext({ catalogProductId: "abs-flood-barriers" }),
    ).toEqual({
      kind: "catalog-context",
      catalogProductId: "abs-flood-barriers",
      displayLabel: "ABS Interlocking Boxwall",
    });
  });

  it("downgrades forged catalogProductId values to general-context", () => {
    expect(
      resolveInquiryContext({ catalogProductId: "forged-product" }),
    ).toEqual({
      kind: "general-context",
    });
  });

  it("downgrades repeated catalogProductId values to general-context", () => {
    expect(
      resolveInquiryContext({
        catalogProductId: ["abs-flood-barriers", "frp-flood-barriers"],
      }),
    ).toEqual({
      kind: "general-context",
    });
  });

  it("trims and caps interest and config as description-only fields", () => {
    const interest = "  reseller project  ";
    const config = "  visible estimate  ";

    expect(resolveInquiryContext({ interest, config })).toEqual({
      kind: "general-context",
      buyerInterest: "reseller project",
      initialMessage: "visible estimate",
    });
  });

  it("caps buyer interest at the 200-character limit the form promises", () => {
    expect(MAX_LEAD_PRODUCT_NAME_LENGTH).toBe(200);
  });

  it("caps long interest and config values", () => {
    const interest = "x".repeat(MAX_LEAD_PRODUCT_NAME_LENGTH + 20);
    const config = "c".repeat(MAX_INQUIRY_CONFIG_PREFILL_LENGTH + 20);

    expect(resolveInquiryContext({ interest, config })).toEqual({
      kind: "general-context",
      buyerInterest: "x".repeat(MAX_LEAD_PRODUCT_NAME_LENGTH),
      initialMessage: "c".repeat(MAX_INQUIRY_CONFIG_PREFILL_LENGTH),
    });
  });

  it("drops interest on valid catalog handoffs but keeps initialMessage", () => {
    expect(
      resolveInquiryContext({
        catalogProductId: "frp-flood-barriers",
        interest: "coastal project",
        config: "Need span data",
      }),
    ).toEqual({
      kind: "catalog-context",
      catalogProductId: "frp-flood-barriers",
      displayLabel: "FRP Composite Planks",
      initialMessage: "Need span data",
    });
  });
});

describe("createCatalogInquiryHref", () => {
  it("builds the shared catalog query contract without productInquiryKind", () => {
    const href = createCatalogInquiryHref(
      "abs-flood-barriers",
      "Estimated 12 straight units",
    );

    expect(href).toBe(
      "/request-quote?catalogProductId=abs-flood-barriers&config=Estimated+12+straight+units",
    );
    expect(href).not.toContain("productInquiryKind");
    expect(href).not.toContain("interest=");
  });

  it("omits config when no initial message is provided", () => {
    expect(createCatalogInquiryHref("frp-flood-barriers")).toBe(
      "/request-quote?catalogProductId=frp-flood-barriers",
    );
  });
});
