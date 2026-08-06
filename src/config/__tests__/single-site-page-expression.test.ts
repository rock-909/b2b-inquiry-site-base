import { describe, expect, it } from "vitest";
import b2bLeadMessages from "../../../messages/profiles/b2b-lead/en/messages.json";
import catalogMessages from "../../../messages/profiles/catalog/en/messages.json";
import { ABS_FLOOD_BARRIERS_PRODUCT_PAGE } from "@/constants/tucsenberg-product-page-abs-flood-barriers";
import { getTucsenbergProductPage } from "@/constants/tucsenberg-product-pages";
import { SINGLE_SITE_HOME_PRODUCT_LINES } from "@/config/single-site-page-expression";

describe("single-site-page-expression", () => {
  it("keeps Aluminum homepage capabilities separate from ABS configurations", () => {
    const aluminumDescription =
      catalogMessages.home.productLines.items.aluminumFloodGates.description;
    const absProductPayload = JSON.stringify(ABS_FLOOD_BARRIERS_PRODUCT_PAGE);

    expect(aluminumDescription).toMatch(/stacked[\s-]plank/iu);
    expect(aluminumDescription).toMatch(/wall channels/iu);
    expect(aluminumDescription).toMatch(/removable posts/iu);
    expect(aluminumDescription).not.toMatch(/curv|gable[\s-]?end/iu);
    expect(absProductPayload).toMatch(/curve/iu);
    expect(absProductPayload).toMatch(/gable[\s-]?end/iu);
  });

  it("does not present the RFQ warranty as a catalog-wide 3-year warranty", () => {
    const warrantyCopy = b2bLeadMessages.requestQuote.page.confidenceWarranty;

    expect(warrantyCopy).not.toMatch(/\b3-year|three-year\b/iu);
    expect(warrantyCopy).toMatch(/warranty/iu);
    expect(warrantyCopy).toMatch(
      /product-specific|product type|applicable product/iu,
    );
  });

  it("maps every homepage product to a product-page diagram", () => {
    for (const productLine of SINGLE_SITE_HOME_PRODUCT_LINES) {
      expect(getTucsenbergProductPage(productLine.slug)?.diagram).toBeDefined();
    }
  });
});
