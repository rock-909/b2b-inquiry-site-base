import { describe, expect, it } from "vitest";
import { resolveInquiryContext } from "@/lib/lead-pipeline/inquiry-handoff";
import {
  MAX_INQUIRY_CONFIG_PREFILL_LENGTH,
  MAX_LEAD_INTEREST_LENGTH,
} from "@/constants/validation-limits";

describe("resolveInquiryContext", () => {
  it("returns offering-context for one valid scalar offeringId", () => {
    expect(resolveInquiryContext({ offeringId: "custom-fabrication" })).toEqual(
      {
        kind: "offering-context",
        offeringId: "custom-fabrication",
        displayLabel: "Custom Fabrication",
      },
    );
  });

  it("downgrades forged offeringId values to general-context", () => {
    expect(resolveInquiryContext({ offeringId: "forged-offering" })).toEqual({
      kind: "general-context",
    });
  });

  it("downgrades repeated offeringId values to general-context", () => {
    expect(
      resolveInquiryContext({
        offeringId: ["custom-fabrication", "custom-fabrication"],
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
      interest: "reseller project",
      initialMessage: "visible estimate",
    });
  });

  it("caps buyer interest at the 200-character limit the form promises", () => {
    expect(MAX_LEAD_INTEREST_LENGTH).toBe(200);
  });

  it("caps long interest and config values", () => {
    const interest = "x".repeat(MAX_LEAD_INTEREST_LENGTH + 20);
    const config = "c".repeat(MAX_INQUIRY_CONFIG_PREFILL_LENGTH + 20);

    expect(resolveInquiryContext({ interest, config })).toEqual({
      kind: "general-context",
      interest: "x".repeat(MAX_LEAD_INTEREST_LENGTH),
      initialMessage: "c".repeat(MAX_INQUIRY_CONFIG_PREFILL_LENGTH),
    });
  });

  it("keeps interest and initialMessage on valid offering handoffs", () => {
    expect(
      resolveInquiryContext({
        offeringId: "custom-fabrication",
        interest: "coastal project",
        config: "Need span data",
      }),
    ).toEqual({
      kind: "offering-context",
      offeringId: "custom-fabrication",
      displayLabel: "Custom Fabrication",
      interest: "coastal project",
      initialMessage: "Need span data",
    });
  });
});
