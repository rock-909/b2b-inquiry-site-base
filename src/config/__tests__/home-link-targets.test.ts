import { describe, expect, it } from "vitest";
import {
  getSingleSiteActiveRouteTargets,
  getSingleSiteHomeFinalCtaTargets,
  getSingleSiteHomeLinkTargets,
  SINGLE_SITE_HOME_LINK_TARGETS,
} from "@/config/single-site-links";

const CATALOG_HOME_LINK_TARGETS = {
  contact: "/contact",
  oemWholesale: "/oem-wholesale",
  products: "/products",
  requestQuote: "/request-quote",
  primaryCta: "/request-quote",
  secondaryCta: "/oem-wholesale",
} as const;

describe("single-site home link targets", () => {
  it("derives the catalog product home link targets", () => {
    expect(SINGLE_SITE_HOME_LINK_TARGETS).toEqual(
      getSingleSiteHomeLinkTargets(),
    );
    expect(SINGLE_SITE_HOME_LINK_TARGETS).toEqual(CATALOG_HOME_LINK_TARGETS);
  });

  it("exposes active route targets for the catalog site", () => {
    expect(getSingleSiteActiveRouteTargets()).toMatchObject({
      products: "/products",
      oemWholesale: "/oem-wholesale",
      requestQuote: "/request-quote",
      contact: "/contact",
      about: "/about",
    });
  });

  it("derives final CTA targets from semantic route availability", () => {
    expect(getSingleSiteHomeFinalCtaTargets()).toEqual([
      { href: "/request-quote", labelKey: "primary" },
      { href: "/oem-wholesale", labelKey: "secondary" },
    ]);
  });
});
